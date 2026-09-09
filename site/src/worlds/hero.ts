/**
 * 00 · HERO — the reel.
 *
 * The shot is a frame sequence, not a video, and the sequence is scrubbed by
 * scroll. Four things make that cheap enough to keep:
 *
 *  · The reel was halved at build time and the runtime crossfades adjacent
 *    frames. 91 frames with a blend read as ~180 without one, at half the
 *    bytes and half the decodes.
 *  · Frames load in a window around wherever the scrub currently is — fifteen
 *    ahead, two behind — rather than in order, so a fast scroll never waits on
 *    frames it has already passed.
 *  · Only the cut that matches the viewport is ever fetched. The old build
 *    concatenated both, which is why the hero used to play one shot and then a
 *    second one.
 *  · Frames are decoded off the main thread into `ImageBitmap`s, and only a
 *    window of them is kept alive at once. This is not a micro-optimisation:
 *    the first honest trace of this section showed 56 long tasks of 110–153 ms,
 *    every one of them a WebP decode on the main thread, and 25 fps on mobile.
 *    Decoding through `createImageBitmap` moves that work off-thread, and
 *    closing bitmaps outside the window keeps 91 frames of 1216×684 from
 *    becoming 300 MB of GPU memory. The window is ±  a few frames wide, which
 *    is all a scrub ever needs.
 *
 * The beat in the middle is the point of the section: where the laptop is open
 * and the question is readable, the scrub plateaus — the frame index stops
 * advancing for about a second and a half of ordinary scrolling while the
 * sound goes to nothing. The brief suggested pinning the scroll outright; a
 * plateau does the same to the eye without taking the page away from a thumb,
 * which on touch cannot be done without breaking the gesture.
 */
import type { World } from '../core/world';
import { LOOKS } from '../core/world';
import { clock, type Job } from '../core/ticker';
import { quality } from '../core/quality';
import { audio } from '../core/audio-bus';
import { clamp, damp, need, fit } from '../core/dom';

interface Manifest {
  reel: Record<'d' | 'm', { frames: number; width: number; aspect: number }>;
}

/* Where the shot holds. Measured against the reel, not guessed: this is the
   span where the laptop is open and the copy on its screen is readable. */
const HOLD_FROM = 0.42;
const HOLD_TO = 0.50;
/* Pixels of scroll per frame outside the hold. 36 keeps the same total runway
   the old build had at 18 px across twice as many frames. */
const PX_PER_FRAME = 36;

class Hero implements World {
  readonly id = 'hero' as const;
  readonly look = LOOKS.hero;

  private section!: HTMLElement;
  private cv!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private prog!: HTMLElement;
  private whisper!: HTMLElement;
  private job: Job | null = null;

  private srcs: string[] = [];
  private imgs: (ImageBitmap | HTMLImageElement | null)[] = [];
  private pending = new Set<number>();
  private ready = 0;
  private lanes = 4;
  /* How far ahead of, and behind, the scrub frames are kept decoded. Ahead is
     larger because scrolling forward is what people do. */
  private static readonly AHEAD = 16;
  private static readonly BEHIND = 6;
  private static readonly KEEP_AHEAD = 30;
  private static readonly KEEP_BEHIND = 14;
  private cut: 'd' | 'm' | null = null;
  private manifest: Manifest | null = null;

  private smooth = 0;
  private lastF = -1;
  private held = false;
  /* Cached section geometry: read on resize, never inside a tick. */
  private box = { top: 0, run: 1 };
  private onPrime: ((v: number) => void) | null = null;

  setPrimeReporter(fn: (v: number) => void): void { this.onPrime = fn; }

