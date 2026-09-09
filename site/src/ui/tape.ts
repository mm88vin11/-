/** The metrics tape: sixteen numbers, draggable, on the shared clock. */
import { need } from '../core/dom';
import { clock } from '../core/ticker';
import { METRICS } from '../data/content';

const UP = '<svg viewBox="0 0 8 7" fill="currentColor" aria-hidden="true"><path d="M4 0l4 7H0z"/></svg>';
const DN = '<svg viewBox="0 0 8 7" fill="currentColor" aria-hidden="true"><path d="M4 7L0 0h8z"/></svg>';

export function mountTape(): void {
  const run = need('#tapeRun');
  const mask = need('#tapeMask');
  const card = need('#tapeCard');

  const html = METRICS.map(([k, v, up]) =>
    `<span class="tape__m tape__m--${up ? 'up' : 'down'}">` +
    `<span class="tape__mk">${k}</span>` +
    `<span class="tape__mv">${up ? UP : DN}${v}</span></span>`).join('');
  run.innerHTML = html + html;

  let x = 0;
  let half = 0;
  let drag: { x: number; x0: number } | null = null;

  const measure = (): void => { half = run.scrollWidth / 2; };
  clock.add(({ k }) => {
    if (!half) { measure(); return; }
    if (!drag) x -= 0.42 * k;
    if (x <= -half) x += half;
    if (x > 0) x -= half;
    run.style.transform = `translate3d(${x}px,0,0)`;
  }, { always: true, resize: measure });
  clock.once(measure);

  mask.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, x0: x };
    mask.classList.add('is-drag');
    mask.setPointerCapture?.(e.pointerId);
  });
  mask.addEventListener('pointermove', (e) => { if (drag) x = drag.x0 + (e.clientX - drag.x); });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
    mask.addEventListener(t, () => { drag = null; mask.classList.remove('is-drag'); });
  }

  need('#tapeQ').addEventListener('click', () => card.classList.toggle('is-open'));
  need('#tapeX').addEventListener('click', () => card.classList.remove('is-open'));
  document.addEventListener('click', (e) => {
    if (!card.classList.contains('is-open')) return;
    const t = e.target as HTMLElement;
    if (card.contains(t) || t.closest('#tapeQ')) return;
    card.classList.remove('is-open');
  });
}
