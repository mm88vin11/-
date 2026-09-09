/**
 * The bar, the sheet, the pill that follows the section you are in, and the two
 * switches in the dock.
 *
 * The active-section pill is offset arithmetic on the shared clock rather than
 * seven intersection ratios reconciled against each other: the sections are
 * tall and adjacent, so "which one owns the middle of the screen" is the honest
 * question and it costs one cached read per resize.
 */
import { $$, need } from '../core/dom';
import { clock } from '../core/ticker';
import { scroll } from '../core/scroll';
import { audio } from '../core/audio-bus';
import { quality } from '../core/quality';
import { layout } from '../core/layout';
import { toast } from './toast';

export function mountHeader(): void {
  const nav = need('#headNav');
  const ink = need('#headInk');
  const burger = need<HTMLButtonElement>('#burger');
  const menu = need('#menu');
  const links = $$<HTMLAnchorElement>('a[data-k]', nav);

  clock.add(({ y, vh }) => {
    document.body.classList.toggle('is-scrolled', y > vh * 0.5);
  });

  /* ——— the sheet ————————————————————————————————————————————————————— */
  let lockY = 0;
  const setMenu = (open: boolean): void => {
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      lockY = window.scrollY;
      scroll.lock(true);
      document.body.style.cssText += `;position:fixed;left:0;right:0;width:100%;top:${-lockY}px;`;
      (menu.querySelector('a') as HTMLElement | null)?.focus();
    } else {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, lockY);
      scroll.lock(false);
    }
  };
  burger.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')) { setMenu(false); burger.focus(); }
  });

  /* ——— in-page travel, one implementation ————————————————————————————— */
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href')?.slice(1);
    if (!id || !document.getElementById(id)) return;
    e.preventDefault();
    if (a.closest('#menu')) { setMenu(false); window.setTimeout(() => scroll.to(id), 240); }
    else scroll.to(id);
  });

  /* ——— the pill ————————————————————————————————————————————————————— */
  const ids = links.map((a) => a.dataset['k'] ?? '');
  let boxes: { top: number; h: number }[] = [];
  /* The pill's own geometry is read here too. Reading `offsetWidth` inside the
     tick — after the tick has already written a transform — forces a layout on
     every frame, which is exactly the thrash the contract forbids. */
  let pills: { w: number; x: number }[] = [];
  const measure = (): void => {
    boxes = ids.map((id) => layout.get(id));
    pills = links.map((a) => ({ w: a.offsetWidth, x: a.offsetLeft }));
  };
  layout.onChange(measure);
  clock.add(({ y, vh }) => {
    const mid = y + vh * 0.38;
    let best = -1;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]!;
      if (mid >= b.top && mid < b.top + b.h) { best = i; break; }
    }
    links.forEach((a, i) => a.classList.toggle('is-on', i === best));
    nav.classList.toggle('has-ink', best >= 0);
    const pill = pills[best];
    if (pill && pill.w) {
      ink.style.width = `${pill.w}px`;
      ink.style.transform = `translate3d(${pill.x}px,0,0)`;
    }
  }, { resize: measure });
  clock.once(measure);
  window.setTimeout(measure, 1500);

  /* ——— dock ————————————————————————————————————————————————————————— */
  const snd = need<HTMLButtonElement>('#snd');
  snd.setAttribute('aria-pressed', audio.on ? 'true' : 'false');
  snd.addEventListener('click', () => {
    const on = audio.enable(!audio.on);
    snd.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) { audio.click(); toast('Звук включён'); } else toast('Звук выключен');
  });

  /* One switch that stills the whole site — the accessibility escape hatch the
     brief asks for, and the same code path a low tier takes. */
  const calm = need<HTMLButtonElement>('#calm');
  const calmOn = localStorage.getItem('baza.calm') === '1';
  if (calmOn) { quality.force('low', 'visitor asked for the still version'); calm.setAttribute('aria-pressed', 'true'); }
  calm.addEventListener('click', () => {
    const on = calm.getAttribute('aria-pressed') !== 'true';
    calm.setAttribute('aria-pressed', on ? 'true' : 'false');
    localStorage.setItem('baza.calm', on ? '1' : '0');
    quality.force(on ? 'low' : 'high', on ? 'visitor asked for the still version' : 'visitor restored effects');
    toast(on ? 'Интерактив выключен' : 'Интерактив включён');
  });

  const yr = document.getElementById('yr');
  if (yr) yr.textContent = String(new Date().getFullYear());
}
