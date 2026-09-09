/**
 * 02 · ПРАВДА — the rain, and the six seconds where nothing was decided.
 *
 * The rain is one fragment shader over one triangle. The previous build drew it
 * as canvas 2D, glyph by glyph, and it was the section that cost the most: a
 * thousand `fillText` calls a frame, each one a separate rasterisation. Here
 * the glyphs are procedural — a 4×5 dot matrix per cell, switched by a hash of
 * (column, row, time) — so the whole storm is a single draw call and the shape
 * of a symbol costs nothing.
 *
 * The cursor is part of it: columns near the pointer are pushed aside and lit,
 * which is the one interaction that makes the rain feel like a place rather
 * than a wallpaper.
 */
import type { World } from '../core/world';
import { LOOKS } from '../core/world';
import { clock, type Job } from '../core/ticker';
import { quality } from '../core/quality';
import { audio } from '../core/audio-bus';
import { ShaderLayer, GLSL_HEAD } from '../core/gl';
import { $$, clamp, damp, el, esc, need } from '../core/dom';
import { invite, toast } from '../ui/toast';
import { scroll } from '../core/scroll';
import { store } from '../ui/store';
import { MX_QUESTIONS, BLUE_PILL_TEXT } from '../data/content';

const FRAG = `${GLSL_HEAD('mediump')}
uniform vec2 uMouse;
uniform float uSpeed;
uniform float uGrey;

/* One glyph: a 4×5 dot matrix, switched by a hash of cell and time. */
float glyph(vec2 uv, float seed){
  vec2 g = floor(uv * vec2(4.0, 5.0));
  if (g.x < 0.0 || g.x > 3.0 || g.y < 0.0 || g.y > 4.0) return 0.0;
  float id = hash(g + seed * 37.0);
  return step(0.55, id);
}

void main(){
  vec2 res = uRes;
  float cell = max(12.0, res.y / 34.0);
  vec2 uv = gl_FragCoord.xy;

  /* Columns bend away from the pointer and brighten as they pass it. */
  vec2 m = uMouse * res;
  float dx = (uv.x - m.x) / (res.x * 0.16);
  float dy = (uv.y - m.y) / (res.y * 0.28);
  float near = exp(-(dx * dx + dy * dy));
  uv.x += sign(dx) * near * cell * 1.4;

  vec2 cid = floor(uv / cell);
  vec2 local = fract(uv / cell);

  float colSeed = hash(vec2(cid.x, 7.0));
  float speed = (0.35 + colSeed * 0.9) * uSpeed;
  float head = fract(colSeed * 13.0 + uTime * speed * 0.08) * (res.y / cell + 22.0) - 11.0;
  float rowFromHead = head - (res.y / cell - cid.y);

  /* The tail: bright at the head, fading over ~16 cells. */
  float tail = clamp(1.0 - rowFromHead / 16.0, 0.0, 1.0) * step(0.0, rowFromHead);
  float isHead = smoothstep(1.2, 0.0, abs(rowFromHead));

  float g = glyph(local, floor(cid.x * 31.0 + cid.y * 7.0 + floor(uTime * 6.0 * uSpeed)));
  float lum = g * (tail * 0.55 + isHead * 1.0);
  lum += near * g * tail * 0.9;

  vec3 green = vec3(0.20, 1.0, 0.52);
  vec3 white = vec3(0.85, 1.0, 0.92);
  vec3 col = mix(green, white, isHead * 0.85 + near * 0.4) * lum;
  col = mix(col, vec3(dot(col, vec3(0.33))), uGrey);
  outColor = vec4(col, lum * 0.92);
}`;

class Truth implements World {
  readonly id = 'truth' as const;
  readonly look = LOOKS.truth;

  private section!: HTMLElement;
  private layer: ShaderLayer | null = null;
  private job: Job | null = null;
  private mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  private speed = 1;
  private speedTarget = 1;
  private grey = 0;
  private greyTarget = 0;
  private picks: Record<string, string | string[]> = {};

