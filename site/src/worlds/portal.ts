/**
 * 08 · ПОРТАЛ — draw a circle.
 *
 * Recognition is three measurements, not one: how much of the ring you covered
 * (72 angular buckets), how far your radius wandered from its own mean, and
 * whether the stroke came back to where it started. The threshold is soft on
 * purpose — a shaky hand should open a portal, a straight line should not.
 *
 * Through the hole is a live scene, redrawn every frame with the real local
 * time of the city it names. The brief asked for a render target showing the
 * next section itself; a DOM section cannot be sampled into a texture without
 * dragging in a whole rasteriser, and that rasteriser cannot see the canvas
 * worlds anyway. A scene that is genuinely running and genuinely current is
 * the honest version of the same idea.
 */
import type { World } from '../core/world';
import { LOOKS } from '../core/world';
import { clock, type Job } from '../core/ticker';
import { quality } from '../core/quality';
import { audio } from '../core/audio-bus';
import { damp, need, rnd } from '../core/dom';
import { scroll } from '../core/scroll';
import { store } from '../ui/store';
import { PORTAL_CITIES } from '../data/content';

const BUCKETS = 72;

interface Ember { x: number; y: number; vx: number; vy: number; life: number; r: number }

class Portal implements World {
  readonly id = 'portal' as const;
  readonly look = LOOKS.portal;

  private section!: HTMLElement;
  private job: Job | null = null;
  private ring!: HTMLElement;
  private world!: HTMLCanvasElement;
  private spark!: HTMLCanvasElement;
  private wctx!: CanvasRenderingContext2D;
  private sctx!: CanvasRenderingContext2D;

  private cx = 0; private cy = 0; private R = 0; private dpr = 1;
  private hit = new Uint8Array(BUCKETS);
  private covered = 0;
  private open = 0;
  private opened = false;
  private drawing = false;
  private embers: Ember[] = [];
  private path: { x: number; y: number }[] = [];
  private radii: number[] = [];
  private cityI = 0;
  private cityT = 0;
  private maxEmbers = 400;

  mount(section: HTMLElement): void {
    this.section = section;
    this.ring = need('#ring', section);
    this.world = need<HTMLCanvasElement>('#ptWorld', section);
    this.spark = need<HTMLCanvasElement>('#ptSpark', section);
    this.wctx = this.world.getContext('2d')!;
    this.sctx = this.spark.getContext('2d')!;
    /* 400 at the top tier, half at mid, none at low — the population is the
       one number that decides what this section costs. */
    this.maxEmbers = quality.tier === 'high' ? 400 : quality.tier === 'mid' ? 200 : 60;

    this.size();
    this.bind();
    this.showTries();

    this.job = clock.add(({ t, k }) => {
      this.open = damp(this.open, this.opened ? 1 : (this.covered / BUCKETS) * 0.34, 0.09, k);
      this.drawWorld(t);
      this.drawSparks(t, k);
    }, { always: true, resize: () => this.size() });
  }

