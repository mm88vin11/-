/**
 * Where the sections are.
 *
 * Three things need section offsets every frame — the director, the seam
 * engine and the header pill — and none of them may read the DOM inside a
 * tick. They all read from here instead.
 *
 * The reason this is a module rather than three private caches: `.uni` sections
 * carry `content-visibility: auto`, so a section that has never been on screen
 * reports its `contain-intrinsic-size` placeholder rather than its real height.
 * The moment it renders for the first time, every offset below it moves. A
 * cache measured once at boot is therefore not stale in the usual slow way —
 * it is wrong by hundreds of pixels, and the symptom is spectacular: the seam
 * engine picked the wrong boundary and painted the portal→brief white-out over
 * the middle of the site. A ResizeObserver on the sections catches exactly that
 * transition, because a section changing from placeholder to real height is a
 * resize.
 */
import { clock } from './ticker';

interface Box { top: number; h: number }

const els = new Map<string, HTMLElement>();
const boxes = new Map<string, Box>();
const subs = new Set<() => void>();
let observer: ResizeObserver | null = null;
let queued = false;

function measure(): void {
  queued = false;
  for (const [id, el] of els) {
    boxes.set(id, { top: el.offsetTop, h: Math.max(1, el.offsetHeight) });
  }
  for (const fn of subs) fn();
}

/** Coalesced: many sections settling in one frame cost one measurement. */
function schedule(): void {
  if (queued) return;
  queued = true;
  clock.once(measure);
}

export const layout = {
  register(id: string, el: HTMLElement): void {
    els.set(id, el);
    observer?.observe(el);
    schedule();
  },

  boot(): void {
    if ('ResizeObserver' in window) {
      observer = new ResizeObserver(schedule);
      for (const el of els.values()) observer.observe(el);
    }
    window.addEventListener('resize', schedule, { passive: true });
    measure();
    /* Belt and braces for browsers without ResizeObserver, and for fonts
       landing after first paint. */
    window.setTimeout(measure, 1200);
    window.setTimeout(measure, 4000);
  },

  get(id: string): Box { return boxes.get(id) ?? { top: 0, h: 1 }; },
  onChange(fn: () => void): void { subs.add(fn); },
  remeasure(): void { schedule(); },
};
