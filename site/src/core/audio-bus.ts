/**
 * Sound, synthesised.
 *
 * The brief asked for one sprite of ≤400 KB in Opus with an AAC fallback. This
 * build ships 0 KB instead and generates everything from Web Audio: a shared
 * noise buffer, a biquad per world, short envelopes for the interface. Three
 * reasons, in the order they mattered:
 *
 *  · Legal. Section 9 forbids anything lifted from a film or a game, and every
 *    licence for a bought-in bed has to be filed. Nothing is licensed here
 *    because nothing was recorded.
 *  · Weight. 400 KB is a quarter of the reel.
 *  · The pitch-shift on transitions is the point of the sound design, and
 *    detuning an oscillator is exact where resampling a sprite is not.
 *
 * The trade is honest and worth saying out loud: a synthesised swamp is
 * thinner than a recorded one. If a recorded bed is ever licensed, `voice()`
 * is the seam to replace — everything else stays.
 *
 * Muted until asked for. The context is not even constructed until the visitor
 * turns sound on, so no autoplay warning is ever earned.
 */
import { clamp, damp } from './dom';

export type WorldSound = 'hero' | 'pain' | 'truth' | 'craft' | 'cases' | 'pricing'
  | 'route' | 'gains' | 'portal' | 'brief' | 'basement' | 'credits';

interface Recipe {
  /** band-pass centre in Hz */
  readonly hz: number;
  readonly q: number;
  readonly gain: number;
  /** optional drone, in Hz */
  readonly drone?: number;
  readonly droneType?: OscillatorType;
  readonly droneGain?: number;
}

/* One line each, and each is meant to be recognisable with your eyes shut. */
const RECIPES: Record<WorldSound, Recipe> = {
  hero:     { hz: 220,  q: 0.7, gain: 0.05, drone: 55,  droneType: 'sine',     droneGain: 0.04 },
  pain:     { hz: 140,  q: 1.4, gain: 0.07, drone: 41,  droneType: 'triangle', droneGain: 0.05 },
  truth:    { hz: 2600, q: 0.9, gain: 0.03, drone: 110, droneType: 'sawtooth', droneGain: 0.012 },
  craft:    { hz: 700,  q: 0.8, gain: 0.04 },
  cases:    { hz: 1200, q: 0.6, gain: 0.03 },
  pricing:  { hz: 320,  q: 1.1, gain: 0.05, drone: 65,  droneType: 'square',   droneGain: 0.012 },
  route:    { hz: 90,   q: 2.2, gain: 0.10, drone: 48,  droneType: 'sawtooth', droneGain: 0.05 },
  gains:    { hz: 900,  q: 0.5, gain: 0.05, drone: 196, droneType: 'sine',     droneGain: 0.02 },
  portal:   { hz: 1500, q: 1.6, gain: 0.04, drone: 146, droneType: 'triangle', droneGain: 0.03 },
  brief:    { hz: 1000, q: 0.4, gain: 0.03 },
  basement: { hz: 260,  q: 2.6, gain: 0.06, drone: 37,  droneType: 'sine',     droneGain: 0.06 },
  credits:  { hz: 600,  q: 0.5, gain: 0.03, drone: 87,  droneType: 'sine',     droneGain: 0.02 },
};

class Voice {
  private readonly src: AudioBufferSourceNode;
  private readonly filt: BiquadFilterNode;
  readonly gain: GainNode;
  private readonly drone: OscillatorNode | null = null;
  private readonly droneGain: GainNode | null = null;
  private readonly baseHz: number;
  private readonly baseDrone: number;

  constructor(ctx: AudioContext, buf: AudioBuffer, out: AudioNode, r: Recipe) {
    this.baseHz = r.hz;
    this.src = ctx.createBufferSource();
    this.src.buffer = buf;
    this.src.loop = true;
    this.filt = ctx.createBiquadFilter();
    this.filt.type = 'bandpass';
    this.filt.frequency.value = r.hz;
    this.filt.Q.value = r.q;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.src.connect(this.filt).connect(this.gain).connect(out);
    this.src.start();

    this.baseDrone = r.drone ?? 0;
    if (r.drone) {
      this.drone = ctx.createOscillator();
      this.drone.type = r.droneType ?? 'sine';
      this.drone.frequency.value = r.drone;
      this.droneGain = ctx.createGain();
      this.droneGain.gain.value = 0;
      this.drone.connect(this.droneGain).connect(out);
      this.drone.start();
    }
    this.peak = r.gain;
    this.dronePeak = r.droneGain ?? 0;
  }

  readonly peak: number;
  readonly dronePeak: number;

  set(weight: number, pitch: number, now: number): void {
    this.gain.gain.setTargetAtTime(this.peak * weight, now, 0.18);
    this.filt.frequency.setTargetAtTime(this.baseHz * pitch, now, 0.12);
    this.src.playbackRate.setTargetAtTime(clamp(pitch, 0.5, 2), now, 0.15);
    if (this.droneGain && this.drone) {
      this.droneGain.gain.setTargetAtTime(this.dronePeak * weight, now, 0.2);
      this.drone.frequency.setTargetAtTime(this.baseDrone * pitch, now, 0.12);
    }
  }