  mount(section: HTMLElement): void {
    this.section = section;
    const cv = need<HTMLCanvasElement>('#mxRain', section);

    if (quality.gl && !quality.reducedMotion) {
      this.layer = new ShaderLayer({
        canvas: cv, frag: FRAG, dpr: quality.shaderDpr(),
        uniforms: {
          uMouse: () => [this.mouse.x, this.mouse.y],
          uSpeed: () => this.speed,
          uGrey: () => this.grey,
        },
      });
    }
    if (!this.layer?.ok) cv.style.display = 'none';

    section.addEventListener('pointermove', this.onPointer, { passive: true });

    this.buildPills();
    this.buildQuestions();

    this.job = clock.add(({ t, k }) => {
      this.mouse.x = damp(this.mouse.x, this.mouse.tx, 0.14, k);
      this.mouse.y = damp(this.mouse.y, this.mouse.ty, 0.14, k);
      this.speed = damp(this.speed, this.speedTarget, 0.06, k);
      this.grey = damp(this.grey, this.greyTarget, 0.08, k);
      this.layer?.draw(t / 1000);
    }, { always: true });
  }

  /* Against the viewport rather than the section: the shader draws in viewport
     space anyway, and a getBoundingClientRect per pointer move is a layout per
     pointer move. */
  private onPointer = (e: PointerEvent): void => {
    this.mouse.tx = clamp(e.clientX / window.innerWidth, 0, 1);
    this.mouse.ty = clamp(1 - e.clientY / window.innerHeight, 0, 1);
  };

  /* ——— the choice, with feedback before the click ————————————————————— */
  private buildPills(): void {
    const blue = need<HTMLButtonElement>('#pillBlue', this.section);
    const red = need<HTMLButtonElement>('#pillRed', this.section);
    const typeEl = need('#mxType', this.section);
    const again = need('#mxAgain', this.section);

    /* Hovering a pill changes the weather. The feedback arrives before the
       decision does, which is the whole trick of the section. */
    red.addEventListener('pointerenter', () => { this.speedTarget = 2.4; });
    red.addEventListener('pointerleave', () => { this.speedTarget = 1; });
    blue.addEventListener('pointerenter', () => { this.speedTarget = 0.35; this.greyTarget = 0.7; });
    blue.addEventListener('pointerleave', () => { this.speedTarget = 1; this.greyTarget = 0; });

    if (!quality.coarse) {
      for (const p of [blue, red]) {
        p.addEventListener('pointermove', (e) => {
          const r = p.getBoundingClientRect();
          const dx = (e.clientX - r.left) / r.width - 0.5;
          const dy = (e.clientY - r.top) / r.height - 0.5;
          p.style.transform = `rotateY(${dx * 12}deg) rotateX(${-dy * 12}deg) translateY(-3px)`;
        });
        p.addEventListener('pointerleave', () => { p.style.transform = ''; });
      }
    }
    invite([blue, red]);

    blue.addEventListener('click', () => {
      this.section.classList.remove('is-red');
      this.section.classList.add('is-blue');
      this.speedTarget = 0.3;
      this.greyTarget = 1;
      typeEl.textContent = '';
      let i = 0;
      const step = (): void => {
        typeEl.textContent = BLUE_PILL_TEXT.slice(0, ++i);
        if (i < BLUE_PILL_TEXT.length) window.setTimeout(step, quality.reducedMotion ? 0 : 26);
      };
      step();
      this.greyOut();
    });

    again.addEventListener('click', () => red.click());

    red.addEventListener('click', () => {
      this.section.classList.remove('is-blue');
      this.section.classList.add('is-red');
      this.speedTarget = 2.6;
      this.greyTarget = 0;
      window.setTimeout(() => { this.speedTarget = 1.2; }, 900);
      audio.spark();
    });
  }

  /** Six seconds of the version where nothing was decided. */
  private greyOut(): void {
    if (quality.reducedMotion) { toast('Ничего не изменилось. В этом и мысль.'); return; }
    const root = document.documentElement;
    root.classList.add('is-grey');
    audio.setPitch(0.72);
    window.setTimeout(() => {
      root.classList.remove('is-grey');
      audio.setPitch(1);
      toast('Так выглядит следующий вторник, если ничего не решить.');
    }, 6000);
  }

