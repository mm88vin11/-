/**
 * 10 · ИЗНАНКА — the other side of the floor.
 *
 * Not an inverted colour scheme: a look. Blue fog, three hundred drifting
 * spores, tendrils feeling in from the edges as a shader vignette, a little
 * chromatic split and grain, and a slow horizontal wave through the text that
 * distorts without ever making it unreadable — contrast here is checked like
 * everywhere else.
 *
 * The graveyard is real refusals with the reason written on the slab, because
 * the reason is the useful half.
 */
import type { World } from '../core/world';
import { LOOKS } from '../core/world';
import { clock, type Job } from '../core/ticker';
import { quality } from '../core/quality';
import { audio } from '../core/audio-bus';
import { ShaderLayer, GLSL_HEAD } from '../core/gl';
import { $$, el, esc, need } from '../core/dom';
import { copy, toast } from '../ui/toast';
import { store } from '../ui/store';
import { GRAVES, NOPE_LINES, CODE_WORD } from '../data/content';

const FRAG = `${GLSL_HEAD('mediump')}
uniform float uSpores;
void main(){
  vec2 uv = vUv;
  vec2 p = (gl_FragCoord.xy - uRes * 0.5) / uRes.y;

  vec3 col = vec3(0.031, 0.043, 0.070);
  float haze = fbm2(p * 1.7 + vec2(uTime * 0.008, uTime * 0.013));
  col += vec3(0.05, 0.11, 0.20) * haze * 0.55;

  /* Tendrils: a noisy vignette that reaches in from the edges rather than a
     clean radial one, so the frame feels grown rather than drawn. */
  float r = length(p * vec2(0.72, 1.0));
  float tendril = fbm2(vec2(atan(p.y, p.x) * 2.4, r * 3.0 - uTime * 0.05));
  float vig = smoothstep(0.42, 1.05, r + tendril * 0.22);
  col = mix(col, vec3(0.004, 0.008, 0.020), vig);

  /* Spores, as a field rather than as objects: three layers of dots drifting
     up at different speeds. Three hundred of them cost one instruction each. */
  float s = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 q = p * (6.0 + fi * 5.0) + vec2(fi * 3.1, -uTime * (0.05 + fi * 0.04));
    vec2 cell = floor(q);
    vec2 f = fract(q) - 0.5;
    float rr = hash(cell + fi * 17.0);
    float d = length(f - vec2(sin(rr * 6.2 + uTime * 0.3) * 0.25, 0.0));
    s += smoothstep(0.09 + rr * 0.05, 0.0, d) * (0.35 + rr * 0.65);
  }
  col += vec3(0.60, 0.80, 1.0) * s * 0.16 * uSpores;

  /* A touch of chromatic split at the edges, and grain. */
  float ca = vig * 0.06;
  col.r *= 1.0 + ca;
  col.b *= 1.0 - ca * 0.6;
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.03;

  outColor = vec4(col, 1.0);
}`;

const AZ = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'.split('');
const BULB = ['#ffcf6a', '#ff7a5c', '#7ad1ff', '#9dff8a', '#ff9de0'];

class Basement implements World {
  readonly id = 'basement' as const;
  readonly look = LOOKS.basement;

  private section!: HTMLElement;
  private layer: ShaderLayer | null = null;
  private job: Job | null = null;
  private wireJob: Job | null = null;
  private cells: HTMLElement[] = [];
  /* The headings this world bends. Six elements, transform only. */
  private waved: HTMLElement[] = [];
  private running = false;
  private pressed = 0;

  mount(section: HTMLElement): void {
    this.section = section;
    const cv = need<HTMLCanvasElement>('#udAir', section);
    if (quality.gl && !quality.reducedMotion) {
      this.layer = new ShaderLayer({
        canvas: cv, frag: FRAG, alpha: false, dpr: quality.shaderDpr(),
        uniforms: { uSpores: () => (quality.tier === 'high' ? 1 : 0.5) },
      });
    }
    if (!this.layer?.ok) {
      cv.style.display = 'none';
      section.style.background = 'radial-gradient(80% 60% at 50% 30%, #12203a, #080b12 70%)';
    }

    this.buildGraves();
    this.buildWall();
    this.buildNope();

    /* "Тексты читаются, но искажены." A horizontal wave across the section,
       small enough that every line stays legible — which matters here more
       than the effect does, because the code word lives in this section.
       Transform on six elements rather than a displacement filter over the
       whole thing: a filter on live text is the most expensive way to do this
       and the least readable. */
    this.waved = $$('.uni__head h2, .ud__ttl, .ud__gift h3, .ud__code, .wall__read, .graves b', section).slice(0, 6);

    this.job = clock.add(({ t }) => {
      this.layer?.draw(t / 1000);
      if (quality.reducedMotion) return;
      for (let i = 0; i < this.waved.length; i++) {
        const node = this.waved[i]!;
        const dx = Math.sin(t * 0.0009 + i * 1.7) * 2.6 + Math.sin(t * 0.0021 + i * 0.6) * 1.1;
        node.style.transform = `translate3d(${dx.toFixed(2)}px,0,0)`;
      }
    }, { always: true });
  }

