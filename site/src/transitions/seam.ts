/**
 * The seam engine.
 *
 * One canvas, one WebGL2 context, one program per seam compiled the first time
 * that seam comes within reach and kept afterwards. At most one seam is ever
 * live: outside the 60vh band around a boundary the canvas is not drawn at all
 * and the element is transparent, so the cost of the whole system between
 * transitions is zero.
 *
 * Degradation is built in rather than promised: on the low tier and under
 * prefers-reduced-motion every seam becomes the same 250 ms crossfade with a
 * small vertical shift, drawn in 2D. That path is the one the QA run exercises
 * with `?tier=low`.
 */
import { clock, type Job } from '../core/ticker';
import { quality } from '../core/quality';
import { LOOKS } from '../core/world';
import type { WorldSound } from '../core/audio-bus';
import { clamp, damp, need } from '../core/dom';
import { layout } from '../core/layout';
import { SEAMS } from './shaders';

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

interface Boundary {
  readonly key: string;
  readonly from: WorldSound;
  readonly to: WorldSound;
}

/** Live seam state, readable from the console and from the QA harness. */
const seamState: { key: string | null; p: number } = { key: null, p: 0 };
(window as unknown as { __BAZA_SEAM: typeof seamState }).__BAZA_SEAM = seamState;

export class SeamEngine {
  private canvas: HTMLCanvasElement;
  /* The fallback is a plain element, not a second use of the canvas. A canvas
     can only ever hold one context type, so asking a canvas that has already
     served WebGL for a 2D context returns null — and a canvas whose WebGL
     context has been released paints white. That combination is what put a
     white sheet over the site on every downgraded device. */
  private fade: HTMLElement;
  private gl: WebGL2RenderingContext | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buf: WebGLBuffer | null = null;
  private programs = new Map<string, WebGLProgram>();
  private locs = new Map<string, Map<string, WebGLUniformLocation | null>>();
  private boundaries: Boundary[] = [];
  private job: Job | null = null;
  private active: Boundary | null = null;
  private speed = 0;
  private lastY = 0;
  private simple = false;

  constructor() {
    this.canvas = need<HTMLCanvasElement>('#seam');
    this.fade = need('#seamFade');
  }

  boot(order: WorldSound[]): void {
    for (let i = 0; i < order.length - 1; i++) {
      const from = order[i]!;
      const to = order[i + 1]!;
      this.boundaries.push({ key: `${from}>${to}`, from, to });
    }

    this.simple = quality.reducedMotion || quality.tier === 'low' || !quality.gl;
    if (!this.simple) this.initGL();
    if (!this.gl) this.simple = true;
    this.applyMode();

    quality.onChange((tier) => {
      const next = quality.reducedMotion || tier === 'low' || !quality.gl;
      if (next === this.simple) return;
      /* A downgrade mid-scroll drops the programs and switches to the plain
         crossfade rather than trying to keep both paths alive. */
      this.simple = next;
      if (next) this.disposeGL();
      this.applyMode();
    });

    this.job = clock.add(({ y, vh, t, k }) => {
      this.speed = damp(this.speed, clamp(Math.abs(y - this.lastY) / 60, 0, 1), 0.2, k);
      this.lastY = y;

      const band = vh * 0.6;
      let live: Boundary | null = null;
      let p = 0;
      const mid = y + vh * 0.5;
      /* The nearest boundary, not the first one within reach: two joins can be
         inside the band at once on a tall viewport, and picking the first in
         document order is how the wrong seam ends up on screen. */
      let bestD = Infinity;
      for (const b of this.boundaries) {
        const d = mid - layout.get(b.to).top;
        if (Math.abs(d) > band || Math.abs(d) >= Math.abs(bestD)) continue;
        bestD = d;
        live = b;
      }
      if (live) p = clamp((bestD + band) / (band * 2), 0, 1);

      if (!live) {
        if (this.active) {
          this.active = null;
          this.canvas.classList.remove('is-on');
          this.fade.style.opacity = '0';
        }
        seamState.key = null;
        return;
      }
      if (this.active !== live) { this.active = live; this.canvas.classList.add('is-on'); }
      /* Published for the QA harness: which seam is live and how far through it
         is. Two numbers, and they turn "the screen went white" from a mystery
         into a lookup. */
      seamState.key = live.key;
      seamState.p = p;
      this.draw(live, p, t);
    }, { always: true, order: 500 });
  }

