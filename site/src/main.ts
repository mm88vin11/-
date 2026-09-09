/**
 * Boot order, and why it is this order.
 *
 *   quality  — everything downstream reads the tier, so it is decided first
 *   clock    — the single loop; nothing may animate before it exists
 *   loader   — starts painting immediately, so there is no blank frame
 *   scroll   — Lenis and ScrollTrigger hang off the clock
 *   worlds   — registered, not loaded: the director fetches them as they near
 *   seams    — last, drawn on top of the worlds
 *
 * The whole file is about 120 lines because everything hard is somewhere else.
 */
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/loader.css';
import './styles/worlds.css';

import { clock } from './core/ticker';
import { quality } from './core/quality';
import { perf } from './core/perf-monitor';
import { scroll } from './core/scroll';
import { audio, type WorldSound } from './core/audio-bus';
import { director } from './core/director';
import { layout } from './core/layout';
import { startLoader } from './ui/loader';
import { mountHeader } from './ui/header';
import { mountTape } from './ui/tape';
import { mountEggs, watchReveals } from './ui/eggs';
import { SeamEngine } from './transitions/seam';
import { $$ } from './core/dom';

/* Scroll order. The seam engine reads it to know which boundary is which. */
const ORDER: WorldSound[] = [
  'hero', 'pain', 'truth', 'craft', 'cases', 'pricing',
  'route', 'gains', 'portal', 'brief', 'basement', 'credits',
];

const LOADERS: Record<WorldSound, () => Promise<{ create: () => import('./core/world').World }>> = {
  hero: () => import('./worlds/hero'),
  pain: () => import('./worlds/pain'),
  truth: () => import('./worlds/truth'),
  craft: () => import('./worlds/craft'),
  cases: () => import('./worlds/cases'),
  pricing: () => import('./worlds/pricing'),
  route: () => import('./worlds/route'),
  gains: () => import('./worlds/gains'),
  portal: () => import('./worlds/portal'),
  brief: () => import('./worlds/brief'),
  basement: () => import('./worlds/basement'),
  credits: () => import('./worlds/credits'),
};

function boot(): void {
  /* The QA harness pins a tier so the low path is exercised for real. */
  const forced = new URLSearchParams(location.search).get('tier');
  if (forced === 'low' || forced === 'mid' || forced === 'high') quality.force(forced, 'forced by query');

  quality.boot();
  clock.start();
  perf.boot();
  audio.boot();

  const loader = startLoader();

  /* Multi-touch is cancelled over the game surfaces only — the portal ring,
     the message flood, the bench, the feed. Everywhere else a pinch is a
     visitor zooming in to read, and taking that away is an accessibility
     failure rather than a polish detail. The double-tap delay is handled by
     `touch-action: manipulation` in the stylesheet, not here. */
  const PLAYABLE = '.ring, .flood__stage, .bench__3, .hotbar, .feed, .well';
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(t, (e) => {
      if ((e.target as HTMLElement | null)?.closest?.(PLAYABLE)) e.preventDefault();
    }, { passive: false });
  }
  document.addEventListener('touchmove', (e) => {
    const te = e as TouchEvent;
    if (te.touches.length > 1 && (te.target as HTMLElement | null)?.closest?.(PLAYABLE)) e.preventDefault();
  }, { passive: false });

  scroll.boot();
  mountHeader();
  mountTape();
  mountEggs();
  loader.set('runtime', 1);

  /* Fonts: 15% of the pour, and the thing most likely to shift the layout if
     it lands late. */
  if (document.fonts?.ready) void document.fonts.ready.then(() => loader.set('fonts', 1));
  else loader.set('fonts', 1);

  for (const id of ORDER) {
    const section = document.getElementById(id);
    if (!section) continue;
    director.register(id, section, LOADERS[id]);
  }
  director.boot();
  layout.boot();

  /* The reel reports its own priming into the pour: 40% of it. */
  void import('./worlds/hero').then((m) => {
    m.primeReporter((v) => loader.set('hero', v));
  });
  /* The first world under the fold is 25%. */
  void LOADERS.pain().then(() => loader.set('world', 1));

  const seam = new SeamEngine();
  seam.boot(ORDER);
  loader.set('shaders', 1);

  void loader.done.then(() => {
    watchReveals();
    scroll.refresh();
    /* Sections settle once their worlds have built themselves out. */
    window.setTimeout(() => scroll.refresh(), 900);
    warmHeavyChunks();
  });

  /* Anything that throws after boot must not take the page with it. */
  window.addEventListener('error', (e) => {
    if (import.meta.env.DEV) console.error('[baza]', e.error);
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (import.meta.env.DEV) console.error('[baza]', e.reason);
  });

  /* A no-WebGL visit is a supported visit: strip the canvases and let the DOM
     stand on its own. */
  if (!quality.state.webgl2) {
    document.documentElement.dataset['nogl'] = '1';
    $$('canvas.world__bg').forEach((c) => { c.style.display = 'none'; });
  }
}

/**
 * Parsing three is a ~150 ms task whatever else is true, and the trace caught it
 * landing in the middle of the scroll into #craft. So it is pulled during the
 * idle time right after the loader leaves, while the visitor is still reading
 * the first screen and nothing is moving. Same for matter, which #pain needs.
 * The director still owns *mounting*; this only pays the parse early.
 */
function warmHeavyChunks(): void {
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback
    ?? ((cb: () => void) => window.setTimeout(cb, 900));
  idle(() => { void import('./worlds/pain'); }, { timeout: 2000 });
  idle(() => { void import('./worlds/craft'); }, { timeout: 4000 });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
