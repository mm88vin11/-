/**
 * The numbers the report is written from.
 *
 * Nothing here changes what is drawn; it only records what happened. The QA
 * harness reads `window.__BAZA_PERF` after a scripted scroll run, which is why
 * per-section frame accounting lives in the page rather than in the harness:
 * only the page knows which world owned a given frame.
 */
import { clock } from './ticker';

interface SectionStat {
  frames: number;
  ms: number;
  worst: number;
  over33: number;
  over50: number;
}

export interface PerfSnapshot {
  fps: Record<string, number>;
  worst: Record<string, number>;
  over33: Record<string, number>;
  over50: Record<string, number>;
  longTasks: { ms: number; at: number; name: string }[];
  cls: number;
  lcp: number;
  frames: number;
  tier: string;
  memory: number | null;
  liveWorlds: string[];
}

const sections = new Map<string, SectionStat>();
const longTasks: { ms: number; at: number; name: string }[] = [];
let cls = 0;
let lcp = 0;
let current = 'boot';
let frames = 0;
let live: () => string[] = () => [];

function stat(id: string): SectionStat {
  let s = sections.get(id);
  if (!s) { s = { frames: 0, ms: 0, worst: 0, over33: 0, over50: 0 }; sections.set(id, s); }
  return s;
}

export const perf = {
  /** the scroll director tells us which world owns the viewport */
  setSection(id: string): void { current = id; },
  setLiveProbe(fn: () => string[]): void { live = fn; },

  boot(): void {
    if ('PerformanceObserver' in window) {
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            longTasks.push({ ms: Math.round(e.duration), at: Math.round(e.startTime), name: current });
          }
        }).observe({ type: 'longtask', buffered: true });
      } catch { /* Safari */ }

      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
            if (!e.hadRecentInput) cls += e.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch { /* not supported */ }

      try {
        new PerformanceObserver((list) => {
          const es = list.getEntries();
          const last = es[es.length - 1];
          if (last) lcp = Math.round(last.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch { /* not supported */ }
    }

    clock.add(({ dt }) => {
      const ms = dt * 1000;
      frames++;
      const s = stat(current);
      s.frames++;
      s.ms += ms;
      if (ms > s.worst) s.worst = ms;
      if (ms > 33) s.over33++;
      if (ms > 50) s.over50++;
    }, { always: true, order: 1000 });

    Object.defineProperty(window, '__BAZA_PERF', { get: () => perf.snapshot() });
    /* The harness resets the frame counters after boot so the loader's own
       frames do not land in the scroll statistics. */
    (window as unknown as { __BAZA_RESET: () => void }).__BAZA_RESET = () => perf.reset();
  },

  reset(): void { sections.clear(); longTasks.length = 0; cls = 0; frames = 0; },

  snapshot(): PerfSnapshot {
    const fps: Record<string, number> = {};
    const worst: Record<string, number> = {};
    const o33: Record<string, number> = {};
    const o50: Record<string, number> = {};
    for (const [id, s] of sections) {
      if (!s.frames) continue;
      fps[id] = Math.round((s.frames / (s.ms / 1000)) * 10) / 10;
      worst[id] = Math.round(s.worst);
      o33[id] = s.over33;
      o50[id] = s.over50;
    }
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    return {
      fps, worst, over33: o33, over50: o50,
      longTasks: longTasks.slice(-80),
      cls: Math.round(cls * 1e4) / 1e4,
      lcp, frames,
      tier: document.documentElement.dataset['tier'] ?? '?',
      memory: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
      liveWorlds: live(),
    };
  },
};