  mount(section: HTMLElement): void {
    this.section = section;
    this.cv = need<HTMLCanvasElement>('#heroC');
    this.ctx = this.cv.getContext('2d', { alpha: false })!;
    this.prog = need('#heroProg');
    this.whisper = need('#heroWhisper');

    if (__SINGLE__) {
      /* The single-file target carries its own, much smaller reel inline. */
      void import('virtual:reel-inline').then(({ FRAMES }) => {
        this.srcs = FRAMES;
        this.releaseAll();
        this.imgs = new Array(FRAMES.length).fill(null);
        this.setRunway();
        this.pump(0);
      }).catch(() => { this.onPrime?.(1); });
    } else {
      void fetch('assets/manifest.json').then((r) => r.json()).then((m: Manifest) => {
        this.manifest = m;
        this.useCut(this.wantCut());
      }).catch(() => { this.onPrime?.(1); });
    }

    const measure = (): void => {
      this.box = {
        top: this.section.offsetTop,
        run: Math.max(1, this.section.offsetHeight - window.innerHeight),
      };
    };
    clock.once(measure);
    /* The runway is written from the frame count, so the box changes when the
       cut does; both re-measures go through here. */
    this.remeasure = measure;

    this.job = clock.add((t) => this.tick(t.k), {
      always: true,
      resize: () => {
        if (this.fitToSource()) this.lastF = -1;
        this.useCut(this.wantCut());
        this.setRunway();
        measure();
        this.paint();
      },
    });
  }

  /**
   * Sizes the canvas to its box, at the tier's DPR.
   *
   * An earlier version capped the backing store at the reel's own width (1216)
   * on the theory that rasterising more pixels than the source contains is
   * waste. Measured, it was 25% *slower*: the compositor then has to scale the
   * layer up on every frame, and that costs more than the pixels saved. Left
   * here as a note rather than a change, because it is the kind of idea that
   * sounds obviously right.
   */
  private fitToSource(): boolean {
    return fit(this.cv, quality.dpr);
  }

  private wantCut(): 'd' | 'm' {
    return window.innerHeight / window.innerWidth > 1.12 ? 'm' : 'd';
  }

  private useCut(cut: 'd' | 'm'): void {
    if (__SINGLE__ || !this.manifest || cut === this.cut) return;
    this.cut = cut;
    const n = this.manifest.reel[cut].frames;
    const dir = cut === 'd' ? 'reel-d' : 'reel-m';
    this.srcs = Array.from({ length: n }, (_, i) => `assets/${dir}/f${String(i).padStart(3, '0')}.webp`);
    this.releaseAll();
    this.imgs = new Array(n).fill(null);
    this.ready = 0;
    this.pending.clear();
    this.lanes = 4;
    this.lastF = -1;
    this.fitToSource();
    this.setRunway();
    this.pump(0);
  }

  private setRunway(): void {
    this.section.style.setProperty('--runway', `${Math.max(1, this.srcs.length) * PX_PER_FRAME}px`);
    /* The section just changed height; its cached box has to follow. */
    clock.once(() => this.remeasure?.());
  }

  /**
   * Keeps a window of decoded frames around `centre`, and releases the rest.
   *
   * Decode happens through `createImageBitmap`, which does the work off the
   * main thread — the difference between a 140 ms long task per frame and
   * none. Bitmaps outside the keep-window are `close()`d, which is the only
   * way to hand their memory back; without it a 91-frame reel at 1216×684 is
   * roughly 300 MB of decoded pixels, against a 180 MB budget for the whole
   * page.
   */
  private pump(centre: number): void {
    const n = this.srcs.length;
    if (!n) return;
    const PRIME = Math.min(10, n);

    /* Release first, so a fast scroll frees before it allocates. */
    for (let i = 0; i < n; i++) {
      if (i > centre - Hero.KEEP_BEHIND && i < centre + Hero.KEEP_AHEAD) continue;
      if (i < PRIME) continue;
      this.release(i);
    }

    const order: number[] = [];
    for (let i = 0; i < PRIME; i++) if (this.wants(i)) order.push(i);
    for (let d = 0; d <= Hero.AHEAD; d++) {
      const a = centre + d;
      const b = centre - d;
      if (a < n && this.wants(a)) order.push(a);
      if (d > 0 && d <= Hero.BEHIND && b >= 0 && this.wants(b)) order.push(b);
    }

    while (this.lanes > 0 && order.length) {
      const idx = order.shift()!;
      if (!this.wants(idx)) continue;
      this.lanes--;
      this.pending.add(idx);
      void this.decode(idx).then((bmp) => {
        this.pending.delete(idx);
        this.lanes++;
        /* The scrub may have left this frame's window while it was decoding. */
        if (bmp && (idx < PRIME || (idx > this.lastCentre - Hero.KEEP_BEHIND && idx < this.lastCentre + Hero.KEEP_AHEAD))) {
          this.imgs[idx] = bmp;
        } else if (bmp && 'close' in bmp) {
          bmp.close();
        }
        this.ready++;
        if (this.ready <= PRIME) this.onPrime?.(Math.min(1, this.ready / PRIME));
        if (this.ready === 1) {
          this.lastF = -1;
          this.paint();
          /* The canvas is transparent until there is something in it: the
             poster carries the first screen, and the reel takes over only once
             a frame has actually been decoded. */
          document.body.classList.add('reel-ready');
        }
        if (order.length || this.ready < PRIME) this.pump(this.lastCentre);
      });
    }
  }

