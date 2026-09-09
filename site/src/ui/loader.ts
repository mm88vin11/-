/**
 * The opening.
 *
 * The shape of it, in order: a dark field that is already moving before
 * anything else exists → the mark arriving out of depth as an empty outline →
 * the real load pouring into that outline as liquid → a beat at full → the
 * mark flying into the header while the field opens on the hero.
 *
 * Two rules made most of the decisions here.
 *
 *  · The pour is never a lie. The level is a weighted sum of things that have
 *    genuinely finished, it never moves backwards, and it never sits still for
 *    more than 800 ms — if the network stalls it drifts, slowly, so the page
 *    reads as working rather than as hung. There is a hard 3.5 s ceiling.
 *  · The handoff is measured, not eyeballed. Both rectangles are read in the
 *    same frame and the difference is run as one transform, so the mark cannot
 *    change size at the moment it becomes the header logo.
 */
import gsap from 'gsap';
import { clock } from '../core/ticker';
import { quality } from '../core/quality';
import { ShaderLayer, GLSL_HEAD } from '../core/gl';
import { clamp, need } from '../core/dom';
import markEto from '../assets/img/mark-eto.webp';
import markBaza from '../assets/img/mark-baza.webp';

const WEIGHTS = {
  fonts: 0.15,
  hero: 0.40,
  world: 0.25,
  /* The brief allotted 10% to decoding the audio sprite. There is no sprite —
     sound is synthesised — so the share went to the thing that actually costs
     time before first paint: compiling the seam and loader shader programs. */
  shaders: 0.10,
  runtime: 0.10,
} as const;

type Stage = keyof typeof WEIGHTS;

const BG_FRAG = `${GLSL_HEAD('mediump')}
uniform float uFade;
void main(){
  vec2 uv = vUv;
  vec2 p = (gl_FragCoord.xy - uRes * 0.5) / uRes.y;
  /* Two octaves, moving at a quarter of the speed you would guess. The blur is
     in the field itself — a CSS filter over a full-screen element costs more
     than the whole shader does. */
  float n = fbm2(p * 1.6 + vec2(uTime * 0.012, uTime * -0.008));
  float n2 = fbm2(p * 0.7 - vec2(uTime * 0.006, 0.0));
  float v = n * 0.55 + n2 * 0.45;
  float vig = 1.0 - dot(p, p) * 0.55;
  vec3 deep = vec3(0.023, 0.027, 0.035);
  vec3 lift = vec3(0.075, 0.082, 0.098);
  vec3 col = mix(deep, lift, v * vig);
  col += vec3(0.02, 0.015, 0.0) * smoothstep(0.4, 1.0, v) * vig;
  outColor = vec4(col * uFade, uFade);
}`;

export interface LoaderHandle {
  /** report a stage as done (0..1 within that stage) */
  set(stage: Stage, value: number): void;
  /** resolves when the field has opened and the page is live */
  done: Promise<void>;
}

