/**
 * Second-level easter eggs. Last thing built, first thing to cut if anything
 * had gone over budget — none of them are load-bearing.
 *
 * The exit note is the one that matters commercially: leaving is not met with
 * "don't go", it is met with the thing the visitor already built by scrolling.
 */
import { toast, copy } from './toast';
import { store } from './store';
import { $$ } from '../core/dom';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export function mountEggs(): void {
  /* ——— 1996 ——————————————————————————————————————————————————————————— */
  let seq: string[] = [];
  window.addEventListener('keydown', (e) => {
    seq.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    if (seq.length > KONAMI.length) seq = seq.slice(-KONAMI.length);
    if (seq.join(',') !== KONAMI.join(',')) return;
    seq = [];
    document.documentElement.classList.add('is-1996');
    toast('Так выглядел интернет, когда делали ваш текущий сайт.');
    window.setTimeout(() => document.documentElement.classList.remove('is-1996'), 10_000);
  });

  /* ——— the console ——————————————————————————————————————————————————— */
  const mark = [
    '',
    '  ██████╗  █████╗ ███████╗ █████╗ ',
    '  ██╔══██╗██╔══██╗╚══███╔╝██╔══██╗',
    '  ██████╔╝███████║  ███╔╝ ███████║',
    '  ██╔══██╗██╔══██║ ███╔╝  ██╔══██║',
    '  ██████╔╝██║  ██║███████╗██║  ██║',
    '  ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝',
    '',
    '  Раз вы здесь — мы нанимаем.',
    '  Пишите в Telegram: @lllbaza. Приложите то, что сделали руками.',
    '',
  ].join('\n');
  console.info(`%c${mark}`, 'color:#f8d548;font-family:monospace;line-height:1.15');

  /* ——— selection ————————————————————————————————————————————————————— */
  let selNode: HTMLElement | null = null;
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? '';
    if (text.length < 24) { selNode?.remove(); selNode = null; return; }
    const range = sel?.getRangeAt(0);
    const r = range?.getBoundingClientRect();
    if (!r || !r.width) return;
    if (!selNode) {
      selNode = document.createElement('button');
      selNode.className = 'btn btn--sm';
      selNode.textContent = 'Сохранить в сводку';
      selNode.style.cssText = 'position:fixed;z-index:600';
      selNode.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const kept = store.get<string[]>('quotes', []);
        store.set('quotes', [...kept, text].slice(-8));
        toast('Добавили в вашу сводку');
        selNode?.remove();
        selNode = null;
      });
      document.body.appendChild(selNode);
    }
    selNode.style.left = `${Math.min(window.innerWidth - 190, Math.max(8, r.left))}px`;
    selNode.style.top = `${Math.max(8, r.top - 46)}px`;
  });

  /* ——— on the way out ————————————————————————————————————————————————— */
  let offered = false;
  const offer = (): void => {
    if (offered) return;
    const losses = store.losses();
    if (losses.length < 2) return;
    offered = true;
    toast('Заберите карту потерь — вы её уже собрали. Нажмите, чтобы скопировать.');
    const grab = (): void => {
      copy(['Карта потерь · БАЗА', '', ...losses.map((l) => `— ${l}`), '', 'lllbaza.ru'].join('\n'),
           'Карта потерь скопирована');
      document.removeEventListener('click', grab);
    };
    document.addEventListener('click', grab, { once: true });
  };
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget && e.clientY < 12) offer(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) offered = false; });
}

/** Reveal-on-enter for everything marked `data-rise`. */
export function watchReveals(root: ParentNode = document): void {
  const nodes = $$('[data-rise]', root);
  if (!nodes.length) return;
  if (document.documentElement.dataset['rm'] === '1') {
    nodes.forEach((n) => n.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((rows) => {
    for (const r of rows) {
      if (!r.isIntersecting) continue;
      r.target.classList.add('is-in');
      io.unobserve(r.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });
  nodes.forEach((n) => io.observe(n));
}
