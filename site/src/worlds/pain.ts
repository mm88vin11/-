/**
 * 01 · ПОДЗЕМЕЛЬЕ — where the money goes.
 *
 * A pixel-lit basement: one torch that follows the pointer a beat late, four
 * blocks to strike, and a glass that fills with what each one costs. The
 * blocks fall into that glass with real physics, and it is deliberately the
 * same glass shape the pricing section fills later — the leak and the estimate
 * are the same stack seen twice.
 *
 * The torch is a shader, not a CSS mask: a radial-gradient mask over a
 * full-screen element repaints the whole layer every pointer move.
 */
import Matter from 'matter-js';
import type { World } from '../core/world';
import { LOOKS } from '../core/world';
import { clock, type Job } from '../core/ticker';
import { quality } from '../core/quality';
import { audio } from '../core/audio-bus';
import { ShaderLayer, GLSL_HEAD } from '../core/gl';
import { $$, clamp, damp, el, esc, need, fit } from '../core/dom';
import { invite } from '../ui/toast';
import { scroll } from '../core/scroll';
import { store } from '../ui/store';
import { PAIN } from '../data/content';

const FRAG = `${GLSL_HEAD('mediump')}
uniform vec2 uTorch;
uniform float uWarm;
void main(){
  vec2 uv = vUv;
  vec2 p = (gl_FragCoord.xy - uRes * 0.5) / uRes.y;
  /* Cold: this world sits about 800K under the rest of the site, and the tint
     is in the ground colour rather than in a filter over the section. */
  vec3 base = vec3(0.035, 0.052, 0.086);
  float grain = fbm2(p * 3.4 + vec2(uTime * 0.02, 0.0));
  base += vec3(0.012, 0.016, 0.026) * grain;

  vec2 tp = (uTorch - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float d = distance(p, tp);
  /* Two falloffs: a tight pool and a wide spill, so the edge is a lantern's
     rather than a spotlight's. */
  float pool = smoothstep(0.42, 0.0, d);
  float spill = smoothstep(1.1, 0.1, d) * 0.35;
  vec3 warm = vec3(1.0, 0.86, 0.55);
  vec3 col = base + warm * (pool * 0.30 + spill * 0.10) * uWarm;
  col += vec3(0.06, 0.05, 0.02) * pool * grain * uWarm;
  outColor = vec4(col, 1.0);
}`;

const PAL: Record<string, string | null> = { '.': null, o: '#e39b1f', y: '#f8d548', d: '#8a5a12', k: '#0a0a0a' };
const QBLOCK = [
  'oooooooooooooooo', 'okkkkkkkkkkkkkko', 'okyyyyyyyyyyyyko', 'okyyyykkkkyyyyko',
  'okyyykkyyyykkyko', 'okyyykkyyyykkyko', 'okyyyyyyyykkyyko', 'okyyyyyykkyyyyko',
  'okyyyyykkyyyyyko', 'okyyyyykkyyyyyko', 'okyyyyyyyyyyyyko', 'okyyyyykkyyyyyko',
  'okyyyyykkyyyyyko', 'okyyyyyyyyyyyyko', 'okkkkkkkkkkkkkko', 'oooooooooooooooo',
];
const UBLOCK = [
  'dddddddddddddddd', 'dkkkkkkkkkkkkkkd', 'dkddddddddddddkd', 'dkddddddddddddkd',
  'dkddddddddddddkd', 'dkddddddddddddkd', 'dkddddddddddddkd', 'dkddddddddddddkd',
  'dkddddddddddddkd', 'dkddddddddddddkd', 'dkddddddddddddkd', 'dkddddddddddddkd',
  'dkddddddddddddkd', 'dkddddddddddddkd', 'dkkkkkkkkkkkkkkd', 'dddddddddddddddd',
];

function sprite(cv: HTMLCanvasElement, map: string[], pal: Record<string, string | null>): void {
  const ctx = cv.getContext('2d')!;
  const n = map.length;
  const m = map[0]!.length;
  const s = Math.floor(Math.min(cv.width / m, cv.height / n)) || 1;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cv.width, cv.height);
  const ox = Math.floor((cv.width - m * s) / 2);
  const oy = Math.floor((cv.height - n * s) / 2);
  for (let y = 0; y < n; y++) {
    const row = map[y]!;
    for (let x = 0; x < m; x++) {
      const c = pal[row[x]!];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(ox + x * s, oy + y * s, s, s);
    }
  }
}

class Pain implements World {
  readonly id = 'pain' as const;
  readonly look = LOOKS.pain;

  private section!: HTMLElement;
  private layer: ShaderLayer | null = null;
  private job: Job | null = null;
  private physJob: Job | null = null;
  private parJob: Job | null = null;

