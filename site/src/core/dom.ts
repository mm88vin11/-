/** Small, boring helpers. Everything here is allowed to touch the DOM; the
 *  worlds mostly are not, at least not inside a tick. */

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(sel);

export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T[] =>
  Array.from(root.querySelectorAll<T>(sel));

/** Throws instead of returning null: a missing hook is a build error, not a
 *  runtime branch to write around. Worlds are mounted inside try/catch, so a
 *  throw here downgrades one section rather than the page. */
export function need<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`missing element: ${sel}`);
  return el;
}

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
export const inv = (a: number, b: number, v: number): number => (b === a ? 0 : clamp((v - a) / (b - a), 0, 1));

/** Frame-rate independent smoothing. `1 - pow(1 - t, k)` and not `t * k`,
 *  because the second one is a different animation on a 120 Hz phone. */
export const damp = (from: number, to: number, t: number, k: number): number =>
  lerp(from, to, 1 - Math.pow(1 - t, k));

export const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, html?: string,
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}

/** Escapes text going into innerHTML. Everything user-typed goes through it. */
export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const plural = (n: number, forms: [string, string, string]): string => {
  const m100 = n % 100;
  if (m100 > 4 && m100 < 20) return forms[2];
  const m10 = n % 10;
  return m10 === 1 ? forms[0] : m10 > 1 && m10 < 5 ? forms[1] : forms[2];
};

/**
 * Sizes a canvas backing store to its box, capped at the tier's DPR.
 * Returns true when the store actually changed, so callers can skip a repaint.
 */
export function fit(cv: HTMLCanvasElement, dpr: number): boolean {
  const r = cv.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * dpr));
  const h = Math.max(1, Math.round(r.height * dpr));
  if (cv.width === w && cv.height === h) return false;
  cv.width = w; cv.height = h;
  return true;
}

/**
 * will-change, applied the way it is supposed to be: set before the animation,
 * removed after. Leaving it on forty elements is how a composited page runs
 * out of memory on a phone.
 */
export function hint(node: HTMLElement, prop = 'transform'): () => void {
  node.style.willChange = prop;
  return () => { node.style.willChange = ''; };
}
