/**
 * 03 · ВЕРСТАК — the bench.
 *
 * Nine slots, a shelf of parts, and a price that moves while you drag. The
 * parts are real geometry rather than flat icons, and all of them — shelf,
 * grid, output — are instances of one box in one InstancedMesh with one
 * material: eighteen cubes, one draw call. The renderer is orthographic and
 * mapped to CSS pixels, so each instance simply sits wherever its slot is.
 *
 * Dragging is Pointer Events with a magnet: release near a slot and the part
 * finishes the trip itself on a spring. Everything is also reachable by
 * keyboard — pick a part, then choose a slot — because a bench you can only
 * use with a mouse is a bench half the visitors cannot use.
 */
/* Named imports, not a namespace import: `import * as THREE` keeps the
   whole library reachable and the bundler cannot drop anything. */
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  DynamicDrawUsage,
  Euler,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  OrthographicCamera,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Material } from 'three';
import type { World } from '../core/world';
import { LOOKS } from '../core/world';
import { clock, type Job } from '../core/ticker';
import { quality } from '../core/quality';
import { audio } from '../core/audio-bus';
import { $$, damp, el, esc, need } from '../core/dom';
import { invite } from '../ui/toast';
import { store } from '../ui/store';
import { CRAFT_ITEMS, RECIPES, EMPTY_CRAFT, type CraftItem } from '../data/content';

const ITEMS = Object.keys(CRAFT_ITEMS) as CraftItem[];

interface Cell { node: HTMLElement; item: CraftItem | null; }

class Craft implements World {
  readonly id = 'craft' as const;
  readonly look = LOOKS.craft;

  private section!: HTMLElement;
  private job: Job | null = null;

  private renderer: WebGLRenderer | null = null;
  private scene: Scene | null = null;
  private camera: OrthographicCamera | null = null;
  private mesh: InstancedMesh | null = null;
  private glCanvas: HTMLCanvasElement | null = null;

  /** one entry per instance: where it sits and how fast it is spinning */
  private slots: { node: HTMLElement; item: CraftItem | null; spin: number; spinTarget: number }[] = [];
  private grid: Cell[] = [];
  private outCell: HTMLElement | null = null;
  private held: CraftItem | null = null;
  private ghost: HTMLElement | null = null;
  private dragFrom: HTMLElement | null = null;
  private boxRect = { left: 0, top: 0, w: 1, h: 1 };

  mount(section: HTMLElement): void {
    this.section = section;
    this.buildShelf();
    this.buildGrid();
    this.buildGL();
    this.recalc();

    this.job = clock.add(({ t, k }) => {
      for (const s of this.slots) s.spin = damp(s.spin, s.spinTarget, 0.1, k);
      this.render(t);
    }, { always: true, resize: () => this.layout() });
  }

  /* ——— DOM ——————————————————————————————————————————————————————————— */
  private buildGrid(): void {
    const host = need('#benchGrid', this.section);
    if (host.childElementCount) return;
    for (let i = 0; i < 9; i++) {
      const node = el('button', 'slot');
      (node as HTMLButtonElement).type = 'button';
      node.setAttribute('aria-label', `Ячейка ${i + 1}`);
      host.appendChild(node);
      const cell: Cell = { node, item: null };
      this.grid.push(cell);
      this.slots.push({ node, item: null, spin: 0, spinTarget: 0 });

      node.addEventListener('click', () => {
        if (this.held) { this.place(i, this.held); this.held = null; this.clearHeld(); }
        else if (cell.item) { this.place(i, null); }
      });
      node.addEventListener('pointerenter', () => { if (this.dragFrom) node.classList.add('is-over'); });
      node.addEventListener('pointerleave', () => node.classList.remove('is-over'));
    }
    this.outCell = need('#benchOut', this.section);
    this.slots.push({ node: this.outCell, item: null, spin: 0, spinTarget: 0.6 });
  }