  private torch = { x: 0.5, y: 0.45, tx: 0.5, ty: 0.45 };
  /* Cached section geometry: read on resize, never inside a tick. */
  private box = { top: 0, h: 1 };
  private parallax: { node: HTMLElement; k: number }[] = [];

  private engine: Matter.Engine | null = null;
  private glassCv: HTMLCanvasElement | null = null;
  private glassCtx: CanvasRenderingContext2D | null = null;
  private bodies: { body: Matter.Body; w: number; h: number; c: string }[] = [];

  private hits = 0;
  private leak = 0;
  private shownLeak = 0;
  private struck: string[] = [];

  mount(section: HTMLElement): void {
    this.section = section;
    this.buildBlocks();
    this.buildParallax();
    this.buildGlass();

    const bg = need<HTMLCanvasElement>('#painBg', section);
    if (quality.gl) {
      this.layer = new ShaderLayer({
        canvas: bg, frag: FRAG, alpha: false, dpr: () => quality.shaderDpr(),
        uniforms: {
          uTorch: () => [this.torch.x, 1 - this.torch.y],
          uWarm: () => (quality.tier === 'low' ? 0.4 : 1),
        },
      });
    }
    if (!this.layer?.ok) {
      bg.style.display = 'none';
      section.style.background = 'radial-gradient(70% 50% at 50% 40%, #17202f, #0b1019 70%)';
    }

    if (!quality.coarse) {
      section.addEventListener('pointermove', this.onPointer, { passive: true });
    }

    const measure = (): void => {
      this.box = { top: section.offsetTop, h: Math.max(1, section.offsetHeight) };
    };
    clock.once(measure);

    this.job = clock.add(({ t, k, y, vh }) => {
      /* On a phone the torch follows the scroll — there is no cursor to move. */
      if (quality.coarse) {
        const r = (y + vh * 0.5 - this.box.top) / this.box.h;
        this.torch.tx = 0.5 + Math.sin(r * 6.2) * 0.16;
        this.torch.ty = clamp(r, 0.1, 0.9);
      }
      this.torch.x = damp(this.torch.x, this.torch.tx, 0.12, k);
      this.torch.y = damp(this.torch.y, this.torch.ty, 0.12, k);
      this.layer?.draw(t / 1000);
    }, { always: true, resize: measure });
  }

  private onPointer = (e: PointerEvent): void => {
    this.torch.tx = clamp(e.clientX / window.innerWidth, 0, 1);
    this.torch.ty = clamp(e.clientY / window.innerHeight, 0, 1);
  };

  /* ——— the four blocks ——————————————————————————————————————————————— */
  private buildBlocks(): void {
    const host = need('#mBlocks', this.section);
    if (host.childElementCount) return;
    const coins = need('#mCoins', this.section);
    const leakEl = need('#mLeak', this.section);
    const sum = need('#mSum', this.section);

    PAIN.forEach((p) => {
      const cell = el('div', 'blkcell');
      cell.innerHTML =
        `<button class="blk" type="button" aria-label="Блок: ${esc(p.k)}"><canvas width="128" height="128" aria-hidden="true"></canvas></button>` +
        `<p class="blk__say"><b>${esc(p.k)}</b>${esc(p.say)}</p>`;
      host.appendChild(cell);
      const btn = cell.querySelector<HTMLButtonElement>('.blk')!;
      const cv = cell.querySelector('canvas')!;
      sprite(cv, QBLOCK, PAL);

      btn.addEventListener('click', () => {
        if (cell.classList.contains('is-done')) return;
        cell.classList.add('is-done');
        btn.classList.add('is-hit');
        window.setTimeout(() => btn.classList.remove('is-hit'), 320);
        sprite(cv, UBLOCK, PAL);
        audio.bump();
        window.setTimeout(() => audio.coin(), 60);

        this.hits++;
        this.leak += p.v;
        this.struck.push(p.k);
        store.set('pain.hit', this.struck);
        store.set('pain.leak', this.leak);
        coins.textContent = `×${String(this.hits).padStart(2, '0')}`;
        this.countTo(leakEl, this.leak);
        this.dropBlock(p.v);

        if (this.hits === PAIN.length) {
          window.setTimeout(() => {
            sum.classList.add('is-in');
            audio.clear();
            window.setTimeout(() => scroll.ensureVisible(sum), 260);
          }, 620);
        }
      });
    });
    invite($$('.blk', host));
  }

  private countTo(node: HTMLElement, to: number): void {
    const from = this.shownLeak;
    const t0 = performance.now();
    const step = (): void => {
      const p = clamp((performance.now() - t0) / 620, 0, 1);
      const v = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      node.textContent = `${v.toLocaleString('ru-RU')} тыс ₽/мес`;
      if (p < 1) clock.once(step); else this.shownLeak = to;
    };
    step();
  }