  private buildGraves(): void {
    const host = need('#graves', this.section);
    if (host.childElementCount) return;
    host.innerHTML = GRAVES.map((g) =>
      `<li><b>${esc(g.n)}</b><p>${esc(g.p)}</p><i>${esc(g.why)}</i></li>`).join('');
  }

  private buildWall(): void {
    const row = need('#wallRow', this.section);
    const wire = need<SVGSVGElement>('#wallWire', this.section) as unknown as SVGSVGElement;
    const read = need('#wallRead', this.section);
    const code = need('#udCode', this.section);

    if (!row.childElementCount) {
      AZ.forEach((ch, i) => {
        const d = el('span', 'ltr', `<b>${ch}</b>`);
        d.style.setProperty('--bulb', BULB[i % BULB.length]!);
        row.appendChild(d);
      });
    }
    this.cells = $$('.ltr', row);

    /* The wire is drawn after layout so it sags between the bulbs it actually
       hangs from, rather than being a squiggle behind them. */
    const drawWire = (): void => {
      const r = row.getBoundingClientRect();
      if (!r.width) return;
      wire.setAttribute('viewBox', `0 0 ${Math.round(r.width)} ${Math.round(r.height)}`);
      wire.style.width = `${r.width}px`;
      wire.style.height = `${r.height}px`;
      const pts = this.cells.map((c) => {
        const cr = c.getBoundingClientRect();
        return [cr.left - r.left + cr.width / 2, cr.top - r.top + 5] as const;
      });
      let d = '';
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!;
        const b = pts[i + 1]!;
        if (Math.abs(b[1] - a[1]) > 20) { d += `M${a[0]} ${a[1]}`; continue; }
        const mx = (a[0] + b[0]) / 2;
        const my = Math.max(a[1], b[1]) + 9;
        d += `${i === 0 || !d ? `M${a[0]} ${a[1]}` : ''}Q${mx} ${my} ${b[0]} ${b[1]}`;
      }
      wire.innerHTML = `<path d="${d}" fill="none" stroke="rgba(207,220,232,.2)" stroke-width="1.4"/>`;
    };
    clock.once(drawWire);
    /* Held so it can be disposed: a job added on every mount and never removed
       is a leak that only shows up after the third scroll past a section. */
    this.wireJob ??= clock.add(() => { /* redraw only on resize */ }, { resize: drawWire });

    need('#wallGo', this.section).addEventListener('click', () => {
      if (this.running) return;
      this.running = true;
      this.cells.forEach((c) => c.classList.remove('is-lit'));
      read.textContent = '';
      let i = 0;
      const next = (): void => {
        if (i >= CODE_WORD.length) {
          this.running = false;
          code.textContent = CODE_WORD;
          audio.clear();
          store.set('basement.code', CODE_WORD);
          return;
        }
        const idx = AZ.indexOf(CODE_WORD[i]!);
        if (idx >= 0) this.cells[idx]?.classList.add('is-lit');
        read.textContent += CODE_WORD[i];
        audio.click();
        i++;
        window.setTimeout(next, quality.reducedMotion ? 0 : 460);
      };
      next();
    });

    need('#udCopy', this.section).addEventListener('click', () => copy(CODE_WORD, 'Кодовое слово скопировано'));
  }

  private buildNope(): void {
    const nope = need('#nope', this.section);
    const read = need('#wallRead', this.section);
    nope.addEventListener('click', () => {
      toast(NOPE_LINES[Math.min(this.pressed, NOPE_LINES.length - 1)]!);
      audio.bump();
      this.pressed++;
      store.bump('basement.nope');
      if (this.pressed === 3) {
        this.cells.forEach((c, i) => window.setTimeout(() => c.classList.add('is-lit'), i * 40));
        read.textContent = 'ВСЁ СРАЗУ';
      }
      if (this.pressed >= 4) {
        this.section.style.transition = 'transform 900ms cubic-bezier(.16,.84,.24,1)';
        this.section.style.transform = 'rotate(180deg)';
        window.setTimeout(() => { this.section.style.transform = ''; }, 2400);
      }
    });
  }

  pause(): void { for (const j of [this.job, this.wireJob]) if (j) j.live = false; }
  resume(): void { for (const j of [this.job, this.wireJob]) if (j) { j.live = true; j.dirty = true; } }

  unmount(): void {
    for (const j of [this.job, this.wireJob]) if (j) clock.remove(j);
    this.job = this.wireJob = null;
    for (const node of this.waved) node.style.transform = '';
    this.waved = [];
    this.layer?.destroy();
    this.layer = null;
  }
}

let instance: Basement | null = null;
export function create(): World { instance ??= new Basement(); return instance; }