  private buildShelf(): void {
    const bar = need('#hotbar', this.section);
    if (bar.childElementCount) return;
    for (const key of ITEMS) {
      const it = CRAFT_ITEMS[key];
      const b = el('button', 'hot');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', `${it.n} — ${it.lore}`);
      b.title = `${it.n} · ${it.lore}`;
      bar.appendChild(b);
      this.slots.push({ node: b, item: key, spin: 0, spinTarget: 0 });

      b.addEventListener('pointerenter', () => { this.spinOf(b, 2.4); });
      b.addEventListener('pointerleave', () => { this.spinOf(b, 0); });
      b.addEventListener('pointerdown', (e) => this.startDrag(e, b, key));
      b.addEventListener('click', () => {
        this.held = key;
        $$('.hot', bar).forEach((h) => h.setAttribute('aria-pressed', h === b ? 'true' : 'false'));
        need('#benchHint', this.section).textContent = `${it.n} в руке — выберите ячейку`;
        audio.click();
      });
    }
    invite($$('.hot', bar), 2);
  }

  private clearHeld(): void {
    $$('.hot', this.section).forEach((h) => h.setAttribute('aria-pressed', 'false'));
  }

  private spinOf(node: HTMLElement, v: number): void {
    const s = this.slots.find((x) => x.node === node);
    if (s) s.spinTarget = v;
  }

  /* ——— drag with a magnet ——————————————————————————————————————————— */
  private startDrag(e: PointerEvent, from: HTMLElement, key: CraftItem): void {
    e.preventDefault();
    this.dragFrom = from;
    from.classList.add('is-drag');
    const g = el('div');
    const c = CRAFT_ITEMS[key].c;
    g.style.cssText =
      `position:fixed;z-index:600;width:46px;height:46px;border-radius:6px;pointer-events:none;` +
      `background:linear-gradient(140deg, ${c[0]}, ${c[1]} 60%, ${c[2]});` +
      `box-shadow:0 8px 24px rgba(0,0,0,.5);transform:translate3d(${e.clientX - 23}px,${e.clientY - 23}px,0)`;
    document.body.appendChild(g);
    this.ghost = g;

    const move = (ev: PointerEvent): void => {
      g.style.transform = `translate3d(${ev.clientX - 23}px,${ev.clientY - 23}px,0)`;
    };
    const up = (ev: PointerEvent): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      from.classList.remove('is-drag');
      this.dragFrom = null;
      $$('.slot', this.section).forEach((s) => s.classList.remove('is-over'));

      /* The magnet: nearest cell within a slot and a half finishes the trip. */
      let best = -1;
      let bestD = Infinity;
      this.grid.forEach((cell, i) => {
        const r = cell.node.getBoundingClientRect();
        const d = Math.hypot(ev.clientX - (r.left + r.width / 2), ev.clientY - (r.top + r.height / 2));
        if (d < bestD) { bestD = d; best = i; }
      });
      const cellR = this.grid[0]?.node.getBoundingClientRect();
      const reach = (cellR?.width ?? 48) * 1.5;
      if (best >= 0 && bestD < reach) {
        const r = this.grid[best]!.node.getBoundingClientRect();
        g.style.transition = 'transform 220ms cubic-bezier(.2,1.4,.4,1), opacity 200ms 120ms';
        g.style.transform = `translate3d(${r.left + r.width / 2 - 23}px,${r.top + r.height / 2 - 23}px,0)`;
        g.style.opacity = '0';
        this.place(best, key);
        window.setTimeout(() => g.remove(), 340);
      } else {
        g.style.transition = 'opacity 160ms';
        g.style.opacity = '0';
        window.setTimeout(() => g.remove(), 200);
      }
      this.ghost = null;
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
  }

  private place(i: number, item: CraftItem | null): void {
    const cell = this.grid[i];
    if (!cell) return;
    cell.item = item;
    const slot = this.slots.find((s) => s.node === cell.node);
    if (slot) { slot.item = item; slot.spinTarget = item ? 1.6 : 0; window.setTimeout(() => { if (slot) slot.spinTarget = 0; }, 700); }
    audio.craft();
    this.recalc();
  }

