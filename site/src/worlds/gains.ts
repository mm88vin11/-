/**
 * 07 · РАССВЕТ — the door in the fog, and the map.
 *
 * Rebuilt. The old section leaned on recognising a character we are not
 * allowed to show, so it was neither the reference nor a scene of its own.
 * The fix was to move the weight off the character and onto the moment: fog
 * over water at dawn, a wooden door standing on its own with no walls, and an
 * ordinary person with a mug coming out of it. Surreal enough to hold you, and
 * nobody's intellectual property.
 *
 * Underneath it, the map. The previous build ran a marquee of city names,
 * which read as a ticker rather than as a map. Now the sheet starts blank and
 * the ink spreads as you type the phrase — SVG paths with an animated
 * stroke-dashoffset, which is cheap to the point of being free and looks like
 * it cost something. Anyone who does not want to type gets a button.
 */
import type { World } from '../core/world';
import { LOOKS } from '../core/world';
import { clock, type Job } from '../core/ticker';
import { quality } from '../core/quality';
import { audio } from '../core/audio-bus';
import { ShaderLayer, GLSL_HEAD } from '../core/gl';
import { clamp, damp, el, esc, need } from '../core/dom';
import { MAP_CITIES, MAP_PHRASE, TEAM, GIFTS } from '../data/content';

const FRAG = `${GLSL_HEAD('mediump')}
uniform vec2 uMouse;
uniform float uOpen;
uniform float uRich;
void main(){
  vec2 p = (gl_FragCoord.xy - uRes * 0.5) / uRes.y;
  vec2 uv = vUv;

  /* Morning over water: two fbm layers at different speeds, the near one
     drifting twice as fast as the far one, which is what reads as volume. */
  float far  = fbm2(p * 1.3 + vec2(uTime * 0.010, uTime * 0.004));
  /* The near layer is the second half of the cost of this shader. Above the
     top tier one layer of drift reads as fog perfectly well, so the second is
     folded into the first rather than sampled. */
  float near = uRich > 0.5
    ? fbm2(p * 2.6 - vec2(uTime * 0.021, 0.0))
    : far * 0.8;

  /* The fog parts around the pointer. This is the only reason to do fog as a
     shader rather than as two PNGs. */
  vec2 m = (uMouse - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float push = exp(-distance(p, m) * 5.0);
  near *= 1.0 - push * 0.85;
  far  *= 1.0 - push * 0.4;

  vec3 water = vec3(0.086, 0.145, 0.098);
  vec3 grass = vec3(0.152, 0.219, 0.129);
  vec3 sky   = vec3(0.545, 0.639, 0.462);
  vec3 sun   = vec3(1.0, 0.902, 0.639);

  float horizon = smoothstep(-0.06, 0.30, p.y);
  vec3 col = mix(water, sky, horizon);
  col = mix(col, grass, smoothstep(0.05, -0.35, p.y) * 0.6);

  /* Low sun behind the door, warming as it opens. */
  float d = distance(p, vec2(0.0, 0.16));
  col += sun * smoothstep(0.9, 0.0, d) * (0.10 + uOpen * 0.22);

  col = mix(col, vec3(0.847, 0.905, 0.764), far * 0.26 + near * 0.20);
  outColor = vec4(col, 1.0);
}`;

class Gains implements World {
  readonly id = 'gains' as const;
  readonly look = LOOKS.gains;

  private section!: HTMLElement;
  private layer: ShaderLayer | null = null;
  private job: Job | null = null;
  private mouse = { x: 0.5, y: 0.6, tx: 0.5, ty: 0.6 };
  private open = 0;
  private openTarget = 0;
  private steps = 0;
  private inkPaths: SVGPathElement[] = [];
  private trackPaths: SVGPathElement[] = [];
  private typed = 0;
  private revealed = false;

  mount(section: HTMLElement): void {
    this.section = section;
    const cv = need<HTMLCanvasElement>('#fogC', section);
    if (quality.gl && !quality.reducedMotion) {
      this.layer = new ShaderLayer({
        canvas: cv, frag: FRAG, alpha: false, dpr: () => quality.shaderDpr(),
        uniforms: {
          uMouse: () => [this.mouse.x, this.mouse.y],
          uOpen: () => this.open,
          uRich: () => (quality.tier === 'high' ? 1 : 0),
        },
      });
    }
    if (!this.layer?.ok) {
      cv.style.display = 'none';
      section.style.background = 'linear-gradient(#5c7a4a, #1d2b1e 60%)';
    }

    section.addEventListener('pointermove', this.onPointer, { passive: true });
    this.buildTeam();
    this.buildGifts();
    this.buildMap();

    this.job = clock.add(({ t, k }) => {
      this.mouse.x = damp(this.mouse.x, this.mouse.tx, 0.1, k);
      this.mouse.y = damp(this.mouse.y, this.mouse.ty, 0.1, k);
      this.open = damp(this.open, this.openTarget, 0.08, k);
      this.section.style.setProperty('--open', this.open.toFixed(3));
      /* The tracks walk between the cities once the map is out, and stop dead
         while a city card is open — the brief's "следы замирают". */
      if (this.revealed && !this.freeze) {
        this.steps = (this.steps + k * 0.6) % 24;
        for (const p of this.trackPaths) p.style.strokeDashoffset = String(-this.steps);
      }
      this.layer?.draw(t / 1000);
    }, { always: true });
  }

  private onPointer = (e: PointerEvent): void => {
    this.mouse.tx = clamp(e.clientX / window.innerWidth, 0, 1);
    this.mouse.ty = clamp(1 - e.clientY / window.innerHeight, 0, 1);
  };

