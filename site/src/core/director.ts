/**
 * Who is on stage, and who is allowed to cost anything.
 *
 * Three ranges, three observers, deliberately:
 *
 *   ±150%  load    — the chunk is fetched, roughly a section ahead of use
 *   ±50%   mount   — the world is built and ticking
 *   ±50%   pause   — leaving that band pauses it; two sections out unmounts it
 *
 * Anything else — a world ticking off screen, a chunk fetched at boot, a
 * texture held by a world nobody is looking at — is a bug this file exists to
 * prevent. The QA trace checks it: at any scroll position, at most three worlds
 * report themselves live.
 */
import type { World, WorldFactory } from './world';
import type { WorldSound } from './audio-bus';
import { audio } from './audio-bus';
import { clock } from './ticker';
import { perf } from './perf-monitor';
import { clamp } from './dom';
import { layout } from './layout';

type Loader = () => Promise<WorldFactory>;

interface Entry {
  readonly id: WorldSound;
  readonly section: HTMLElement;
  readonly load: Loader;
  world: World | null;
  /* The in-flight import, shared. Two observers fire in the same batch — one to
     preload, one to mount — and if the second is handed a promise that resolves
     before the import does, the world silently never mounts. That race is why
     this is a promise and not a boolean. */
  loading: Promise<void> | null;
  mounted: boolean;
  live: boolean;
  failed: boolean;
  /** 0..1 through the section, viewport-centre based */
  p: number;
  /** how loud this world's bed is right now */
  weight: number;
}

const entries: Entry[] = [];
const byId = new Map<WorldSound, Entry>();
let current: WorldSound | null = null;
const onSection = new Set<(id: WorldSound) => void>();

export const director = {
  register(id: WorldSound, section: HTMLElement, load: Loader): void {
    const e: Entry = { id, section, load, world: null, loading: null, mounted: false,
                       live: false, failed: false, p: 0, weight: 0 };
    entries.push(e);
    byId.set(id, e);
    layout.register(id, section);
  },

  get(id: WorldSound): World | null { return byId.get(id)?.world ?? null; },
  get currentId(): WorldSound | null { return current; },
  onSectionChange(fn: (id: WorldSound) => void): void { onSection.add(fn); },
  liveWorlds(): string[] { return entries.filter((e) => e.live).map((e) => e.id); },

  boot(): void {
    perf.setLiveProbe(() => director.liveWorlds());

    observe('150% 0px', (e, hit) => { if (hit) void load(e); });
    observe('50% 0px', (e, hit) => { hit ? mount(e) : pause(e); });
    observe('-45% 0px', (e, hit) => { if (hit) setCurrent(e.id); });
    observe('220% 0px', (e, hit) => { if (!hit) unmount(e); });

    /* Section progress and the audio crossfade ride the shared clock, reading
       offsets from `layout` — never from the DOM inside the tick. */
    clock.add(({ y, vh, k }) => {
      const mid = y + vh * 0.5;
      for (const e of entries) {
        const box = layout.get(e.id);
        const p = clamp((mid - box.top) / box.h, 0, 1);
        e.p = p;
        if (e.live) e.world?.progress?.(p);
        /* A bed is loudest in the middle of its section and gone by the edges. */
        const d = Math.abs(mid - (box.top + box.h * 0.5)) / (box.h * 0.5 + vh * 0.5);
        const w = e.live ? clamp(1 - d, 0, 1) : 0;
        if (Math.abs(w - e.weight) > 0.02) { e.weight = w; audio.setWorld(e.id, w); }
      }
      audio.tick(k);
    }, { always: true, order: -50 });
  },
};

function observe(rootMargin: string, cb: (e: Entry, hit: boolean) => void): void {
  const io = new IntersectionObserver((rows) => {
    for (const r of rows) {
      const e = entries.find((x) => x.section === r.target);
      if (e) cb(e, r.isIntersecting);
    }
  }, { rootMargin });
  for (const e of entries) io.observe(e.section);
}

function load(e: Entry): Promise<void> {
  if (e.world || e.failed) return Promise.resolve();
  e.loading ??= e.load()
    .then((mod) => { e.world = mod.create(); })
    .catch((err) => { e.failed = true; fallback(e, err); })
    .finally(() => { e.loading = null; });
  return e.loading;
}

/** A world that throws takes its own section down to a static look, nothing more. */
function fallback(e: Entry, err: unknown): void {
  e.section.dataset['fallback'] = '1';
  e.live = false;
  if (import.meta.env.DEV) console.error(`[world ${e.id}]`, err);
}

function mount(e: Entry): void {
  if (e.failed) return;
  if (!e.world) { void load(e).then(() => { if (e.world && !e.mounted) mount(e); }); return; }
  try {
    if (!e.mounted) { e.world.mount(e.section); e.mounted = true; }
    e.world.resume();
    e.live = true;
  } catch (err) { fallback(e, err); }
}

function pause(e: Entry): void {
  if (!e.world || !e.mounted || !e.live) return;
  try { e.world.pause(); } catch (err) { fallback(e, err); }
  e.live = false;
  audio.setWorld(e.id, 0);
  e.weight = 0;
}

function unmount(e: Entry): void {
  if (!e.world || !e.mounted) return;
  try { e.world.unmount(); } catch (err) { fallback(e, err); }
  e.mounted = false;
  e.live = false;
}

function setCurrent(id: WorldSound): void {
  if (current === id) return;
  current = id;
  document.documentElement.dataset['world'] = id;
  perf.setSection(id);
  for (const fn of onSection) fn(id);
}
