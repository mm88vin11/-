/**
 * The one clock.
 *
 * There is exactly one animation loop on this site and GSAP owns it. Lenis is
 * driven from it, ScrollTrigger updates from it, and every canvas world is a
 * job on it. Nothing here calls requestAnimationFrame — the perf guard checks
 * that `src/` contains no raw rAF at all, because the last build had eleven
 * loops fighting each other for the same 16.7 ms.
 *
 * Two properties matter more than the loop itself:
 *
 *  · One scroll read per frame. `y` is sampled once, at the top, and handed to
 *    every job. No job may call getBoundingClientRect during a tick.
 *  · A job whose section is off screen does not run. Not throttled — skipped,
 *    with its world paused so its textures can go too.
 */
import gsap from 'gsap';

export interface Tick {
  /** ms since page start, from the shared clock */
  readonly t: number;
  /** seconds since previous frame */
  readonly dt: number;
  /** dt normalised so 1 === one frame at 60Hz; multiply drift by this */
  readonly k: number;
  /** window.scrollY, read once per frame */
  readonly y: number;
  readonly vw: number;
  readonly vh: number;
  /** true when the page scrolled since the previous frame */
  readonly moved: boolean;
}

export interface JobOpts {
  /** run even when the page is stationary (canvas worlds); default false */
  readonly always?: boolean;
  /** called on a settled resize, never during a tick */
  readonly resize?: (vw: number, vh: number) => void;
  /** lower runs earlier; seams draw after worlds */
  readonly order?: number;
}

export interface Job {
  live: boolean;
  dirty: boolean;
  readonly fn: (tick: Tick) => void;
  readonly always: boolean;
  readonly order: number;
  readonly resize: ((vw: number, vh: number) => void) | undefined;
}

const jobs: Job[] = [];
let sorted = true;

const state = {
  t: 0, dt: 1 / 60, k: 1, y: 0, vw: 0, vh: 0, moved: false,
};
let prevT = 0;
let prevY = -1;
let running = false;

function measure(): void {
  state.vw = window.innerWidth;
  state.vh = window.innerHeight;
  /* --vh is width-driven on purpose: a retracting mobile toolbar is not a new
     layout, and treating it as one is what made the old page look like it
     reloaded itself under a thumb. */
  document.documentElement.style.setProperty('--vh', `${state.vh * 0.01}px`);
}

function tick(time: number): void {
  const t = time * 1000;
  if (document.hidden) { prevT = t; return; }

  const raw = prevT ? (t - prevT) / 1000 : 1 / 60;
  prevT = t;
  /* Clamped: a tab returning from the background must not teleport every
     particle across the screen in a single frame. */
  state.dt = Math.min(Math.max(raw, 0.001), 0.05);
  state.k = state.dt * 60;
  state.t = t;
  state.y = window.scrollY;
  state.moved = state.y !== prevY;
  prevY = state.y;

  if (!sorted) { jobs.sort((a, b) => a.order - b.order); sorted = true; }

  for (let i = 0; i < jobs.length; i++) {
    const j = jobs[i]!;
    if (!j.live) continue;
    if (!j.always && !state.moved && !j.dirty) continue;
    j.dirty = false;
    j.fn(state);
  }
}

let resizeT = 0;
function onResize(): void {
  window.clearTimeout(resizeT);
  /* 150 ms, per the perf contract. Canvas worlds reallocate their backing
     store here and nowhere else. */
  resizeT = window.setTimeout(() => {
    const prevW = state.vw;
    const prevH = state.vh;
    measure();
    /* Height-only changes under 140px are the address bar, not a layout. */
    if (state.vw === prevW && Math.abs(state.vh - prevH) < 140) return;
    for (const j of jobs) { j.resize?.(state.vw, state.vh); j.dirty = true; }
  }, 150);
}

export const clock = {
  start(): void {
    if (running) return;
    running = true;
    measure();
    prevY = window.scrollY;
    gsap.ticker.lagSmoothing(0);
    gsap.ticker.add(tick);
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { prevT = 0; for (const j of jobs) j.dirty = true; }
    });
  },

  add(fn: (tick: Tick) => void, opts: JobOpts = {}): Job {
    const job: Job = {
      fn, live: true, dirty: true,
      always: opts.always ?? false,
      order: opts.order ?? 0,
      resize: opts.resize,
    };
    jobs.push(job);
    sorted = false;
    opts.resize?.(state.vw, state.vh);
    return job;
  },

  remove(job: Job): void {
    const i = jobs.indexOf(job);
    if (i >= 0) jobs.splice(i, 1);
  },

  /** Run once on the next tick — replaces every stray rAF used for "after layout". */
  once(fn: () => void): void {
    const j = this.add(() => { fn(); this.remove(j); }, { always: true, order: 999 });
  },

  get state(): Tick { return state; },
};