  /** The door opens with the scroll; the figure comes out of it. */
  progress(p: number): void {
    this.openTarget = clamp((p - 0.12) / 0.26, 0, 1);
    if (this.openTarget > 0.98 && !this.creaked) { this.creaked = true; audio.whoosh(true); }
  }
  private creaked = false;

  private buildTeam(): void {
    const host = need('#team', this.section);
    if (host.childElementCount) return;
    host.innerHTML = TEAM.map((t) => `<li><b>${esc(t.n)}</b><p>${esc(t.p)}</p></li>`).join('');
  }

  private buildGifts(): void {
    const host = need('#gifts', this.section);
    if (host.childElementCount) return;
    host.innerHTML = GIFTS.map((g, i) =>
      `<li><i>${String(i + 1).padStart(2, '0')}</i><span><b>${esc(g.n)}</b><p>${esc(g.p)}</p></span></li>`).join('');
  }

  /* ────────────────────────────────────────────────────────── the map ── */
  private buildMap(): void {
    const svg = need<SVGSVGElement>('#mapInk', this.section) as unknown as SVGSVGElement;
    if (svg.childElementCount) return;
    const pins = need('#mapPins', this.section);
    const input = need<HTMLInputElement>('#mapInput', this.section);
    const prog = need('#mapProg', this.section);
    const hint = need('#mapHint', this.section);
    const W = 1000;
    const H = 560;

    const NS = 'http://www.w3.org/2000/svg';
    /* One route through the cities, in order, with a hand-drawn wobble so it
       reads as ink rather than as a chart. */
    for (let i = 0; i < MAP_CITIES.length - 1; i++) {
      const a = MAP_CITIES[i]!;
      const b = MAP_CITIES[i + 1]!;
      const x1 = a.x * W;
      const y1 = a.y * H;
      const x2 = b.x * W;
      const y2 = b.y * H;
      const mx = (x1 + x2) / 2 + Math.sin(i * 2.3) * 60;
      const my = (y1 + y2) / 2 + Math.cos(i * 1.7) * 50;
      const d = `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`;

      const ink = document.createElementNS(NS, 'path');
      ink.setAttribute('d', d);
      svg.appendChild(ink);
      const len = ink.getTotalLength ? ink.getTotalLength() : 400;
      ink.style.setProperty('--len', String(len));
      this.inkPaths.push(ink);

      /* Boot prints: a second copy of the same path, dashed short, offset on
         the ticker. Same geometry, no second draw of anything expensive. */
      const track = document.createElementNS(NS, 'path');
      track.setAttribute('d', d);
      track.setAttribute('stroke', 'rgba(74,48,24,.5)');
      track.setAttribute('stroke-width', '3');
      track.setAttribute('stroke-dasharray', '2 22');
      track.setAttribute('stroke-linecap', 'round');
      track.setAttribute('fill', 'none');
      track.style.opacity = '0';
      svg.appendChild(track);
      this.trackPaths.push(track);
    }

    const card = el('div', 'map__card');
    pins.appendChild(card);
    for (const c of MAP_CITIES) {
      const pin = el('button', 'map__pin');
      pin.type = 'button';
      pin.style.left = `${c.x * 100}%`;
      pin.style.top = `${c.y * 100}%`;
      pin.innerHTML = `<i></i><u>${esc(c.city)}</u>`;
      pin.setAttribute('aria-label', `${c.city}: было ${c.was}, стало ${c.now}`);
      const show = (): void => {
        card.innerHTML = `<b>${esc(c.city)}</b><br>было: ${esc(c.was)}<br>стало: ${esc(c.now)}`;
        card.style.left = `${c.x * 100}%`;
        card.style.top = `${c.y * 100}%`;
        card.classList.add('is-on');
        this.freeze = true;
      };
      const hide = (): void => { card.classList.remove('is-on'); this.freeze = false; };
      pin.addEventListener('pointerenter', show);
      pin.addEventListener('focus', show);
      pin.addEventListener('pointerleave', hide);
      pin.addEventListener('blur', hide);
      pins.appendChild(pin);
    }

    const setProgress = (n: number): void => {
      this.typed = n;
      const p = clamp(n / MAP_PHRASE.length, 0, 1);
      for (const path of this.inkPaths) path.style.setProperty('--p', String(p));
      prog.textContent = p >= 1 ? 'Шалость удалась.' : `${Math.round(p * 100)}% чернил`;
      if (p >= 1 && !this.revealed) this.reveal();
    };

    input.addEventListener('input', () => {
      /* Progress follows how much of the phrase is actually right, so mashing
         the keyboard does not open the map. */
      const v = input.value;
      let ok = 0;
      while (ok < v.length && ok < MAP_PHRASE.length &&
             v[ok]!.toLowerCase() === MAP_PHRASE[ok]!.toLowerCase()) ok++;
      if (ok > this.typed) audio.click();
      setProgress(ok);
      hint.style.opacity = String(1 - clamp(ok / 12, 0, 1));
    });

    need('#mapSkip', this.section).addEventListener('click', () => { setProgress(MAP_PHRASE.length); });
    setProgress(0);
  }

  private freeze = false;

  private reveal(): void {
    this.revealed = true;
    for (const p of this.trackPaths) p.style.opacity = '1';
    for (const pin of Array.from(this.section.querySelectorAll('.map__pin'))) {
      pin.classList.add('is-on');
    }
    audio.clear();
  }

  pause(): void { if (this.job) this.job.live = false; }
  resume(): void { if (this.job) { this.job.live = true; this.job.dirty = true; } }

  unmount(): void {
    this.section.removeEventListener('pointermove', this.onPointer);
    if (this.job) clock.remove(this.job);
    this.job = null;
    this.layer?.destroy();
    this.layer = null;
  }
}

let instance: Gains | null = null;
export function create(): World { instance ??= new Gains(); return instance; }
