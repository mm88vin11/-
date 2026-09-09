import { need } from '../core/dom';

let node: HTMLElement | null = null;
let timer = 0;

export function toast(message: string): void {
  node ??= need('#toast');
  node.textContent = message;
  node.classList.add('is-on');
  window.clearTimeout(timer);
  timer = window.setTimeout(() => node?.classList.remove('is-on'), 2600);
}

/** Clipboard with a fallback that still works on http and in old Safari. */
export function copy(text: string, message = 'Скопировано'): void {
  const ok = (): void => toast(message);
  const fallback = (): void => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); ok(); } catch { toast('Не вышло скопировать'); }
    document.body.removeChild(ta);
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(ok, fallback);
  } else fallback();
}

/**
 * Marks a group of controls as a world's opening move, and retires the cue on
 * first contact. `cues` limits how many get the ring: four mystery blocks all
 * want one, because hitting them all is the mechanic; eight priced line items
 * want one, because eight pulsing outlines read as an error.
 */
export function invite(els: HTMLElement[], cues = els.length): void {
  if (!els.length) return;
  els.slice(0, cues).forEach((e) => e.setAttribute('data-invite', ''));
  const done = (): void => els.forEach((e) => e.classList.add('is-used'));
  els.forEach((e) => e.addEventListener('pointerdown', done, { once: true, passive: true }));
}