export function startLoader(): LoaderHandle {
  const root = need('#load');
  const markBox = need('.load__mark');
  const pct = need('#loadPct');
  const bgCanvas = need<HTMLCanvasElement>('#loadBg');
  const cv = need<HTMLCanvasElement>('#loadLiquid');
  const ctx = cv.getContext('2d', { alpha: true })!;

  const quick = sessionStorage.getItem('baza.seen') === '1';
  sessionStorage.setItem('baza.seen', '1');

  let resolveDone: () => void;
  const done = new Promise<void>((res) => { resolveDone = res; });

  const progress: Record<Stage, number> = { fonts: 0, hero: 0, world: 0, shaders: 0, runtime: 0 };
  let shown = 0;
  let target = 0;
  let lastMove = performance.now();
  let landed = false;

  /* ——— the field ——————————————————————————————————————————————————————— */
  let fade = 1;
  let bg = quality.state.webgl2
    ? new ShaderLayer({ canvas: bgCanvas, frag: BG_FRAG, dpr: () => Math.min(quality.dpr, 1.5),
                        uniforms: { uFade: () => fade } })
    : null;
  if (!bg?.ok) bgCanvas.style.display = 'none';

  /**
   * The loader was the one thing on the page ignoring its own ladder.
   *
   * It runs before anything is known about what this device costs, so it opens
   * optimistically — and then kept a full-screen two-octave noise field alive
   * even after the ladder had decided the machine could not hold it. Measured
   * on the cold-load pass, that was the whole of the opening's blocking time:
   * `boot` frames at 4 fps and every one of the 57 long tasks inside the first
   * six seconds. At rest immediately afterwards, the same page runs at 60.0 fps
   * with a worst frame of 19 ms and no long tasks at all.
   *
   * There is a designed ground behind the canvas — the radial gradient in
   * `loader.css`, which is there precisely so nothing flashes before the
   * shader compiles — so dropping the field costs a texture, not a picture.
   */
  const unpinTier = quality.onChange((tier) => {
    if (tier !== 'low' || !bg) return;
    bg.destroy();
    bg = null;
    bgCanvas.style.display = 'none';
  });

  /* ——— the mark ————————————————————————————————————————————————————————
     The outline is derived from the artwork's own alpha: the silhouette is
     drawn eight times at a small offset to dilate it, then the original is
     punched back out. That leaves a real contour of the letterforms rather
     than a rectangle or a hand-traced path that would drift from the mark. */
  const marks = [
    { src: markEto, w: 640, h: 134, y: 0 },
    { src: markBaza, w: 640, h: 111, y: 134 },
  ];
  const MARK_W = 640;
  const MARK_H = 245;
  let outline: HTMLCanvasElement | null = null;
  let silhouette: HTMLCanvasElement | null = null;

  const loaded = Promise.all(marks.map((m) => new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = m.src;
  })));

  /* ——— liquid state ————————————————————————————————————————————————————— */
  let level = 0;          /* 0..1, eased toward `shown` */
  let calm = 0;           /* 1 while the surface is settling at the end */
  const drops: { x: number; y: number; v: number; r: number }[] = [];

  function paint(t: number): void {
    if (!silhouette || !outline) return;
    const w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);
    if (level > 0.001) {
      const surf = h * (1.04 - level * 1.08);
      const amp = h * 0.016 * (1 - calm) * (0.35 + level * 0.65);

      /* Two sine trains at different frequency and phase. One is a wave; two is
         a surface — the beat between them is what stops it reading as a loop. */
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, surf);
      const step = Math.max(4, w / 90);
      for (let x = 0; x <= w; x += step) {
        const y = surf
          + Math.sin(x * 0.011 + t * 0.0021) * amp
          + Math.sin(x * 0.027 - t * 0.0033) * amp * 0.52;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();

      const g = ctx.createLinearGradient(0, h, 0, surf - amp);
      g.addColorStop(0, '#c69a12');
      g.addColorStop(0.55, '#f0c43a');
      g.addColorStop(1, '#fff0b0');
      ctx.fillStyle = g;
      ctx.fill();

      /* The meniscus: a bright lip riding the surface, plus a soft bloom over
         it. Both are strokes on the path we already have. */
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, surf);
      for (let x = 0; x <= w; x += step) {
        const y = surf
          + Math.sin(x * 0.011 + t * 0.0021) * amp
          + Math.sin(x * 0.027 - t * 0.0033) * amp * 0.52;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(255,247,214,.95)';
      ctx.lineWidth = Math.max(1.5, h * 0.008);
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,214,90,.32)';
      ctx.lineWidth = Math.max(4, h * 0.03);
      ctx.stroke();
      ctx.restore();

      /* Six droplets, ever. They leave the surface and fall back into it. */
      if (drops.length < 6 && Math.random() < 0.035 && level > 0.12 && level < 0.99) {
        drops.push({ x: Math.random() * w, y: surf, v: -(0.6 + Math.random() * 1.1) * (h / 160), r: (1.2 + Math.random() * 1.6) * (w / 640) });
      }
      ctx.fillStyle = '#ffe9a0';
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]!;
        d.y += d.v; d.v += 0.075 * (h / 160);
        if (d.y > surf + 4) { drops.splice(i, 1); continue; }
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.29); ctx.fill();
      }

      /* Clip everything painted so far to the letterforms. */
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(silhouette, 0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(outline, 0, 0, w, h);
  }

  function build(imgs: HTMLImageElement[]): void {
    const scale = 2;
    const sil = document.createElement('canvas');
    sil.width = MARK_W * scale; sil.height = MARK_H * scale;
    const sc = sil.getContext('2d')!;
    imgs.forEach((im, i) => {
      const m = marks[i]!;
      sc.drawImage(im, 0, m.y * scale, m.w * scale, m.h * scale);
    });
    silhouette = sil;

    const out = document.createElement('canvas');
    out.width = sil.width; out.height = sil.height;
    const oc = out.getContext('2d')!;
    const r = Math.max(2, Math.round(scale * 1.6));
    for (let a = 0; a < 8; a++) {
      const dx = Math.round(Math.cos((a / 8) * Math.PI * 2) * r);
      const dy = Math.round(Math.sin((a / 8) * Math.PI * 2) * r);
      oc.drawImage(sil, dx, dy);
    }
    oc.globalCompositeOperation = 'destination-out';
    oc.drawImage(sil, 0, 0);
    oc.globalCompositeOperation = 'source-in';
    oc.fillStyle = 'rgba(242,235,221,.86)';
    oc.fillRect(0, 0, out.width, out.height);
    outline = out;
  }

  function sizeCanvas(): void {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  }

  /* ——— progress ————————————————————————————————————————————————————————— */
  function recompute(): void {
    let sum = 0;
    for (const k in WEIGHTS) sum += WEIGHTS[k as Stage] * clamp(progress[k as Stage], 0, 1);
    if (sum > target) { target = sum; lastMove = performance.now(); }
  }

  const job = clock.add(({ t }) => {
    const now = performance.now();
    /* Never backwards, never stuck. A stall past 800 ms drifts forward at a
       visible but unhurried rate, capped short of the finish so the arrival is
       still the real one. */
    if (now - lastMove > 800 && target < 0.97) {
      target = Math.min(0.97, target + 0.00018 * (now - lastMove - 800));
    }
    shown += (target - shown) * 0.09;
    if (target - shown < 0.002) shown = target;
    level += (shown - level) * 0.12;
    pct.textContent = `${Math.round(shown * 100)}%`;

    if (shown > 0.999 && !landed) { landed = true; window.setTimeout(finish, 250); }
    if (landed) calm = Math.min(1, calm + 0.02);

    sizeCanvas();
    paint(t);
    if (bg?.ok) bg.draw(t / 1000);
  }, { always: true, order: -200 });

  /* ——— the entrance ————————————————————————————————————————————————————— */
  void loaded.then((imgs) => {
    build(imgs);
    if (quick) { quickExit(); return; }
    /* expo.out with a hair of overshoot: a soft landing, not a bounce. */
    gsap.to(markBox, {
      opacity: 1, scale: 1, filter: 'blur(0px)',
      duration: 0.62, ease: 'expo.out',
      onComplete: () => { gsap.to(markBox, { scale: 1, duration: 0.18, ease: 'power2.out' }); },
    });
    gsap.fromTo(markBox, { scale: 1.6 }, { scale: 0.985, duration: 0.62, ease: 'expo.out' });
    root.classList.add('is-pouring');
  }).catch(() => { finish(); });

  function quickExit(): void {
    root.classList.add('is-quick');
    gsap.to(markBox, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.34, ease: 'power3.out' });
    window.setTimeout(() => {
      gsap.to(markBox, { opacity: 0, duration: 0.22 });
      root.classList.add('is-gone');
      release();
    }, 480);
  }

  function release(): void {
    document.body.classList.add('is-live');
    window.setTimeout(() => {
      root.setAttribute('hidden', '');
      clock.remove(job);
      unpinTier();
      bg?.destroy();
      resolveDone();
    }, 520);
  }

  let finished = false;
  function finish(): void {
    if (finished) return;
    finished = true;
    target = 1;

    const header = document.getElementById('headLogo');
    if (!header || quality.reducedMotion) {
      root.classList.add('is-gone');
      release();
      return;
    }

    /* Both reads happen here, in one frame, before anything moves. */
    const from = markBox.getBoundingClientRect();
    const to = header.getBoundingClientRect();
    if (!from.width || !to.width) { root.classList.add('is-gone'); release(); return; }

    root.style.setProperty('--fx', `${(to.left + to.width / 2) - (from.left + from.width / 2)}px`);
    root.style.setProperty('--fy', `${(to.top + to.height / 2) - (from.top + from.height / 2)}px`);
    root.style.setProperty('--fs', `${to.width / from.width}`);

    /* A beat at full so the pour is seen finishing, then the three moves at
       once: the mark travels, the field opens, the hero is already there. */
    window.setTimeout(() => {
      root.classList.add('is-flying');
      gsap.to({ v: 1 }, { v: 0, duration: 0.7, ease: 'power2.in', onUpdate() { fade = (this['targets']()[0] as { v: number }).v; } });
      window.setTimeout(() => { root.classList.add('is-gone'); }, 120);
      window.setTimeout(release, 620);
    }, 180);
  }

  /* Hard ceiling: 3.5 s and the field opens whatever the network is doing. */
  const ceiling = window.setTimeout(() => { target = 1; shown = Math.max(shown, 0.995); finish(); }, quick ? 900 : 3500);
  void done.then(() => window.clearTimeout(ceiling));

  return {
    set(stage: Stage, value: number): void { progress[stage] = clamp(value, 0, 1); recompute(); },
    done,
  };
}
