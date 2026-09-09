/**
 * Lenis and ScrollTrigger, wired to the one clock.
 *
 * The integration is the standard one and it matters that it is: Lenis is
 * advanced from `gsap.ticker`, ScrollTrigger updates from Lenis's scroll event,
 * and GSAP's lag smoothing is off so a slow frame does not silently rescale
 * time under a scrubbed timeline. Writing a scroll of our own is explicitly
 * forbidden by the perf contract, and rightly.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { quality } from './quality';

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;

export const scroll = {
  boot(): void {
    /* Reduced motion gets the browser's own scroll: smoothing is motion the
       visitor asked us not to add. */
    if (quality.reducedMotion) {
      ScrollTrigger.normalizeScroll(false);
      return;
    }

    lenis = new Lenis({
      duration: 1.05,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      /* Touch keeps the platform's own inertia: Lenis on touch is where the
         "fights my thumb" feeling comes from. */
      smoothWheel: true,
      syncTouch: false,
      touchMultiplier: 1.6,
      wheelMultiplier: 1,
      /* Nested scrollers must keep their own scroll: the case feed is a
         scroll-snap column, the shelf scrolls sideways, the tape is dragged.
         Lenis's docs prefer `prevent` over `allowNestedScroll`, which walks the
         DOM tree on every scroll event. */
      prevent: (node: HTMLElement) =>
        !!node.closest?.('.feed, .hotbar, .tape__mask, .flood__stage, .ring'),
    });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => { lenis?.raf(time * 1000); });
    /* Zero, per Lenis 1.3.26's own integration guide: GSAP's lag smoothing
       rescales the time it hands the ticker, and Lenis integrates that time
       directly into scroll position. Our clock does its own dt clamping, so
       nothing is lost by turning GSAP's off. */
    gsap.ticker.lagSmoothing(0);
  },

  /** Anchor travel. One implementation for every link on the page. */
  to(target: string | HTMLElement, offset = -8): void {
    const el = typeof target === 'string' ? document.getElementById(target.replace('#', '')) : target;
    if (!el) return;
    if (lenis) { lenis.scrollTo(el, { offset, duration: 1.1 }); return; }
    const top = el.getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({ top, behavior: quality.reducedMotion ? 'auto' : 'smooth' });
  },

  /** Used by #hero's silence beat and by the games while they hold focus. */
  lock(on: boolean): void {
    if (lenis) { on ? lenis.stop() : lenis.start(); }
    document.documentElement.classList.toggle('is-locked', on);
  },

  /** Nudges a control's consequence into view without yanking the page. */
  ensureVisible(el: HTMLElement, pad = 24): void {
    const r = el.getBoundingClientRect();
    if (!r.height) return;
    const top = 84;
    const bottom = window.innerHeight - 76;
    let dy = 0;
    if (r.bottom > bottom) dy = Math.min(r.bottom - bottom + pad, r.top - top);
    else if (r.top < top) dy = r.top - top - pad;
    if (Math.abs(dy) < 8) return;
    if (lenis) lenis.scrollTo(window.scrollY + dy, { duration: 0.7 });
    else window.scrollBy({ top: dy, behavior: quality.reducedMotion ? 'auto' : 'smooth' });
  },

  refresh(): void { ScrollTrigger.refresh(); },
  get instance(): Lenis | null { return lenis; },
};

export { ScrollTrigger, gsap };