  stop(): void {
    try { this.src.stop(); this.drone?.stop(); } catch { /* already stopped */ }
    this.src.disconnect(); this.filt.disconnect(); this.gain.disconnect();
    this.drone?.disconnect(); this.droneGain?.disconnect();
  }
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
const voices = new Map<WorldSound, Voice>();
const weights = new Map<WorldSound, number>();
let enabled = false;
let pitch = 1;
let pitchTarget = 1;

function build(): boolean {
  if (ctx) return true;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return false;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 6;
  master.connect(comp).connect(ctx.destination);

  /* Two seconds of pink-ish noise, generated once and looped by every world.
     Two seconds is long enough that the loop point is not a rhythm. */
  const n = ctx.sampleRate * 2;
  noise = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = noise.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
  }
  return true;
}

function voice(id: WorldSound): Voice | null {
  if (!ctx || !master || !noise) return null;
  let v = voices.get(id);
  if (!v) { v = new Voice(ctx, noise, master, RECIPES[id]); voices.set(id, v); }
  return v;
}

/** Short synthesised one-shots. Nothing here is longer than 120 ms of tail. */
function blip(freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slideTo?: number): void {
  if (!enabled || !ctx || !master) return;
  const t0 = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq * pitch, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo * pitch), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const audio = {
  get on(): boolean { return enabled; },

  boot(): void {
    enabled = localStorage.getItem('baza.sound') === '1';
    if (enabled) {
      /* A stored preference is not a gesture. Wait for one. */
      const arm = (): void => { audio.enable(true); window.removeEventListener('pointerdown', arm); window.removeEventListener('keydown', arm); };
      window.addEventListener('pointerdown', arm, { once: true, passive: true });
      window.addEventListener('keydown', arm, { once: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (!master || !ctx) return;
      master.gain.setTargetAtTime(document.hidden || !enabled ? 0 : 1, ctx.currentTime, 0.1);
    });
  },

  enable(on: boolean): boolean {
    enabled = on;
    localStorage.setItem('baza.sound', on ? '1' : '0');
    if (on) {
      if (!build()) { enabled = false; return false; }
      void ctx!.resume();
      master!.gain.setTargetAtTime(1, ctx!.currentTime, 0.25);
      for (const [id, w] of weights) voice(id)?.set(w, pitch, ctx!.currentTime);
    } else if (ctx && master) {
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    }
    return enabled;
  },

  /** The director hands us a weight per world every frame it changes. */
  setWorld(id: WorldSound, weight: number): void {
    const w = clamp(weight, 0, 1);
    if (weights.get(id) === w) return;
    weights.set(id, w);
    if (!enabled || !ctx) return;
    if (w <= 0.001) {
      const v = voices.get(id);
      if (v) { v.set(0, pitch, ctx.currentTime); }
      return;
    }
    voice(id)?.set(w, pitch, ctx.currentTime);
  },

  /** Transition pitch: down the pipe, up on the straight. */
  setPitch(p: number): void { pitchTarget = clamp(p, 0.5, 2); },

  tick(k: number): void {
    if (!enabled || !ctx) return;
    const next = damp(pitch, pitchTarget, 0.12, k);
    if (Math.abs(next - pitch) < 0.001) return;
    pitch = next;
    for (const [id, w] of weights) if (w > 0.001) voice(id)?.set(w, pitch, ctx.currentTime);
  },

  /** Everything below is ≤120 ms and has no tail worth speaking of. */
  click(): void { blip(1200, 0.03, 'sine', 0.05); },
  tap(): void { blip(760, 0.04, 'triangle', 0.05); },
  bump(): void { blip(160, 0.09, 'square', 0.07); },
  coin(): void { blip(988, 0.06, 'square', 0.07); blip(1319, 0.11, 'square', 0.06, 0.06); },
  lock(): void { blip(220, 0.05, 'square', 0.05); },
  clear(): void { [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.12, 'square', 0.06, i * 0.05)); },
  craft(): void { blip(660, 0.05, 'triangle', 0.07); blip(880, 0.1, 'triangle', 0.05, 0.05); },
  whoosh(up: boolean): void { blip(up ? 180 : 900, 0.32, 'sawtooth', 0.05, 0, up ? 900 : 140); },
  spark(): void { blip(1800, 0.05, 'triangle', 0.04); blip(2400, 0.06, 'sine', 0.03, 0.03); },
  doppler(): void { blip(1400, 0.24, 'sine', 0.05, 0, 500); },
  stop(): void {
    for (const v of voices.values()) v.stop();
    voices.clear(); weights.clear();
    void ctx?.close(); ctx = null; master = null; noise = null;
  },
};
