/**
 * 11 · ТИТРЫ — the crawl.
 *
 * Driven by scroll rather than by a fixed-duration keyframe, so the reader
 * sets the pace: a timed crawl either outruns you or stalls. The star field is
 * one shader — 190 DOM nodes for stars was the old build's way and each one was
 * a composited layer.
 *
 * Two of the credits are buttons: the bug counter really counts, and the circle
 * counter reports the attempts made in this tab at the portal upstairs.
 */
import type { World } from '../core/world';
import { LOOKS } from '../core/world';
import { clock, type Job } from '../core/ticker';
import { quality } from '../core/quality';
import { ShaderLayer, GLSL_HEAD } from '../core/gl';
import { clamp, need } from '../core/dom';
import { toast } from '../ui/toast';
import { store } from '../ui/store';

const FRAG = `${GLSL_HEAD('mediump')}
void main(){
  vec2 p = gl_FragCoord.xy / uRes.xy;
  vec3 col = vec3(0.004, 0.004, 0.011);
  /* Three layers of stars, each a grid of cells with one point in it. */
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 q = p * uRes / (110.0 - fi * 26.0);
    vec2 cell = floor(q);
    vec2 f = fract(q) - 0.5;
    float r = hash(cell + fi * 31.0);
    if (r < 0.72) continue;
    float d = length(f + vec2(r - 0.5, fract(r * 7.0) - 0.5) * 0.6);
    float tw = 0.6 + 0.4 * sin(uTime * 1.3 + r * 30.0);
    col += vec3(1.0) * smoothstep(0.055, 0.0, d) * tw * (0.35 + fi * 0.22);
  }
  outColor = vec4(col, 1.0);
}`;

class Credits implements World {
  readonly id = 'credits' as const;
  readonly look = LOOKS.credits;

  private layer: ShaderLayer | null = null;
  private job: Job | null = null;

  mount(section: HTMLElement): void {
    const cv = need<HTMLCanvasElement>('#stars', section);
    if (quality.gl) {
      this.layer = new ShaderLayer({ canvas: cv, frag: FRAG, alpha: false, dpr: () => quality.shaderDpr() });
    }
    if (!this.layer?.ok) { cv.style.display = 'none'; section.style.background = '#010103'; }

    const deck = need('#crawlDeck', section);
    const pre = need('#crawlPre', section);
    const post = need('#crawlPost', section);

    need('#bugN', section).textContent = String(store.get<number>('credits.bugs', 0));
    need('#circN', section).textContent = String(store.get<number>('portal.tries', 0));

    need('#eggBugs', section).addEventListener('click', () => {
      const n = store.bump('credits.bugs');
      need('#bugN', section).textContent = String(n);
      toast(n === 1 ? 'Ещё один. Спасибо, зачли.' : `Всего ${n}. Продолжайте, это помогает.`);
    });
    need('#eggCircles', section).addEventListener('click', () => {
      const n = store.get<number>('portal.tries', 0);
      toast(n === 0 ? 'Ни одного промаха. Подозрительно.' : `Кругов не получилось ${n} раз. Галерея — в вашей вкладке.`);
    });
    need('#eggNope', section).addEventListener('click', () => {
      const n = store.get<number>('basement.nope', 0);
      toast(n ? `Нажали ${n} раз. Мы всё видели.` : 'Вы её не нажимали. Уважаем.');
    });

    /* Geometry is read on resize and cached. Reading it inside the tick, after
       the tick has written a transform, forces a layout every frame. */
    let top = 0;
    let run = 1;
    let deckH = 800;
    const runway = section.querySelector<HTMLElement>('.crawl__runway');
    const measure = (): void => {
      top = section.offsetTop;
      run = (runway?.offsetHeight ?? section.offsetHeight) - window.innerHeight;
      deckH = deck.offsetHeight || 800;
    };
    clock.once(measure);

    this.job = clock.add(({ y, vh, t }) => {
      const p = clamp((y - top) / Math.max(1, run), 0, 1);
      /* Starts below the fold and leaves over the top, the way a crawl does —
         rather than starting already centred, which is where it was. */
      deck.style.setProperty('--cy', `${vh * 0.62 - p * (deckH + vh * 1.1)}px`);
      pre.classList.toggle('is-in', p > 0.02 && p < 0.3);
      post.classList.toggle('is-in', p > 0.86);
      this.layer?.draw(t / 1000);
    }, { always: true, resize: measure });
  }

  pause(): void { if (this.job) this.job.live = false; }
  resume(): void { if (this.job) { this.job.live = true; this.job.dirty = true; } }

  unmount(): void {
    if (this.job) clock.remove(this.job);
    this.job = null;
    this.layer?.destroy();
    this.layer = null;
  }
}

let instance: Credits | null = null;
export function create(): World { instance ??= new Credits(); return instance; }
