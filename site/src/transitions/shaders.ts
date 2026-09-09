/**
 * Eleven seams, one per boundary.
 *
 * Each is a fragment shader that runs over the whole viewport while the join
 * between two sections is inside a 60vh band — a total of 1.2 screens of
 * scroll, so nobody has to "keep scrolling to see it" and nobody flicking past
 * gets a smear of mush.
 *
 * What the shaders blend: the two worlds' declared looks — a ground colour and
 * an accent each, the same values the sections set in CSS — plus their own
 * geometry, composited *over* the live page. Where a seam's alpha is low the
 * real DOM shows through, so the effect occludes and reveals rather than
 * replacing the page with a photograph of itself. Snapshotting two live
 * sections into textures every frame is the version that would look slightly
 * better and cost more than everything else on the page put together.
 *
 * Shared uniforms: uP (0→1 through the band), uA/uAa (leaving world),
 * uB/uBa (arriving world), uTime, uRes, uSpeed (scroll velocity, 0..1).
 */
export const SEAM_HEAD = `#version 300 es
precision mediump float;
in vec2 vUv;
out vec4 outColor;
uniform float uP;
uniform float uTime;
uniform float uSpeed;
uniform vec2 uRes;
uniform vec3 uA;
uniform vec3 uAa;
uniform vec3 uB;
uniform vec3 uBa;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}
float fbm2(vec2 p){ return noise(p) * 0.62 + noise(p * 2.07 + 13.1) * 0.31; }
`;

/** hero → pain · a fall down the pipe */
const PIPE = `${SEAM_HEAD}
void main(){
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  c.x *= uRes.x / uRes.y;
  float d = length(c);
  /* The mask collapses to the centre and the leaving world is dragged inward
     with it: a radial zoom, done as a widening ring rather than as samples. */
  float r = mix(1.25, 0.0, smoothstep(0.0, 0.86, uP));
  float edge = smoothstep(r + 0.16, r, d);
  float rim = smoothstep(r + 0.05, r, d) - smoothstep(r, r - 0.05, d);
  /* Chromatic split on the rim only, where it reads and costs nothing. */
  vec3 col = mix(uB, uA, edge);
  col.r += rim * 0.5;
  col.b += rim * 0.28;
  col += uAa * rim * 0.35;
  float pull = smoothstep(0.0, 1.0, uP) * 0.4;
  col = mix(col, uA * 0.4, smoothstep(r * 1.9, r, d) * pull);
  outColor = vec4(col, edge * 0.98 + rim);
}`;

/** pain → truth · the world falls apart in columns and becomes rain */
const COLUMNS = `${SEAM_HEAD}
void main(){
  vec2 uv = vUv;
  float cols = 46.0;
  float ci = floor(uv.x * cols);
  float delay = hash(vec2(ci, 3.0)) * 0.45;
  float k = clamp((uP - delay) / 0.55, 0.0, 1.0);
  /* Each column slides down on its own clock, so it disintegrates rather than
     cross-fades. */
  float y = uv.y + k * 1.35;
  float alive = step(y, 1.0);
  vec3 col = uA;
  /* Glyph rain in the gap the column left behind. */
  vec2 g = vec2(uv.x * cols, uv.y * 42.0 + uTime * 6.0 * k);
  float dot = step(0.6, hash(floor(g)));
  float trail = fract(-uv.y * 3.0 - uTime * 0.7 - hash(vec2(ci, 9.0)) * 6.0);
  col = mix(uB + uBa * dot * trail * 0.9, uA, alive);
  outColor = vec4(col, mix(alive, 0.0, smoothstep(0.75, 1.0, uP)) * 0.96 + (1.0 - alive) * dot * trail * 0.6);
}`;

/** truth → craft · voxelisation */
const VOXEL = `${SEAM_HEAD}
void main(){
  float cell = mix(1.0, 26.0, smoothstep(0.0, 0.6, uP));
  vec2 grid = floor(vUv * uRes / cell);
  float r = hash(grid);
  /* Cells first quantise the leaving world, then stack into the arriving one:
     the second half of the transition drops each block into place. */
  float drop = clamp((uP - 0.5) / 0.45, 0.0, 1.0);
  float settled = step(r, drop);
  vec3 col = mix(uA, uB, settled);
  col += uBa * settled * 0.12 * (0.5 + r);
  float shade = 0.86 + r * 0.28;
  outColor = vec4(col * shade, (1.0 - smoothstep(0.86, 1.0, uP)) * 0.95);
}`;