  /* ——— the glass ————————————————————————————————————————————————————— */
  private buildGlass(): void {
    this.glassCv = need<HTMLCanvasElement>('#painGlassC', this.section);
    this.glassCtx = this.glassCv.getContext('2d');
    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1.1, scale: 0.001 } });
    this.engine = engine;

    const build = (): void => {
      if (!this.glassCv) return;
      fit(this.glassCv, Math.min(quality.dpr, 1.5));
      const w = this.glassCv.width;
      const h = this.glassCv.height;
      Matter.Composite.clear(engine.world, false, true);
      const wall = (x: number, y: number, ww: number, hh: number): Matter.Body =>
        Matter.Bodies.rectangle(x, y, ww, hh, { isStatic: true });
      Matter.Composite.add(engine.world, [
        wall(w / 2, h + 20, w, 40),
        wall(-20, h / 2, 40, h * 2),
        wall(w + 20, h / 2, 40, h * 2),
      ]);
      this.bodies = [];
    };
    build();

    this.physJob = clock.add(({ dt }) => {
      if (!this.engine || !this.glassCtx || !this.glassCv) return;
      /* Fixed-ish step, clamped: matter integrates badly on a long frame and a
         block tunnelling through the floor is not a look. */
      Matter.Engine.update(this.engine, Math.min(dt * 1000, 24));
      this.paintGlass();
    }, { always: true, resize: build });
  }

  private dropBlock(value: number): void {
    if (!this.engine || !this.glassCv) return;
    const w = this.glassCv.width;
    const size = Math.max(14, (w / 6) * clamp(value / 120, 0.55, 1));
    const body = Matter.Bodies.rectangle(w * (0.25 + Math.random() * 0.5), -size, size, size, {
      restitution: 0.18, friction: 0.6, angle: (Math.random() - 0.5) * 0.6,
    });
    Matter.Composite.add(this.engine.world, body);
    this.bodies.push({ body, w: size, h: size, c: '#f8d548' });
  }

  private paintGlass(): void {
    const c = this.glassCtx!;
    const cv = this.glassCv!;
    c.clearRect(0, 0, cv.width, cv.height);
    c.strokeStyle = 'rgba(248,213,72,.14)';
    c.lineWidth = 1;
    for (let y = cv.height; y > 0; y -= cv.height / 8) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(cv.width, y); c.stroke();
    }
    for (const b of this.bodies) {
      const { position: p, angle } = b.body;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(angle);
      c.fillStyle = b.c;
      c.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      c.fillStyle = 'rgba(255,255,255,.28)';
      c.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * 0.16);
      c.fillStyle = 'rgba(0,0,0,.34)';
      c.fillRect(-b.w / 2, b.h * 0.34, b.w, b.h * 0.16);
      c.restore();
    }
  }

  /* ——— four layers of scenery ————————————————————————————————————————— */
  private buildParallax(): void {
    const host = need('#painPar', this.section);
    if (host.childElementCount) { return; }
    const spec: [number, number, number, number, string][] = [
      [4, 62, 220, 0.04, 'rgba(120,150,200,.10)'],
      [70, 58, 320, 0.09, 'rgba(110,140,190,.12)'],
      [26, 74, 180, 0.16, 'rgba(90,120,170,.16)'],
      [86, 80, 260, 0.24, 'rgba(70,100,150,.2)'],
    ];
    for (const [left, top, w, k, colour] of spec) {
      const node = el('i');
      node.style.cssText =
        `left:${left}%;top:${top}%;width:${w}px;height:${Math.round(w * 0.42)}px;` +
        `color:${colour};border-radius:6px 6px 0 0`;
      host.appendChild(node);
      this.parallax.push({ node, k });
    }
    this.parJob = clock.add(({ y }) => {
      const rel = y - this.box.top;
      for (const p of this.parallax) {
        p.node.style.transform = `translate3d(${(-rel * p.k).toFixed(1)}px,0,0)`;
      }
    });
  }

  pause(): void {
    for (const j of [this.job, this.physJob, this.parJob]) if (j) j.live = false;
  }

  resume(): void {
    for (const j of [this.job, this.physJob, this.parJob]) if (j) { j.live = true; j.dirty = true; }
  }

  unmount(): void {
    this.section.removeEventListener('pointermove', this.onPointer);
    for (const j of [this.job, this.physJob, this.parJob]) if (j) clock.remove(j);
    this.job = this.physJob = this.parJob = null;
    this.layer?.destroy();
    this.layer = null;
    if (this.engine) { Matter.Engine.clear(this.engine); this.engine = null; }
    this.bodies = [];
  }
}

let instance: Pain | null = null;
export function create(): World { instance ??= new Pain(); return instance; }