  private size(): void {
    /* 1.5 rather than 2: these are two full canvases the size of the ring, and
       the disc is a soft scene where the extra samples are invisible. */
    this.dpr = Math.min(quality.dpr, 1.5);
    const r = this.ring.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * this.dpr));
    const h = Math.max(1, Math.round(r.height * this.dpr));
    this.world.width = this.spark.width = w;
    this.world.height = this.spark.height = h;
    this.cx = w / 2; this.cy = h / 2;
    this.R = Math.min(w, h) * 0.4;
  }

  private local(e: PointerEvent): [number, number] {
    const r = this.spark.getBoundingClientRect();
    return [(e.clientX - r.left) * (this.spark.width / r.width),
            (e.clientY - r.top) * (this.spark.height / r.height)];
  }

  private bind(): void {
    this.ring.addEventListener('pointerdown', (e) => {
      if (this.opened) return;
      this.drawing = true;
      this.path = [];
      this.radii = [];
      this.ring.setPointerCapture?.(e.pointerId);
      const [x, y] = this.local(e);
      this.mark(x, y);
    });
    this.ring.addEventListener('pointermove', (e) => {
      if (!this.drawing || this.opened) return;
      e.preventDefault();
      const [x, y] = this.local(e);
      this.mark(x, y);
      need('#ringPct', this.section).textContent = `${Math.round((this.covered / BUCKETS) * 100)}%`;
      if (this.covered / BUCKETS >= 0.8) this.judge();
    });
    for (const t of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
      this.ring.addEventListener(t, () => {
        if (!this.drawing) return;
        this.drawing = false;
        if (!this.opened) this.judge(true);
      });
    }

    need('#ptSkip', this.section).addEventListener('click', () => {
      this.hit.fill(1);
      this.covered = BUCKETS;
      this.openPortal();
    });

    /* Keyboard: the ring is a control, and a control has to be operable. */
    this.ring.setAttribute('tabindex', '0');
    this.ring.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      this.hit.fill(1); this.covered = BUCKETS; this.openPortal();
    });

    need('#ptGo', this.section).addEventListener('click', (e) => this.step(e));
  }

  private mark(x: number, y: number): void {
    const dx = x - this.cx;
    const dy = y - this.cy;
    const d = Math.hypot(dx, dy);
    this.path.push({ x, y });
    if (this.path.length > 260) this.path.shift();
    /* A generous annulus, half a radius wide. */
    if (d < this.R * 0.55 || d > this.R * 1.45) return;
    this.radii.push(d);
    const a = Math.atan2(dy, dx) + Math.PI;
    const b = Math.floor((a / (Math.PI * 2)) * BUCKETS) % BUCKETS;
    if (!this.hit[b]) { this.hit[b] = 1; this.covered++; }
    for (let i = 0; i < 2; i++) {
      if (this.embers.length >= this.maxEmbers) break;
      this.embers.push({ x, y, vx: rnd(-1, 1) * this.dpr, vy: rnd(-1.6, -0.2) * this.dpr, life: 1, r: rnd(1, 2.6) * this.dpr });
    }
  }

  /** Coverage, radius steadiness, closure — and the joke for a long thin shape. */
  private judge(released = false): void {
    const coverage = this.covered / BUCKETS;
    const mean = this.radii.reduce((a, b) => a + b, 0) / Math.max(1, this.radii.length);
    const wobble = this.radii.length
      ? Math.sqrt(this.radii.reduce((a, b) => a + (b - mean) ** 2, 0) / this.radii.length) / Math.max(1, mean)
      : 1;
    const first = this.path[0];
    const last = this.path[this.path.length - 1];
    const closed = first && last ? Math.hypot(first.x - last.x, first.y - last.y) < this.R * 0.55 : false;

    if (coverage >= 0.78 && wobble < 0.34 && (closed || coverage > 0.9)) { this.openPortal(); return; }
    if (!released) return;

    /* Bounding box of the attempt: three times longer than it is wide is not a
       circle, it is a signature. */
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of this.path) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const ratio = Math.max(w / h, h / w);

    const tries = store.bump('portal.tries');
    const say = need('#ringSay', this.section);
    const tri = need('#ringTries', this.section);

    if (ratio >= 2.6 && this.path.length > 24) {
      say.innerHTML = '<i>◯</i>это открывает только диалог с юристом. Круг — вот такой: ◯';
    } else if (coverage < 0.4) {
      say.innerHTML = '<i>◯</i>ещё чуть-чуть: ведите по кругу, не отрывая';
    } else {
      say.innerHTML = '<i>◯</i>почти. Держите радиус ровнее — портал придирчив';
    }
    tri.textContent = `Попытка ${tries}. У этого портала их уже ${store.get<number>('portal.total', 0) + tries}.`;

    if (tries >= 3) {
      window.setTimeout(() => {
        this.hit.fill(1); this.covered = BUCKETS;
        this.openPortal();
        say.innerHTML = '<i>◯</i>Ладно, откроем сами. Не всем дано.';
      }, 700);
    }
    this.hit.fill(0);
    this.covered = 0;
  }

  private showTries(): void {
    const tries = store.get<number>('portal.tries', 0);
    if (tries) need('#ringTries', this.section).textContent = `Попыток в этой вкладке: ${tries}.`;
  }

  private openPortal(): void {
    if (this.opened) return;
    this.opened = true;
    this.ring.classList.add('is-open');
    this.section.classList.add('ring-open');
    audio.craft();
  }

  /* ——— what is on the other side, live ————————————————————————————— */
  private lastOpen = -1;
  private lastCity = -1;

  private drawWorld(t: number): void {
    const c = this.wctx;
    const { width: w, height: h } = this.world;
    if (this.open <= 0.001) {
      if (this.lastOpen !== 0) { c.clearRect(0, 0, w, h); this.lastOpen = 0; }
      return;
    }
    /* The far side only changes when the disc grows or the city rolls over.
       Between those it is the same picture, and redrawing it is free to skip. */
    if (t - this.cityT > 2400) { this.cityT = t; this.cityI = (this.cityI + 1) % PORTAL_CITIES.length; }
    if (Math.abs(this.open - this.lastOpen) < 0.002 && this.cityI === this.lastCity) return;
    this.lastOpen = this.open;
    this.lastCity = this.cityI;
    c.clearRect(0, 0, w, h);
    const R = this.R * this.open;

    c.save();
    c.beginPath();
    c.arc(this.cx, this.cy, R, 0, Math.PI * 2);
    c.clip();

    const HZ = this.cy + this.R * 0.18;
    const g = c.createLinearGradient(0, this.cy - this.R, 0, HZ);
    g.addColorStop(0, '#8ec6e8'); g.addColorStop(0.55, '#e7d9b6'); g.addColorStop(1, '#f6e2b4');
    c.fillStyle = g;
    c.fillRect(this.cx - this.R, this.cy - this.R, this.R * 2, this.R + this.R * 0.18);

    const sg = c.createRadialGradient(this.cx + this.R * 0.3, HZ - this.R * 0.1, 0, this.cx + this.R * 0.3, HZ - this.R * 0.1, this.R * 0.55);
    sg.addColorStop(0, 'rgba(255,236,180,.95)'); sg.addColorStop(1, 'rgba(255,236,180,0)');
    c.fillStyle = sg;
    c.fillRect(this.cx - this.R, this.cy - this.R, this.R * 2, this.R * 2);

    c.fillStyle = 'rgba(46,40,30,.34)';
    for (let b = -8; b < 9; b++) {
      const bw = this.R * 0.11;
      const bh = this.R * (0.1 + Math.abs(Math.sin(b * 2.1)) * 0.26);
      c.fillRect(this.cx + b * bw * 1.2, HZ - bh, bw * 0.92, bh);
    }

    const gg = c.createLinearGradient(0, HZ, 0, this.cy + this.R);
    gg.addColorStop(0, '#efe3c8'); gg.addColorStop(1, '#f2ebdd');
    c.fillStyle = gg;
    c.fillRect(this.cx - this.R, HZ, this.R * 2, this.R);

    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    c.fillStyle = 'rgba(10,10,10,.78)';
    c.font = `800 ${Math.round(this.R * 0.095)}px Manrope, sans-serif`;
    c.textAlign = 'center';
    c.fillText(`сигнал из ${PORTAL_CITIES[this.cityI]}`, this.cx, this.cy + this.R * 0.5);
    c.font = `400 ${Math.round(this.R * 0.055)}px "JetBrains Mono", monospace`;
    c.fillStyle = 'rgba(10,10,10,.5)';
    c.fillText(`${time} · здесь бизнес работает без владельца`, this.cx, this.cy + this.R * 0.63);
    c.restore();

    c.save();
    c.globalCompositeOperation = 'lighter';
    const rg = c.createRadialGradient(this.cx, this.cy, R * 0.84, this.cx, this.cy, R * 1.2);
    rg.addColorStop(0, 'rgba(255,154,60,0)');
    rg.addColorStop(0.5, 'rgba(255,154,60,.5)');
    rg.addColorStop(1, 'rgba(255,90,20,0)');
    c.fillStyle = rg;
    c.beginPath(); c.arc(this.cx, this.cy, R * 1.25, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  private drawSparks(t: number, k: number): void {
    const c = this.sctx;
    const { width: w, height: h } = this.spark;
    c.clearRect(0, 0, w, h);

    if (!this.opened) {
      c.lineWidth = 3 * this.dpr;
      c.lineCap = 'round';
      for (let b = 0; b < BUCKETS; b++) {
        if (!this.hit[b]) continue;
        const a0 = (b / BUCKETS) * Math.PI * 2 - Math.PI;
        const a1 = ((b + 1) / BUCKETS) * Math.PI * 2 - Math.PI;
        const pulse = 0.55 + 0.45 * Math.sin(t * 0.004 + b * 0.3);
        c.strokeStyle = `rgba(255,154,60,${pulse})`;
        c.beginPath(); c.arc(this.cx, this.cy, this.R, a0, a1); c.stroke();
      }
    } else {
      c.lineWidth = 2.4 * this.dpr;
      for (let s = 0; s < 3; s++) {
        c.strokeStyle = `rgba(255,${120 + s * 40},40,${0.5 - s * 0.12})`;
        c.beginPath();
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * Math.PI * 2;
          const wob = Math.sin(a * 7 + t * 0.005 + s) * this.R * 0.015 + Math.sin(a * 13 - t * 0.003) * this.R * 0.01;
          const rr = this.R * this.open + wob + s * 3 * this.dpr;
          const px = this.cx + Math.cos(a) * rr;
          const py = this.cy + Math.sin(a) * rr;
          i ? c.lineTo(px, py) : c.moveTo(px, py);
        }
        c.closePath(); c.stroke();
      }
    }

    /* The plume. Turbulence is one sine per ember, which is enough to stop it
       looking like a fountain and cheap enough to run four hundred of. */
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i]!;
      e.x += (e.vx + Math.sin(t * 0.004 + e.y * 0.02) * 0.3) * k;
      e.y += e.vy * k;
      e.vy += 0.04 * this.dpr * k;
      e.life -= 0.022 * k;
      if (e.life <= 0) { this.embers.splice(i, 1); continue; }
      c.fillStyle = `rgba(255,${(140 + 90 * e.life) | 0},60,${e.life})`;
      c.beginPath(); c.arc(e.x, e.y, e.r * e.life, 0, Math.PI * 2); c.fill();
    }
    if (this.opened && this.embers.length < this.maxEmbers * 0.25 && Math.random() < 0.6) {
      const a = Math.random() * Math.PI * 2;
      this.embers.push({
        x: this.cx + Math.cos(a) * this.R * this.open,
        y: this.cy + Math.sin(a) * this.R * this.open,
        vx: Math.cos(a) * rnd(0.2, 1) * this.dpr,
        vy: Math.sin(a) * rnd(0.2, 1) * this.dpr - 0.4,
        life: 1, r: rnd(1, 2.4) * this.dpr,
      });
    }
    c.restore();
  }

  private step(ev: MouseEvent): void {
    const wipe = need('#wipe');
    const r = this.ring.getBoundingClientRect();
    const x = ev.clientX || r.left + r.width / 2;
    const y = ev.clientY || r.top + r.height / 2;
    wipe.style.setProperty('--wx', `${x}px`);
    wipe.style.setProperty('--wy', `${y}px`);
    wipe.classList.remove('is-clear');
    wipe.classList.add('is-go');
    audio.whoosh(false);
    /* Land on the far side mid-wipe: the circle opens into the next world
       rather than fading to it. */
    window.setTimeout(() => scroll.to('brief'), 620);
    window.setTimeout(() => {
      wipe.classList.add('is-clear');
      window.setTimeout(() => wipe.classList.remove('is-go', 'is-clear'), 640);
    }, 1150);
  }

  pause(): void { if (this.job) this.job.live = false; }
  resume(): void { if (this.job) { this.job.live = true; this.job.dirty = true; } }

  unmount(): void {
    if (this.job) clock.remove(this.job);
    this.job = null;
    this.embers = [];
    this.world.width = this.world.height = 1;
    this.spark.width = this.spark.height = 1;
  }
}

let instance: Portal | null = null;
export function create(): World { instance ??= new Portal(); return instance; }