/** craft → cases · the card is swiped away */
const SWIPE = `${SEAM_HEAD}
void main(){
  vec2 uv = vUv;
  float k = smoothstep(0.0, 1.0, uP);
  float front = step(uv.x, 1.0 - k * 1.1);
  /* Two layers at different speeds — the parallax is the whole gesture. */
  float back = step(uv.x, 1.0 - k * 0.72);
  float blur = uSpeed * 0.06;
  float smear = smoothstep(0.0, blur + 0.001, abs(fract(uv.x * 3.0) - 0.5));
  vec3 col = mix(uB, uA, front);
  col = mix(col, uAa * 0.35 + col * 0.8, (front - back) * 0.6);
  col += smear * 0.02;
  outColor = vec4(col, max(front, back * 0.5) * 0.96);
}`;

/** cases → pricing · the last card breaks into blocks and they fall */
const FALL = `${SEAM_HEAD}
void main(){
  vec2 uv = vUv;
  vec2 cells = vec2(10.0, 14.0);
  vec2 gi = floor(uv * cells);
  float r = hash(gi);
  float delay = r * 0.4;
  float k = clamp((uP - delay) / 0.6, 0.0, 1.0);
  /* Gravity, per block, with a landing row that fills from the bottom up. */
  float fall = k * k * 1.6;
  float y = uv.y + fall;
  float gone = step(1.0, y);
  float stack = step(1.0 - uP * 1.05, uv.y);
  vec3 col = mix(uA, uB, gone);
  col = mix(col, uBa * 0.5 + uB * 0.5, stack * gone);
  float grid = step(0.94, fract(uv.x * cells.x)) + step(0.94, fract(uv.y * cells.y));
  col -= grid * 0.03;
  outColor = vec4(col, (1.0 - gone * (1.0 - stack)) * (1.0 - smoothstep(0.88, 1.0, uP)));
}`;

/** pricing → route · the blocks stretch into lanes */
const DASH = `${SEAM_HEAD}
void main(){
  vec2 uv = vUv;
  float k = smoothstep(0.0, 1.0, uP);
  /* Directional blur along X, strength rising with both progress and the
     speed of the scroll itself. */
  float amt = k * (0.06 + uSpeed * 0.1);
  float rows = 16.0;
  float ri = floor(uv.y * rows);
  float band = fract(uv.y * rows);
  float streak = smoothstep(0.0, amt + 0.001, abs(fract(uv.x * 6.0 + hash(vec2(ri, 1.0)) * 6.0 + uTime * uSpeed) - 0.5));
  vec3 col = mix(uA, uB, k);
  col += uBa * streak * k * 0.5;
  col *= 0.9 + 0.2 * step(0.5, band);
  outColor = vec4(col, (1.0 - smoothstep(0.85, 1.0, uP)) * 0.95);
}`;

/** route → gains · the lanes bend down and fog settles over them */
const FOG = `${SEAM_HEAD}
void main(){
  vec2 uv = vUv;
  float k = smoothstep(0.0, 1.0, uP);
  /* The horizon sags: a sine distortion that grows as the speed comes off. */
  uv.y += sin(uv.x * 3.14159) * k * 0.12;
  float f1 = fbm2(uv * 2.4 + vec2(uTime * 0.03, -uTime * 0.02));
  float f2 = fbm2(uv * 5.0 - vec2(uTime * 0.05, 0.0));
  float fog = clamp(f1 * 0.7 + f2 * 0.5, 0.0, 1.0) * k;
  vec3 col = mix(uA, uB, k);
  col = mix(col, uBa, fog * 0.8);
  outColor = vec4(col, clamp(k * 1.2 + fog * 0.4, 0.0, 1.0) * (1.0 - smoothstep(0.9, 1.0, uP)));
}`;