  /* ——— the funnel you draw yourself ————————————————————————————————————— */
  private buildQuestions(): void {
    const host = need('#mxQs', this.section);
    if (host.childElementCount) return;
    const out = need('#mxOut', this.section);
    const flow = need('#mxFlow', this.section);
    const verdict = need('#mxVerdict', this.section);

    for (const q of MX_QUESTIONS) {
      const wrap = el('div', 'mx__q',
        `<p>${esc(q.q)}${q.multi ? ' <em>отметьте все</em>' : ''}</p><div class="chips"></div>`);
      const box = wrap.querySelector<HTMLElement>('.chips')!;
      for (const o of q.opts) {
        const b = el('button', 'chip');
        b.type = 'button';
        b.textContent = o;
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', () => {
          audio.click();
          if (q.multi) {
            const on = b.getAttribute('aria-pressed') === 'true';
            b.setAttribute('aria-pressed', on ? 'false' : 'true');
            this.picks[q.id] = $$('.chip[aria-pressed="true"]', box).map((x) => x.textContent ?? '');
          } else {
            $$('.chip', box).forEach((x) => x.setAttribute('aria-pressed', 'false'));
            b.setAttribute('aria-pressed', 'true');
            this.picks[q.id] = o;
          }
          this.render(out, flow, verdict);
        });
        box.appendChild(b);
      }
      host.appendChild(wrap);
    }
  }

  private render(out: HTMLElement, flow: HTMLElement, verdict: HTMLElement): void {
    const src = this.picks['src'] as string[] | undefined;
    const who = this.picks['who'] as string | undefined;
    const time = this.picks['time'] as string | undefined;
    const log = this.picks['log'] as string | undefined;
    if (!src?.length || !who || !time || !log) return;

    const first = !out.classList.contains('is-on');
    out.classList.add('is-on');
    if (first) window.setTimeout(() => scroll.ensureVisible(out), 220);

    /* The leak is wherever the answer is worst — that node gets marked. */
    const slowest = time === 'Минуты' ? 0 : time === 'Часы' ? 2 : 3;
    const lost = log === 'CRM' ? 0 : log === 'Таблица' ? 1 : 3;
    const thin = who === 'Я сам' ? 3 : who === 'Как получится' ? 3 : who === 'Никто до вечера' ? 4 : 1;
    const worst = Math.max(slowest, lost, thin);
    const leakIdx = worst === thin ? 1 : worst === slowest ? 2 : 3;

    const nodes = [
      { k: 'источник', v: src.join(', ') },
      { k: 'отвечает', v: who },
      { k: 'скорость', v: time },
      { k: 'след', v: log },
    ];
    flow.innerHTML = nodes.map((n, i) =>
      `<div class="mx__node${i === leakIdx ? ' mx__node--leak' : ''}">` +
      `<u>${i === leakIdx ? 'здесь течёт' : n.k}</u><b>${esc(n.v)}</b></div>`).join('');

    const say = leakIdx === 1
      ? 'Узкое место — <b>кто отвечает</b>. Пока первым отвечает человек, скорость ответа равна его расписанию, а не спросу.'
      : leakIdx === 2
        ? 'Узкое место — <b>скорость</b>. Заявка живёт минуты: за это время человек пишет ещё двоим и покупает у того, кто ответил первым.'
        : 'Узкое место — <b>след</b>. Если заявка живёт в переписке, её невозможно посчитать, а значит невозможно починить.';
    const many = src.length >= 3 ? ` Источников у вас ${src.length} — и каждый ведёт в отдельное окно.` : '';
    verdict.innerHTML = `${say}${many} Это не наша схема: вы её сейчас нарисовали сами, мы только записали.`;
    store.set('truth.leak', ['источник', 'кто отвечает', 'скорость ответа', 'след'][leakIdx] ?? '');
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

let instance: Truth | null = null;
export function create(): World { instance ??= new Truth(); return instance; }