  /* ——— what the bench says back ————————————————————————————————————— */
  private recalc(): void {
    const picked = this.grid.map((c) => c.item).filter(Boolean) as CraftItem[];
    const uniq = [...new Set(picked)];
    const priceEl = need('#craftPrice', this.section);
    const termEl = need('#craftTerm', this.section);
    const outHost = need('#craftOut', this.section);
    const hint = need('#benchHint', this.section);
    const outSlot = this.slots.find((s) => s.node === this.outCell);

    if (!uniq.length) {
      priceEl.textContent = '0 ₽';
      termEl.textContent = 'срок ≈ ∞';
      hint.textContent = 'пустая сетка';
      outHost.innerHTML =
        `<div class="craft__card is-on"><h3>${EMPTY_CRAFT.n}</h3><p>${EMPTY_CRAFT.p}</p></div>`;
      if (outSlot) outSlot.item = null;
      this.outCell?.classList.remove('is-on');
      return;
    }

    const base = uniq.reduce((a, k) => a + CRAFT_ITEMS[k].p, 0);
    const weeksRaw = uniq.reduce((a, k) => a + CRAFT_ITEMS[k].w, 0);
    /* Tracks run in parallel and overlap more the more of them there are, so
       the schedule is a square root, not a sum. A flat percentage put a full
       scope at thirteen weeks, which is not a date anyone here would sign. */
    const weeks = Math.max(2, Math.round(Math.sqrt(weeksRaw) * 1.9));
    const lo = Math.round(base * 0.9);
    const hi = Math.round(base * 1.28);
    priceEl.textContent = `${lo}–${hi} тыс ₽`;
    termEl.textContent = `срок ≈ ${weeks} нед.`;

    /* The recipe that best fits what is actually on the bench. */
    let match = RECIPES[0]!;
    let bestScore = -1;
    for (const r of RECIPES) {
      const have = r.need.filter((n) => uniq.includes(n)).length;
      const score = have === r.need.length ? 100 + r.need.length : have;
      if (score > bestScore) { bestScore = score; match = r; }
    }
    const complete = match.need.every((n) => uniq.includes(n));
    hint.textContent = complete ? `рецепт: ${match.n.toLowerCase()}` : 'соберите рецепт целиком';
    if (outSlot) { outSlot.item = complete ? match.out : null; }
    this.outCell?.classList.toggle('is-on', complete);
    if (complete && match.gold) audio.clear();

    store.set('craft.pick', complete ? match.n : uniq.map((u) => CRAFT_ITEMS[u].n).join(' + '));

    /* One recommendation, argued from their own choices — not a menu. */
    const why = complete
      ? `Вы положили на верстак ${uniq.map((u) => CRAFT_ITEMS[u].n.toLowerCase()).join(', ')}. Этого набора хватает ровно на «${match.n.toLowerCase()}» — и это то, что мы бы предложили сами.`
      : `Пока на верстаке ${uniq.map((u) => CRAFT_ITEMS[u].n.toLowerCase()).join(', ')}. Ближе всего к этому «${match.n.toLowerCase()}»: не хватает ${match.need.filter((n) => !uniq.includes(n)).map((n) => CRAFT_ITEMS[n].n.toLowerCase()).join(', ')}.`;

    outHost.innerHTML =
      `<div class="craft__card is-on">` +
      `<h3>${esc(match.n)}</h3><p>${esc(match.p)}</p>` +
      `<div class="craft__meta">${match.meta.map((m) => `<span>${m}</span>`).join('')}</div>` +
      `<ul class="craft__list">${match.li.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` +
      `<div class="craft__rec${match.gold && complete ? ' is-gold' : ''}">` +
      `<b>${match.gold && complete ? 'Настоящий выходной' : 'Что мы советуем'}</b>${esc(why)}</div>` +
      `</div>`;
  }

