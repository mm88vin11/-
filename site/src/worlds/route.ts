/**
 * 06 · МАРШРУТ — the road.
 *
 * Rebuilt from nothing. The old section was a speedometer widget over a flat
 * texture and the metaphor never landed: a dial is something you look at, and
 * this is meant to be something you are inside.
 *
 * So: a first-person road climbing out of the dark, drawn as real geometry.
 * Scroll is the accelerator. Stop scrolling and the car brakes and the world
 * settles. Speed is legible four ways at once — the dashes stretch, the
 * periphery smears, the camera's field of view opens from 65° to 88°, and the
 * hum rises in pitch. There is no number anywhere.
 *
 * The budget the brief set for this scene: ≤12 000 triangles, ≤8 draw calls,
 * one texture atlas. What it actually costs:
 *
 *   sky quad          2 tris    1 draw
 *   road quad         2 tris    1 draw   (surface, markings and smear are all
 *                                         in the fragment shader)
 *   guardrails       960 tris   1 draw   (80 instances of a box)
 *   lamps            168 tris   1 draw   (14 instances)
 *   sign posts        72 tris   1 draw   (6 instances)
 *   fire plane         2 tris   1 draw   (only alive at the summit)
 *   ————————————————————————————————————
 *   1 206 tris, 6 draws, 0 textures.
 *
 * Zero textures rather than one atlas: every marking, the skyline and the fire
 * are procedural, and the sign copy lives in the DOM where a screen reader can
 * reach it — a texture would have made the text unreadable to half the people
 * the section is for.
 */
/* Named imports, not a namespace import: `import * as THREE` keeps the
   whole library reachable and the bundler cannot drop anything. */
import {
  AdditiveBlending,
  BoxGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { IUniform, Material } from 'three';
import type { World } from '../core/world';
import { LOOKS } from '../core/world';
import { clock, type Job } from '../core/ticker';
import { quality } from '../core/quality';
import { audio } from '../core/audio-bus';
import { $$, clamp, damp, el, esc, need } from '../core/dom';
import { store } from '../ui/store';
import { ROUTE_STAGES } from '../data/content';

const RAILS = 80;
const LAMPS = 14;
const SEG = 12;          /* metres between guardrail posts */
const ROAD_LEN = RAILS * SEG;

const SKY_VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.999, 1.0); }`;

const SKY_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform float uDawn;     /* 0 at the bottom of the hill, 1 at the summit */
uniform float uTime;

float hash(float n){ return fract(sin(n) * 43758.5453); }

void main(){
  vec2 uv = vUv;
  /* Night to dawn, as one gradient that changes both ends. */
  vec3 low  = mix(vec3(0.027, 0.031, 0.050), vec3(0.98, 0.62, 0.32), uDawn);
  vec3 high = mix(vec3(0.008, 0.010, 0.020), vec3(0.20, 0.34, 0.62), uDawn);
  vec3 col = mix(low, high, smoothstep(0.30, 1.0, uv.y));

  /* The city on the horizon: procedural blocks, only visible once the sky is
     light enough behind them to read as a skyline. */
  float band = smoothstep(0.34, 0.30, uv.y) * smoothstep(0.16, 0.30, uv.y);
  float x = uv.x * 42.0;
  float i = floor(x);
  float h = 0.30 + hash(i) * 0.055 * uDawn;
  float city = step(uv.y, h) * band * uDawn;
  col = mix(col, mix(vec3(0.05,0.05,0.09), vec3(0.12,0.10,0.16), uDawn), city);

  /* A few windows, lit, deterministic. */
  float win = step(0.86, hash(floor(x * 3.0) + floor(uv.y * 220.0) * 0.37)) * city;
  col += vec3(1.0, 0.85, 0.5) * win * 0.5 * uDawn;

  /* Sun, low and to the right, only near the top. */
  vec2 s = vec2(0.72, 0.31);
  float d = distance(vec2(uv.x, uv.y * 1.6), vec2(s.x, s.y * 1.6));
  col += vec3(1.0, 0.72, 0.38) * smoothstep(0.30, 0.0, d) * uDawn * 0.9;

  gl_FragColor = vec4(col, 1.0);
}`;

const ROAD_VERT = `
varying vec2 vUv;
varying float vFog;
uniform float uClimb;
void main(){
  vUv = uv;
  vec3 p = position;
  /* The hill: the far end of the roadway lifts, so the horizon sits above the
     camera and the drive reads as a climb rather than a plain. */
  float t = clamp(-p.y / 400.0, 0.0, 1.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  mv.y += t * t * uClimb;
  vFog = t;
  gl_Position = projectionMatrix * mv;
}`;