  private wants(i: number): boolean {
    return !this.imgs[i] && !this.pending.has(i) && i >= 0 && i < this.srcs.length;
  }

  private release(i: number): void {
    const held = this.imgs[i];
    if (held && 'close' in held) held.close();
    if (held) this.imgs[i] = null;
  }

  private releaseAll(): void {
    for (let i = 0; i < this.imgs.length; i++) this.release(i);
  }

  /** Off-thread where the browser supports it, on-thread where it does not. */
  private async decode(idx: number): Promise<ImageBitmap | HTMLImageElement | null> {
    const src = this.srcs[idx];
    if (!src) return null;
    if ('createImageBitmap' in window) {
      try {
        const res = await fetch(src, { cache: 'force-cache' });
        if (!res.ok) return null;
        return await createImageBitmap(await res.blob());
      } catch { /* fall through to the <img> path */ }
    }
    return new Promise((resolve) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => resolve(im.naturalWidth ? im : null);
      im.onerror = () => resolve(null);
      im.src = src;
    });
  }

  private lastCentre = 0;

  /** Maps scroll through the section to a frame, with the plateau in the middle. */
  private frameAt(p: number): number {
    const n = this.srcs.length;
    if (n < 2) return 0;
    let q: number;
    if (p < HOLD_FROM) q = (p / HOLD_FROM) * HOLD_FROM;
    else if (p < HOLD_TO) q = HOLD_FROM;
    else q = HOLD_FROM + ((p - HOLD_TO) / (1 - HOLD_TO)) * (1 - HOLD_FROM);
    return clamp(q, 0, 1) * (n - 1);
  }

  private remeasure: (() => void) | null = null;

  private tick(k: number): void {
    const target = clamp((clock.state.y - this.box.top) / this.box.run, 0, 1);

    /* Eased rather than mapped straight off scrollY: a trackpad flick moves the
       raw value in jumps, and following it literally is what makes a reel look
       like it is stuttering rather than playing. */
    this.smooth = quality.reducedMotion ? target : damp(this.smooth, target, 0.18, k);
    if (Math.abs(target - this.smooth) < 0.0006) this.smooth = target;

    this.prog.style.setProperty('--p', String(this.smooth));

    /* The stage is handed over rather than shared. The headline owns the first
       fifth of the reel, over a closed laptop; by the time the screen inside
       the shot is legible the headline is gone, because two pieces of display
       copy fighting for the same rectangle is worse than either alone. */
    const handover = clamp((this.smooth - 0.14) / 0.18, 0, 1);
    this.section.style.setProperty('--out', String(1 - handover * handover * (3 - 2 * handover)));
    document.body.classList.toggle('hero-out', target > 0.9);

    const inHold = this.smooth >= HOLD_FROM && this.smooth <= HOLD_TO;
    if (inHold !== this.held) {
      this.held = inHold;
      this.whisper.classList.toggle('is-on', inHold);
      /* Sound leaves the room for the length of the beat. */
      audio.setWorld('hero', inHold ? 0 : 1);
    }

    const f = this.frameAt(this.smooth);
    const centre = Math.round(f);
    if (centre !== this.lastCentre) { this.lastCentre = centre; this.pump(centre); }
    this.paint(f);
  }

  private paint(f = this.frameAt(this.smooth)): void {
    if (!this.srcs.length) return;
    /* Nothing moved and nothing new decoded: the cheapest frame is the one we
       do not draw. */
    if (Math.abs(f - this.lastF) < 0.004 && this.smooth <= 0.86) return;
    const i = Math.floor(f);
    const frac = f - i;
    const a = this.nearest(i);
    if (!a) return;
    /* The crossfade is skipped where it cannot be seen — at the very start and
       end of a frame's span — and entirely on the low tier, where one draw of a
       full-screen bitmap is already the section's whole budget. */
    const blend = quality.tier !== 'low' && frac > 0.1 && frac < 0.9;
    const b = blend ? this.nearest(i + 1) : null;

    const { width: cw, height: ch } = this.cv;
    if (!cw || !ch) return;
    this.ctx.globalAlpha = 1;
    this.cover(a, cw, ch);
    if (b && b !== a) {
      /* The crossfade is what buys back the frames the build dropped. */
      this.ctx.globalAlpha = frac;
      this.cover(b, cw, ch);
      this.ctx.globalAlpha = 1;
    }
    this.lastF = f;

    /* On the way closed, a face in the lid for a fraction of a second. It is
       meant to be almost missed: peak alpha is under a tenth. */
    if (this.smooth > 0.86 && quality.tier !== 'low') {
      const t = 1 - Math.abs((this.smooth - 0.91) / 0.05);
      if (t > 0) this.reflection(cw, ch, clamp(t, 0, 1) * 0.09);
    }
  }

  private reflection(w: number, h: number, alpha: number): void {
    const c = this.ctx;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = alpha;
    const cx = w * 0.5;
    const cy = h * 0.46;
    const r = Math.min(w, h) * 0.18;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(190,210,235,1)');
    g.addColorStop(0.55, 'rgba(120,140,170,.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(cx, cy, r * 0.62, r, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(cx, cy + r * 0.95, r * 1.05, r * 0.7, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  private nearest(i: number): ImageBitmap | HTMLImageElement | null {
    const n = this.imgs.length;
    let k = clamp(i, 0, n - 1);
    let im = this.imgs[k];
    /* Hold the nearest decoded frame rather than flashing a gap. */
    while (!im && k > 0) im = this.imgs[--k] ?? null;
    return im ?? null;
  }

  private cover(im: ImageBitmap | HTMLImageElement, cw: number, ch: number): void {
    const iw = 'naturalWidth' in im ? im.naturalWidth : im.width;
    const ih = 'naturalHeight' in im ? im.naturalHeight : im.height;
    const s = Math.max(cw / iw, ch / ih);
    this.ctx.drawImage(im, (cw - iw * s) / 2, (ch - ih * s) * 0.42, iw * s, ih * s);
  }

  pause(): void { if (this.job) this.job.live = false; }
  resume(): void { if (this.job) { this.job.live = true; this.job.dirty = true; } }

  unmount(): void {
    if (this.job) clock.remove(this.job);
    this.job = null;
    /* The reel is the biggest thing this page holds. Dropping the references
       is what lets the decoder hand the memory back. */
    this.releaseAll();
    this.imgs = [];
    this.srcs = [];
    this.pending.clear();
    /* Without this the cut still looks chosen after an unmount and `useCut`
       returns early on the way back in, leaving the reel empty. */
    this.cut = null;
    this.manifest = null;
    this.cv.width = this.cv.height = 1;
  }
}

let instance: Hero | null = null;
export function create(): World { instance ??= new Hero(); return instance; }
/** The loader needs the reel's priming progress; it is 40% of the pour. */
export function primeReporter(fn: (v: number) => void): void { (create() as Hero).setPrimeReporter(fn); }