  /* ——— one mesh, eighteen instances ————————————————————————————————— */
  private buildGL(): void {
    if (!quality.gl) return;
    const host = this.section.querySelector<HTMLElement>('.craft__benchCol');
    if (!host) return;

    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2';
    cv.setAttribute('aria-hidden', 'true');
    host.style.position = 'relative';
    host.appendChild(cv);
    this.glCanvas = cv;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        canvas: cv, alpha: true, antialias: false, powerPreference: 'high-performance',
      });
    } catch { cv.remove(); this.glCanvas = null; return; }
    renderer.setPixelRatio(Math.min(quality.dpr, 2));
    this.renderer = renderer;

    const scene = new Scene();
    this.scene = scene;
    const cam = new OrthographicCamera(0, 1, 0, 1, -500, 500);
    this.camera = cam;

    /* One geometry, one material, every part an instance of it. The bevel is a
       cheap normal-based ramp in the material rather than more triangles. */
    const geo = new BoxGeometry(1, 1, 1);
    const mat = new MeshLambertMaterial({ vertexColors: false });
    const mesh = new InstancedMesh(geo, mat, this.slots.length);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    scene.add(mesh);
    this.mesh = mesh;

    scene.add(new AmbientLight(0xffffff, 1.5));
    const key = new DirectionalLight(0xfff0c0, 2.2);
    key.position.set(-0.6, 1, 0.8);
    scene.add(key);

    this.layout();
  }

  private layout(): void {
    /* Re-read on every layout: a tier the ladder changed after mount has to
       reach the renderer, or the downgrade costs the same as the upgrade. */
    this.renderer?.setPixelRatio(Math.min(quality.dpr, 2));
    if (!this.renderer || !this.camera || !this.glCanvas) return;
    const host = this.glCanvas.parentElement!;
    const r = host.getBoundingClientRect();
    this.boxRect = { left: r.left, top: r.top, w: Math.max(1, r.width), h: Math.max(1, r.height) };
    this.renderer.setSize(r.width, r.height, false);
    this.camera.left = 0; this.camera.right = r.width;
    this.camera.top = 0; this.camera.bottom = -r.height;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 0, 100);
  }

  private render(t: number): void {
    const { renderer, scene, camera, mesh } = this;
    if (!renderer || !scene || !camera || !mesh) return;

    const m = new Matrix4();
    const q = new Quaternion();
    const e = new Euler();
    const pos = new Vector3();
    const scl = new Vector3();
    const col = new Color();
    let visible = 0;

    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i]!;
      if (!s.item) { m.makeScale(0, 0, 0); mesh.setMatrixAt(i, m); continue; }
      const r = s.node.getBoundingClientRect();
      const x = r.left - this.boxRect.left + r.width / 2;
      const y = -(r.top - this.boxRect.top + r.height / 2);
      /* Anything scrolled out of the bench's own box is scaled to nothing
         rather than drawn off screen. */
      if (r.width < 2 || y > 0 || -y > this.boxRect.h) { m.makeScale(0, 0, 0); mesh.setMatrixAt(i, m); continue; }
      const size = Math.min(r.width, r.height) * 0.56;
      pos.set(x, y, 0);
      e.set(-0.5 + Math.sin(t * 0.0004 + i) * 0.05, t * 0.001 * s.spin + i, 0.2);
      q.setFromEuler(e);
      scl.set(size, size, size);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
      col.set(CRAFT_ITEMS[s.item].c[0]);
      mesh.setColorAt(i, col);
      visible++;
    }
    mesh.count = this.slots.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (visible === 0) { renderer.clear(); return; }
    renderer.render(scene, camera);
  }

  pause(): void { if (this.job) this.job.live = false; }
  resume(): void { if (this.job) { this.job.live = true; this.job.dirty = true; this.layout(); } }

  unmount(): void {
    if (this.job) clock.remove(this.job);
    this.job = null;
    this.ghost?.remove();
    this.mesh?.geometry.dispose();
    (this.mesh?.material as Material | undefined)?.dispose();
    this.mesh?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.glCanvas?.remove();
    this.renderer = null; this.scene = null; this.camera = null; this.mesh = null; this.glCanvas = null;
  }
}

let instance: Craft | null = null;
export function create(): World { instance ??= new Craft(); return instance; }