const ROAD_FRAG = `
precision mediump float;
varying vec2 vUv;
varying float vFog;
uniform float uOffset;   /* metres travelled */
uniform float uSpeed;    /* 0..1 */
uniform float uDawn;

/* One marking sample: centre dashes plus the two edge lines. */
float marks(vec2 uv, float offset, float dash){
  float lane = 0.0;
  float z = uv.y * 400.0 + offset;
  float d = fract(z / dash);
  float centre = smoothstep(0.012, 0.0, abs(uv.x - 0.5)) * step(d, 0.42);
  float edgeL = smoothstep(0.016, 0.0, abs(uv.x - 0.085));
  float edgeR = smoothstep(0.016, 0.0, abs(uv.x - 0.915));
  lane = max(centre, max(edgeL, edgeR) * 0.7);
  return lane;
}

void main(){
  vec2 uv = vUv;
  /* Dashes stretch with speed: the same paint, longer strokes, which is what
     speed actually looks like from a car. */
  float dash = mix(9.0, 26.0, uSpeed);

  /* Peripheral smear. Three samples, only away from the centre of the frame,
     and only when moving — cheap because the marking is a function, not a
     texture fetch. */
  float edge = smoothstep(0.28, 0.5, abs(uv.x - 0.5)) * uSpeed;
  float m = marks(uv, uOffset, dash);
  if (edge > 0.01) {
    float k = edge * 14.0;
    m = (m + marks(uv, uOffset + k, dash) + marks(uv, uOffset - k, dash)) / 3.0;
  }

  vec3 tarmac = mix(vec3(0.055, 0.058, 0.070), vec3(0.14, 0.13, 0.14), uDawn * 0.6);
  vec3 paint = mix(vec3(0.85, 0.82, 0.72), vec3(1.0, 0.95, 0.85), uDawn);
  vec3 col = mix(tarmac, paint, m);

  /* Distance haze, tinted with the sky so the two never disagree. */
  vec3 haze = mix(vec3(0.027, 0.031, 0.050), vec3(0.86, 0.55, 0.34), uDawn);
  col = mix(col, haze, smoothstep(0.45, 1.0, vFog));
  gl_FragColor = vec4(col, 1.0);
}`;

