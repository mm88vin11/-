/**
 * A fullscreen fragment-shader layer, in about a hundred lines.
 *
 * Why not a library: every WebGL surface on this site is one triangle with one
 * fragment shader — the loader background, the rain, the fog, the seams. A
 * scene-graph library is 14–150 KB to hand us a quad we already have. three is
 * pulled in only where there is an actual scene (the road, the bench blocks),
 * and it lands in its own chunk.
 *
 * Everything here is explicit about disposal: `destroy()` releases the program,
 * the buffer and the context, because "pause the world" has to mean the GPU
 * stops holding its memory too.
 */
export interface ShaderLayerOpts {
  readonly canvas: HTMLCanvasElement;
  readonly frag: string;
  /** custom uniforms, sampled every draw */
  readonly uniforms?: Record<string, () => number | number[]>;
  readonly alpha?: boolean;
  readonly dpr?: number;
}

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

export class ShaderLayer {
  readonly ok: boolean;
  private gl: WebGL2RenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private buf: WebGLBuffer | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private locs = new Map<string, WebGLUniformLocation | null>();
  private readonly cv: HTMLCanvasElement;
  private readonly uni: Record<string, () => number | number[]>;
  private dpr: number;
  private w = 0;
  private h = 0;

  constructor(opts: ShaderLayerOpts) {
    this.cv = opts.canvas;
    this.uni = opts.uniforms ?? {};
    this.dpr = opts.dpr ?? 1;

    const gl = this.cv.getContext('webgl2', {
      alpha: opts.alpha ?? true,
      antialias: false,
      depth: false,
      stencil: false,
      /* Straight alpha: every layer emits full-strength colour with a separate
         alpha, and that is what the compositor has to be told to expect. */
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    if (!gl) { this.ok = false; return; }

    const prog = link(gl, VERT, opts.frag);
    if (!prog) { this.ok = false; return; }

    this.gl = gl;
    this.prog = prog;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.ok = true;
  }

  setDpr(dpr: number): void { this.dpr = dpr; this.w = 0; }

  /** Resizes the drawing buffer when the box changed. Cheap to call per frame. */
  private size(): boolean {
    const gl = this.gl;
    if (!gl) return false;
    const r = this.cv.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * this.dpr));
    const h = Math.max(1, Math.round(r.height * this.dpr));
    if (w === this.w && h === this.h) return true;
    this.w = w; this.h = h;
    this.cv.width = w; this.cv.height = h;
    gl.viewport(0, 0, w, h);
    return true;
  }

  private loc(name: string): WebGLUniformLocation | null {
    if (!this.locs.has(name)) this.locs.set(name, this.gl!.getUniformLocation(this.prog!, name));
    return this.locs.get(name) ?? null;
  }

  draw(time: number): void {
    const gl = this.gl;
    if (!gl || !this.prog) return;
    this.size();
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);

    const res = this.loc('uRes');
    if (res) gl.uniform2f(res, this.w, this.h);
    const t = this.loc('uTime');
    if (t) gl.uniform1f(t, time);

    for (const key in this.uni) {
      const l = this.loc(key);
      if (!l) continue;
      const v = this.uni[key]!();
      if (typeof v === 'number') gl.uniform1f(l, v);
      else if (v.length === 2) gl.uniform2f(l, v[0]!, v[1]!);
      else if (v.length === 3) gl.uniform3f(l, v[0]!, v[1]!, v[2]!);
      else if (v.length === 4) gl.uniform4f(l, v[0]!, v[1]!, v[2]!, v[3]!);
    }

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  destroy(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.prog) gl.deleteProgram(this.prog);
    if (this.buf) gl.deleteBuffer(this.buf);
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.locs.clear();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.gl = null; this.prog = null; this.buf = null; this.vao = null;
  }
}

function link(gl: WebGL2RenderingContext, vsrc: string, fsrc: string): WebGLProgram | null {
  const vs = compile(gl, gl.VERTEX_SHADER, vsrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsrc);
  if (!vs || !fs) return null;
  const p = gl.createProgram();
  if (!p) return null;
  gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    if (import.meta.env.DEV) console.warn('link failed:', gl.getProgramInfoLog(p));
    gl.deleteProgram(p);
    return null;
  }
  return p;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    if (import.meta.env.DEV) console.warn('compile failed:', gl.getShaderInfoLog(s), src);
    gl.deleteShader(s);
    return null;
  }
  return s;
}

/**
 * The noise every shader on this site shares, as a string to prepend.
 * `mediump` on coarse pointers: a phone paying highp for a background gradient
 * is paying for precision nobody can see.
 */
export const GLSL_HEAD = (precision: 'highp' | 'mediump' = 'mediump'): string => `#version 300 es
precision ${precision} float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uRes;
uniform float uTime;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}
/* Two octaves. Not five: on a full-screen quad each octave is another pass over
   every pixel, and the third one is never the difference between good and bad. */
float fbm2(vec2 p){ return noise(p) * 0.62 + noise(p * 2.07 + 13.1) * 0.31; }
`;
