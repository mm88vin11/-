/**
 * What this device can actually afford.
 *
 * Every world reads `quality.tier` at mount and adapts: particle counts, DPR,
 * whether a WebGL layer is created at all. The tier is not fixed — if the page
 * spends sixty consecutive frames above 22 ms it steps down and says so in the
 * perf log. The visitor is allowed to see a simpler picture. They are not
 * allowed to see a stuttering one.
 */
import { clock } from './ticker';

export type Tier = 'high' | 'mid' | 'low';

interface QualityState {
  tier: Tier;
  /** the tier detected at boot, before any runtime downgrade */
  readonly booted: Tier;
  readonly reducedMotion: boolean;
  readonly coarse: boolean;
  readonly saveData: boolean;
  readonly webgl2: boolean;
  readonly cores: number;
  readonly memory: number;
  /** ms taken by the boot micro-benchmark; -1 when it could not run */
  readonly bench: number;
  /** device pixel ratio ceiling for canvas backing stores */
  dpr: number;
  /** 0..1 multiplier for particle populations */
  particles: number;
  /** post effects allowed at all */
  post: boolean;
  /** WebGL worlds allowed at all */
  gl: boolean;
}

const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const mqCoarse = window.matchMedia('(pointer: coarse)');

function probeWebGL(): { ok: boolean; ms: number } {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const gl = cv.getContext('webgl2', { antialias: false, depth: false, powerPreference: 'high-performance' });
  if (!gl) return { ok: false, ms: -1 };

  /* A deliberately dull fragment shader run over 256×256 a few times. It is not
     a benchmark of anything real — it is a way to tell a 2019 phone from a
     desktop without asking the user agent, which lies. */
  const vs = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vs, `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`);
  gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(fs, `#version 300 es
precision highp float; out vec4 o;
void main(){
  vec2 u = gl_FragCoord.xy * 0.01;
  float a = 0.;
  for (int i = 0; i < 48; i++) { a += sin(u.x * float(i) * 0.7) * cos(u.y * float(i) * 0.5); }
  o = vec4(vec3(a * 0.02 + 0.5), 1.);
}`);
  gl.compileShader(fs);
  const pr = gl.createProgram()!;
  gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return { ok: true, ms: -1 };
  gl.useProgram(pr);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const t0 = performance.now();
  for (let i = 0; i < 24; i++) gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.finish();
  const ms = performance.now() - t0;

  gl.deleteProgram(pr); gl.deleteShader(vs); gl.deleteShader(fs); gl.deleteBuffer(buf);
  const lose = gl.getExtension('WEBGL_lose_context');
  lose?.loseContext();
  return { ok: true, ms };
}

function detect(): QualityState {
  const cores = navigator.hardwareConcurrency || 2;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const saveData = conn?.saveData === true;
  const reducedMotion = mqReduce.matches;
  const coarse = mqCoarse.matches;

  const probe = probeWebGL();
  let tier: Tier;

  if (!probe.ok || saveData || cores <= 2 || memory <= 1) tier = 'low';
  else if (cores <= 4 || memory <= 4 || (probe.ms >= 0 && probe.ms > 26)) tier = 'mid';
  else tier = 'high';

  /* Reduced motion is not a slow device — it is a preference. The worlds still
     render, they just stop moving on their own. */
  const dprCap = coarse ? 1.5 : 2;
  return {
    tier, booted: tier, reducedMotion, coarse, saveData,
    webgl2: probe.ok, cores, memory, bench: probe.ms,
    dpr: Math.min(window.devicePixelRatio || 1, tier === 'low' ? 1 : dprCap),
    particles: tier === 'high' ? 1 : tier === 'mid' ? 0.5 : 0,
    post: tier === 'high' && !reducedMotion,
    gl: probe.ok && tier !== 'low',
  };
}

const state = detect();
type Listener = (tier: Tier, reason: string) => void;
const listeners = new Set<Listener>();