  /** Exactly one of the two layers is ever in the tree's paint path. */
  private applyMode(): void {
    this.canvas.style.display = this.simple ? 'none' : '';
    this.fade.style.display = this.simple ? '' : 'none';
  }

  private initGL(): void {
    /* Straight alpha, not premultiplied. The shaders emit `vec4(colour, a)`
       with the colour at full strength; telling the compositor to treat that as
       premultiplied washes every seam out to flat grey — which is exactly what
       the 768px screenshots caught. */
    const gl = this.canvas.getContext('webgl2', {
      alpha: true, antialias: false, depth: false, premultipliedAlpha: false, powerPreference: 'high-performance',
    });
    if (!gl) return;
    this.gl = gl;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private disposeGL(): void {
    const gl = this.gl;
    if (!gl) return;
    for (const p of this.programs.values()) gl.deleteProgram(p);
    this.programs.clear();
    this.locs.clear();
    if (this.buf) gl.deleteBuffer(this.buf);
    if (this.vao) gl.deleteVertexArray(this.vao);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.gl = null;
  }

  private program(key: string): WebGLProgram | null {
    const gl = this.gl;
    if (!gl) return null;
    const cached = this.programs.get(key);
    if (cached) return cached;
    const src = SEAMS[key];
    if (!src) return null;

    const compile = (type: number, s: string): WebGLShader | null => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, s);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        if (import.meta.env.DEV) console.warn(key, gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, src);
    if (!vs || !fs) return null;
    const pr = gl.createProgram()!;
    gl.attachShader(pr, vs); gl.attachShader(pr, fs);
    gl.bindAttribLocation(pr, 0, 'aPos');
    gl.linkProgram(pr);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { gl.deleteProgram(pr); return null; }
    this.programs.set(key, pr);
    this.locs.set(key, new Map());
    return pr;
  }

  private loc(key: string, pr: WebGLProgram, name: string): WebGLUniformLocation | null {
    const map = this.locs.get(key)!;
    if (!map.has(name)) map.set(name, this.gl!.getUniformLocation(pr, name));
    return map.get(name) ?? null;
  }

  private size(): { w: number; h: number } {
    const dpr = quality.shaderDpr();
    const w = Math.max(1, Math.round(window.innerWidth * dpr));
    const h = Math.max(1, Math.round(window.innerHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl?.viewport(0, 0, w, h);
    }
    return { w, h };
  }

  private draw(b: Boundary, p: number, t: number): void {
    const { w, h } = this.size();
    const a = LOOKS[b.from];
    const c = LOOKS[b.to];

    if (this.simple || !this.gl) {
      /* The one thing every seam degrades to: a 250 ms crossfade with a small
         vertical shift. Two composited properties, no canvas involved — see the
         note on `fade` for why this cannot share the canvas. */
      const k = clamp((p - 0.42) / 0.16, 0, 1);
      if (k <= 0 || k >= 1) { this.fade.style.opacity = '0'; return; }
      const rgb = (v: readonly [number, number, number]): string =>
        `rgb(${Math.round(v[0] * 255)} ${Math.round(v[1] * 255)} ${Math.round(v[2] * 255)})`;
      this.fade.style.background = rgb(k < 0.5 ? a.base : c.base);
      this.fade.style.opacity = String(Math.sin(k * Math.PI) * 0.75);
      this.fade.style.transform = `translate3d(0,${((1 - k) * 10).toFixed(1)}px,0)`;
      return;
    }

    const gl = this.gl;
    const pr = this.program(b.key);
    if (!pr) return;
    gl.useProgram(pr);
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(this.loc(b.key, pr, 'uP'), p);
    gl.uniform1f(this.loc(b.key, pr, 'uTime'), t / 1000);
    gl.uniform1f(this.loc(b.key, pr, 'uSpeed'), this.speed);
    gl.uniform2f(this.loc(b.key, pr, 'uRes'), w, h);
    gl.uniform3f(this.loc(b.key, pr, 'uA'), a.base[0], a.base[1], a.base[2]);
    gl.uniform3f(this.loc(b.key, pr, 'uAa'), a.accent[0], a.accent[1], a.accent[2]);
    gl.uniform3f(this.loc(b.key, pr, 'uB'), c.base[0], c.base[1], c.base[2]);
    gl.uniform3f(this.loc(b.key, pr, 'uBa'), c.accent[0], c.accent[1], c.accent[2]);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  destroy(): void {
    if (this.job) clock.remove(this.job);
    this.job = null;
    this.disposeGL();
  }
}