const FIRE_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform float uTime;
uniform float uLife;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}
void main(){
  vec2 uv = vUv;
  float band = smoothstep(0.0, 0.18, uv.x) * smoothstep(1.0, 0.82, uv.x);
  float n = noise(vec2(uv.x * 8.0, uv.y * 3.0 - uTime * 3.0));
  float trail = smoothstep(0.35, 1.0, n) * band * (1.0 - uv.y);
  vec3 col = mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.85, 0.35), trail);
  gl_FragColor = vec4(col, trail * uLife * 0.8);
}`;

class Route implements World {
  readonly id = 'route' as const;
  readonly look = LOOKS.route;

  private section!: HTMLElement;
  private job: Job | null = null;

  private renderer: WebGLRenderer | null = null;
  private scene: Scene | null = null;
  private cam: PerspectiveCamera | null = null;
  private uniforms: Record<string, IUniform> = {};
  private rails: InstancedMesh | null = null;
  private lamps: InstancedMesh | null = null;
  private posts: InstancedMesh | null = null;
  private fire: Mesh | null = null;

  private offset = 0;
  private speed = 0;
  private speedTarget = 0;
  private lastP = 0;
  /* Cached section geometry, refreshed on resize only. */
  private box = { top: 0, run: 1 };
  private dawn = 0;
  private signNodes: HTMLElement[] = [];
  private passed = new Set<number>();
  private summitAt = 0;

  mount(section: HTMLElement): void {
    this.section = section;
    this.buildDates();
    this.buildSigns();
    if (quality.gl) this.buildGL();

    const measure = (): void => {
      this.box = { top: section.offsetTop, run: Math.max(1, section.offsetHeight - window.innerHeight) };
      this.resize();
    };
    clock.once(measure);

    this.job = clock.add(({ t, k, y }) => {
      const p = clamp((y - this.box.top) / this.box.run, 0, 1);

      /* Scroll is the throttle: the pedal is how fast p is changing, not where
         p is. Stop scrolling and the car coasts down to nothing. */
      const dp = Math.abs(p - this.lastP);
      this.lastP = p;
      this.speedTarget = clamp(dp * 90, 0, 1);
      this.speed = damp(this.speed, this.speedTarget, this.speedTarget > this.speed ? 0.14 : 0.05, k);
      this.offset += this.speed * 4.6 * k;
      this.dawn = damp(this.dawn, p, 0.06, k);

      audio.setPitch(1 + this.speed * 0.45);
      this.updateSigns(p);
      this.render(t);
    }, { always: true, resize: measure });
  }

  private buildDates(): void {
    const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const fmt = (d: Date): string => `${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]} ${d.getFullYear()}`;
    const now = new Date();
    need('#dateDest', this.section).textContent = fmt(new Date(now.getTime() + 21 * 864e5));
    need('#dateNow', this.section).textContent = fmt(now);
    need('#dateLast', this.section).textContent = fmt(new Date(now.getTime() - 96 * 864e5));
  }

  /** The copy and the decisions live in the DOM. The 3D is scenery. */
  private buildSigns(): void {
    const host = need('#roadSigns', this.section);
    if (host.childElementCount) { this.signNodes = $$('.sign', host); return; }
    const now = new Date();
    ROUTE_STAGES.forEach((s) => {
      const d = new Date(now.getTime() + s.d * 864e5);
      const node = el('article', 'sign');
      node.innerHTML =
        `<p class="sign__w">${esc(s.w)} · ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}</p>` +
        `<h3>${esc(s.h)}</h3><p>${esc(s.p)}</p>` +
        `<div class="sign__ask"><u>${esc(s.ask)}</u><div class="sign__row">` +
        s.a.map((a) => `<button class="chip" type="button" aria-pressed="false">${esc(a)}</button>`).join('') +
        `</div></div>`;
      host.appendChild(node);
      this.signNodes.push(node);

      $$('button', node).forEach((b) => {
        b.addEventListener('click', () => {
          $$('button', node).forEach((x) => x.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', 'true');
          const prev = store.get<string[]>('route.answers', []);
          const line = `${s.ask} — ${b.textContent}`;
          store.set('route.answers', [...prev.filter((x) => !x.startsWith(s.ask)), line]);
          audio.click();
        });
      });
    });
  }

  private updateSigns(p: number): void {
    const vh = window.innerHeight;
    for (let i = 0; i < this.signNodes.length; i++) {
      const node = this.signNodes[i]!;
      const r = node.getBoundingClientRect();
      const centre = r.top + r.height / 2;
      const near = centre > vh * 0.05 && centre < vh * 0.95;
      node.classList.toggle('is-near', near);
      /* A short whistle as each one goes by, once. */
      if (near && !this.passed.has(i)) { this.passed.add(i); audio.doppler(); }
    }
    /* The summit: the horizon, held for two seconds and no longer. */
    if (p > 0.93 && !this.summitAt) {
      this.summitAt = performance.now();
      audio.whoosh(true);
    }
  }

  /* ─────────────────────────────────────────────────────────────── GL ── */
  private buildGL(): void {
    const cv = need<HTMLCanvasElement>('#roadC', this.section);
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas: cv, antialias: false, alpha: false, powerPreference: 'high-performance' });
    } catch { cv.style.display = 'none'; return; }
    renderer.setPixelRatio(Math.min(quality.dpr, quality.coarse ? 1.5 : 2));
    this.renderer = renderer;

    const scene = new Scene();
    this.scene = scene;
    const cam = new PerspectiveCamera(65, 1, 0.5, 900);
    cam.position.set(0, 2.4, 0);
    cam.rotation.x = -0.06;
    this.cam = cam;

    this.uniforms = {
      uOffset: { value: 0 }, uSpeed: { value: 0 }, uDawn: { value: 0 },
      uClimb: { value: 26 }, uTime: { value: 0 }, uLife: { value: 0 },
    };

    /* Sky — a screen-space quad drawn behind everything. */
    const sky = new Mesh(
      new PlaneGeometry(2, 2),
      new ShaderMaterial({
        vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
        uniforms: { uDawn: this.uniforms['uDawn']!, uTime: this.uniforms['uTime']! },
        depthWrite: false, depthTest: false,
      }),
    );
    sky.frustumCulled = false;
    sky.renderOrder = -1;
    scene.add(sky);

    /* Roadway — one quad, every marking in the shader. */
    const road = new Mesh(
      new PlaneGeometry(46, 400, 1, 1),
      new ShaderMaterial({
        vertexShader: ROAD_VERT, fragmentShader: ROAD_FRAG,
        uniforms: {
          uOffset: this.uniforms['uOffset']!, uSpeed: this.uniforms['uSpeed']!,
          uDawn: this.uniforms['uDawn']!, uClimb: this.uniforms['uClimb']!,
        },
      }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -200);
    scene.add(road);

    const railGeo = new BoxGeometry(0.22, 1.1, 0.22);
    const railMat = new MeshBasicMaterial({ color: 0x6a6f7d });
    this.rails = new InstancedMesh(railGeo, railMat, RAILS);
    this.rails.instanceMatrix.setUsage(DynamicDrawUsage);
    this.rails.frustumCulled = false;
    scene.add(this.rails);

    const lampGeo = new BoxGeometry(0.16, 6.4, 0.16);
    const lampMat = new MeshBasicMaterial({ color: 0xffb45a });
    this.lamps = new InstancedMesh(lampGeo, lampMat, LAMPS);
    this.lamps.instanceMatrix.setUsage(DynamicDrawUsage);
    this.lamps.frustumCulled = false;
    scene.add(this.lamps);

    const postGeo = new BoxGeometry(0.3, 3.4, 0.3);
    const postMat = new MeshBasicMaterial({ color: 0xff8a1f });
    this.posts = new InstancedMesh(postGeo, postMat, ROUTE_STAGES.length * 2);
    this.posts.instanceMatrix.setUsage(DynamicDrawUsage);
    this.posts.frustumCulled = false;
    scene.add(this.posts);

    /* The fire is a plane with a shader, alive for three seconds at the top. */
    this.fire = new Mesh(
      new PlaneGeometry(14, 40),
      new ShaderMaterial({
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: FIRE_FRAG,
        uniforms: { uTime: this.uniforms['uTime']!, uLife: this.uniforms['uLife']! },
        transparent: true, depthWrite: false, blending: AdditiveBlending,
      }),
    );
    this.fire.rotation.x = -Math.PI / 2;
    this.fire.position.set(0, 0.05, -22);
    scene.add(this.fire);

    this.resize();
  }

  private resize(): void {
    if (!this.renderer || !this.cam) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }

  private render(t: number): void {
    const { renderer, scene, cam } = this;
    if (!renderer || !scene || !cam) return;

    this.uniforms['uOffset']!.value = this.offset;
    this.uniforms['uSpeed']!.value = this.speed;
    this.uniforms['uDawn']!.value = this.dawn;
    this.uniforms['uTime']!.value = t / 1000;

    /* 65° at a standstill, 88° flat out. The number the old speedometer used
       to print is now the thing you feel instead. */
    const fov = 65 + this.speed * 23;
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.rotation.x = -0.06 + this.dawn * 0.05;

    const m = new Matrix4();
    const q = new Quaternion();
    const pos = new Vector3();
    const one = new Vector3(1, 1, 1);

    if (this.rails) {
      for (let i = 0; i < RAILS; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const z = -(((i * SEG * 0.5 - this.offset) % ROAD_LEN + ROAD_LEN) % ROAD_LEN);
        const climb = Math.pow(clamp(-z / 400, 0, 1), 2) * 26;
        pos.set(side * 11.4, 0.55 + climb, z);
        m.compose(pos, q, one);
        this.rails.setMatrixAt(i, m);
      }
      this.rails.instanceMatrix.needsUpdate = true;
    }
    if (this.lamps) {
      for (let i = 0; i < LAMPS; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const z = -(((i * SEG * 3 - this.offset * 0.999) % ROAD_LEN + ROAD_LEN) % ROAD_LEN);
        const climb = Math.pow(clamp(-z / 400, 0, 1), 2) * 26;
        pos.set(side * 13.2, 3.2 + climb, z);
        m.compose(pos, q, one);
        this.lamps.setMatrixAt(i, m);
      }
      this.lamps.instanceMatrix.needsUpdate = true;
    }
    if (this.posts) {
      /* Milestones do not loop: they are at fixed distances along the route. */
      for (let i = 0; i < ROUTE_STAGES.length; i++) {
        const stageZ = -(80 + i * 150) + this.offset % 1e6;
        for (let s = 0; s < 2; s++) {
          const z = clamp(stageZ, -400, 4);
          const climb = Math.pow(clamp(-z / 400, 0, 1), 2) * 26;
          pos.set((s === 0 ? -1 : 1) * 10, 1.7 + climb, z);
          m.compose(pos, q, one);
          this.posts.setMatrixAt(i * 2 + s, m);
        }
      }
      this.posts.instanceMatrix.needsUpdate = true;
    }

    /* Three seconds of fire at the summit, then never again. */
    const life = this.summitAt ? clamp(1 - (performance.now() - this.summitAt) / 3000, 0, 1) : 0;
    this.uniforms['uLife']!.value = life;
    if (this.fire) this.fire.visible = life > 0.01;

    renderer.render(scene, cam);
  }

  pause(): void {
    if (this.job) this.job.live = false;
    this.section.classList.remove('is-live');
  }

  resume(): void {
    if (this.job) { this.job.live = true; this.job.dirty = true; }
    /* The fixed layers only exist while the section owns the viewport. */
    this.section.classList.add('is-live');
    this.resize();
  }

  unmount(): void {
    if (this.job) clock.remove(this.job);
    this.job = null;
    this.section.classList.remove('is-live');
    this.scene?.traverse((o) => {
      const mesh = o as Mesh;
      mesh.geometry?.dispose?.();
      const mat = mesh.material as Material | Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
    });
    this.rails?.dispose(); this.lamps?.dispose(); this.posts?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = null; this.scene = null; this.cam = null;
    this.rails = this.lamps = this.posts = null; this.fire = null;
  }
}

let instance: Route | null = null;
export function create(): World { instance ??= new Route(); return instance; }