/** How many times the ladder has taken something away, for the QA harness. */
let downgrades = 0;
/** And how many times it handed a hasty opening call back. */
let upgrades = 0;

function applyTier(tier: Tier, reason: string): void {
  if (tier === state.tier) return;
  state.tier = tier;
  state.particles = tier === 'high' ? 1 : tier === 'mid' ? 0.5 : 0;
  state.post = tier === 'high' && !state.reducedMotion;
  state.gl = state.webgl2 && tier !== 'low';
  state.dpr = Math.min(window.devicePixelRatio || 1, tier === 'low' ? 1 : state.coarse ? 1.5 : 2);
  document.documentElement.dataset['tier'] = tier;
  for (const l of listeners) l(tier, reason);
  /* Deferred by one tick on purpose: this runs from inside the ladder's own
     job, and reallocating every canvas on the page mid-tick is how you get a
     world drawing into a buffer that is being replaced underneath it. */
  clock.once(() => clock.refit());
}

/**
 * A tier chosen by a person is not a guess to be overruled.
 *
 * The ladder exists to take things away from a device that cannot keep up. It
 * has no business undoing an explicit choice — the "still version" switch in
 * the dock, or `?tier=` from the QA harness. Without this the screenshot sweep
 * documented the low-tier fallback no matter what it asked for, because the
 * machine it runs on downgrades within seconds.
 */
let pinned = false;

/**
 * The ladder's evidence window.
 *
 * The first one is short and the rest are long, because the two jobs are not
 * the same job. The first window answers "was the detection wrong about this
 * device", and it has to answer quickly: a device that cannot hold 60 fps
 * shows the visitor every dropped frame until the ladder acts, and walking
 * `high → mid → low` at sixty frames a rung was six seconds of visible jank on
 * a phone that was never going to hold any of it. Measured: the mobile profile
 * finished a whole page at 53.4 fps with 17 frames over 50 ms when it walked
 * down, and at 57.2 fps with 1 when it started where it ended up.
 *
 * The rest are long because by then the question is different — "has something
 * changed" — and a hasty answer there means a page that keeps flipping its own
 * quality under the reader.
 */
const FIRST_WINDOW = 20;
const WINDOW = 60;
/**
 * The first window also closes on time, not only on frames.
 *
 * A window measured purely in frames is backwards: the slower the device, the
 * longer it takes to notice it is slow. Measured here, the opening ran at
 * 4.4 fps, so twenty frames was four and a half seconds of the loader running
 * at full strength on a machine that had already proved it could not hold it.
 * Whichever comes first, then — with a floor of four frames, because one
 * chunk-parse frame is not evidence about a device and must not be able to
 * spend a tier on its own.
 */
const FIRST_MS = 400;
const FIRST_MIN_FRAMES = 4;
/**
 * The opening call gets exactly one chance to be wrong.
 *
 * Deciding on four frames is right for a device that genuinely cannot keep up
 * and unfair to a fast one whose *startup* was slow — a few hundred
 * milliseconds of module evaluation is a statement about the bundle, not about
 * the GPU. So a tier taken away by the early call is remembered, and one full
 * window that comes back comfortably fast — not merely inside budget — hands
 * it back. Once, and only for the early call: a ladder that can climb whenever
 * it likes is a page that changes quality under the reader.
 */
let earlyFrom: Tier | null = null;
let restored = false;
let windowFrames = FIRST_WINDOW;
let sampled = 0;
let slow = 0;
let acc = 0;