/** gains → portal · a ring of sparks opens outward */
const RING = `${SEAM_HEAD}
void main(){
  vec2 c = vUv - 0.5;
  c.x *= uRes.x / uRes.y;
  float d = length(c);
  float r = uP * 1.4;
  float ring = smoothstep(0.035, 0.0, abs(d - r));
  float inside = step(d, r);
  /* Sparks live on the ring itself, not in a system: an angular hash times a
     thin radial band. */
  float a = atan(c.y, c.x);
  float spark = step(0.72, hash(vec2(floor(a * 26.0), floor(uTime * 12.0)))) * ring;
  vec3 col = mix(uA, uB, inside);
  col += (uBa * 1.2 + vec3(1.0, 0.7, 0.35)) * (ring * 0.5 + spark * 0.9);
  outColor = vec4(col, max(1.0 - inside, ring + spark) * (1.0 - smoothstep(0.92, 1.0, uP)));
}`;

/** portal → brief · a breath out into the light */
const BLOOM = `${SEAM_HEAD}
void main(){
  /* Exposure climbs to white at the halfway point and comes back down the
     other side. The cut happens at the peak, where there is nothing to see. */
  float up = smoothstep(0.0, 0.5, uP);
  float down = smoothstep(0.5, 1.0, uP);
  float e = up - down;
  vec3 col = mix(uA, uB, step(0.5, uP));
  col = mix(col, vec3(1.0), e);
  float glow = fbm2(vUv * 3.0 + uTime * 0.05) * e * 0.2;
  outColor = vec4(col + glow, e * 0.98 + 0.02);
}`;

/** brief → basement · the world turns over */
const FLIP = `${SEAM_HEAD}
void main(){
  vec2 uv = vUv;
  float k = smoothstep(0.0, 1.0, uP);
  /* A rotation about X read as a squash through the middle, with perspective
     so the far edge narrows. Not a cut: the whole 1.4 s is the turn. */
  float ang = k * 3.14159;
  float squash = abs(cos(ang));
  float centred = (uv.y - 0.5) / max(squash, 0.06) + 0.5;
  float visible = step(0.0, centred) * step(centred, 1.0);
  float persp = 1.0 - abs(centred - 0.5) * (1.0 - squash) * 0.5;
  vec3 base = mix(uA, uB, step(0.5, k));
  /* The LUT inversion, applied through the turn rather than at the end. */
  vec3 inverted = vec3(1.0) - base;
  vec3 col = mix(base, inverted, smoothstep(0.35, 0.65, k)) * persp;
  float grain = (hash(uv * uRes + uTime) - 0.5) * 0.06 * k;
  col += grain;
  col.r *= 1.0 + (1.0 - squash) * 0.08;
  col.b *= 1.0 - (1.0 - squash) * 0.05;
  outColor = vec4(col, visible * 0.98);
}`;

/** basement → credits · the spores become stars */
const STARS = `${SEAM_HEAD}
void main(){
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  float k = smoothstep(0.0, 1.0, uP);
  /* The camera pulls back: everything moves outward from the centre and gets
     smaller and colder as it goes. */
  vec2 p = c / max(1.0 - k * 0.75, 0.08) + 0.5;
  float field = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 q = p * (14.0 + fi * 16.0);
    vec2 gi = floor(q);
    vec2 f = fract(q) - 0.5;
    float r = hash(gi + fi * 11.0);
    if (r < 0.78) continue;
    field += smoothstep(0.14, 0.0, length(f)) * (0.4 + fi * 0.3);
  }
  vec3 spore = uAa;
  vec3 star = vec3(1.0);
  vec3 col = mix(uA, uB, k) + mix(spore, star, k) * field * (0.5 + k * 0.8);
  outColor = vec4(col, (1.0 - smoothstep(0.9, 1.0, uP)) * (0.35 + k * 0.6));
}`;

export const SEAMS: Record<string, string> = {
  'hero>pain': PIPE,
  'pain>truth': COLUMNS,
  'truth>craft': VOXEL,
  'craft>cases': SWIPE,
  'cases>pricing': FALL,
  'pricing>route': DASH,
  'route>gains': FOG,
  'gains>portal': RING,
  'portal>brief': BLOOM,
  'brief>basement': FLIP,
  'basement>credits': STARS,
};