export const quality = {
  get tier(): Tier { return state.tier; },
  get state(): Readonly<QualityState> { return state; },
  get reducedMotion(): boolean { return state.reducedMotion; },
  get coarse(): boolean { return state.coarse; },
  get dpr(): number { return state.dpr; },
  get particles(): number { return state.particles; },
  get post(): boolean { return state.post; },
  get gl(): boolean { return state.gl; },

  /** particle populations, rounded, never below 0 */
  count(base: number): number { return Math.max(0, Math.round(base * state.particles)); },

  /**
   * Backing-store scale for a full-screen shader layer.
   *
   * A background gradient does not need one sample per device pixel, and a
   * full-screen fragment shader is priced in exactly those samples. What it
   * must not do is drop *below* 1×: a layer rendered smaller than its box has
   * to be scaled up by the compositor every frame, and that costs more than
   * the samples it saves. Measured both ways — see the note in hero.ts, which
   * is the same lesson from the other direction.
   */
  shaderDpr(): number {
    const dpr = window.devicePixelRatio || 1;
    if (state.tier === 'high') return Math.min(dpr, 1.5);
    if (state.tier === 'mid') return Math.min(dpr, 1);
    return Math.min(dpr, 1);
  },

  onChange(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /**
   * Forced from the dock's "still version" switch and from the QA harness.
   *
   * `pin` decides whether the runtime ladder may still overrule the choice. A
   * person flipping the switch pins; the harness pins only for the screenshot
   * sweep, because a performance run with the ladder disabled measures a tier
   * the device was never going to keep, which is not what anybody experiences.
   */
  force(tier: Tier, reason = 'forced', pin = true): void {
    if (pin) pinned = true;
    applyTier(tier, reason);
  },
  /** Hands control back to the ladder. */
  unpin(): void { pinned = false; },
  get pinned(): boolean { return pinned; },

  boot(): void {
    document.documentElement.dataset['tier'] = state.tier;
    if (state.reducedMotion) document.documentElement.dataset['rm'] = '1';

    /* `raw`, not `dt`: a 900 ms stall arrives here as a clamped 50 ms, and the
       ladder exists to notice exactly that kind of stall. */
    clock.add(({ raw }) => {
      const ms = raw * 1000;
      acc += ms;
      sampled++;
      if (ms > 22) slow++;
      const isFirst = windowFrames === FIRST_WINDOW;
      const early = isFirst && sampled >= FIRST_MIN_FRAMES && acc >= FIRST_MS;
      if (sampled < windowFrames && !early) return;
      const n = sampled;
      const avg = acc / n;
      const slowShare = slow / n;
      acc = 0; sampled = 0; slow = 0;
      windowFrames = WINDOW;
      if (pinned) return;

      /* Both, not either. The mean alone hands a downgrade to any page that
         parsed a chunk during the window — one 400 ms task is worth 20 ms of
         mean across twenty frames, and a one-off parse is not a statement
         about the device. Requiring that most of the window was also slow
         asks the question that actually matters: is this sustained? */
      if (avg <= 22 || slowShare <= 0.5) {
        /* Comfortably fast, not merely inside budget — the point is to undo a
           hasty call, not to climb back towards the frame that caused it. */
        if (earlyFrom && !restored && !isFirst && avg < 14 && slowShare < 0.1) {
          restored = true;
          const back = earlyFrom;
          earlyFrom = null;
          upgrades++;
          applyTier(back, `restored: ${n} frames averaged ${avg.toFixed(1)}ms`);
        }
        return;
      }
      if (state.tier === 'low') return;

      /* How far past the budget decides how far to step. A device averaging
         40 ms a frame is not one rung away from comfortable, and making it
         earn the second rung over another sixty frames is another second of
         exactly the jank this mechanism exists to end. */
      const next: Tier = avg > 40 ? 'low' : state.tier === 'high' ? 'mid' : 'low';
      if (early) earlyFrom ??= state.tier;
      downgrades++;
      applyTier(next, `runtime downgrade: ${n} frames averaged ${avg.toFixed(1)}ms, ${Math.round(slowShare * 100)}% of them over budget`);
    }, { always: true, order: -100 });

    /* Read by the measurement rig: the tier the page settled on and whether it
       got there by detection or by the ladder taking something away. */
    Object.defineProperty(window, '__BAZA_TIER', {
      get: () => ({ tier: state.tier, downgrades, upgrades, pinned, webgl2: state.webgl2, cores: state.cores }),
    });

    mqReduce.addEventListener('change', () => window.location.reload());
  },
};
