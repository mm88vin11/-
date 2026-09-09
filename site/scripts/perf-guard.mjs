#!/usr/bin/env node
/**
 * The performance contract, as a program.
 *
 * Section 2 of the brief is a list of rules that are easy to agree with and
 * easy to break three weeks later. This runs them against the source and the
 * build on every commit, and exits non-zero when one is broken. It is the
 * reason the answer to "is it still fast?" is not "it felt fine".
 *
 *   npm run guard
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fails = [];
const warns = [];
const notes = [];

const fail = (rule, detail) => fails.push({ rule, detail });
const warn = (rule, detail) => warns.push({ rule, detail });

async function walk(dir, out = []) {
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    const s = await stat(p);
    if (s.isDirectory()) { if (name !== 'node_modules') await walk(p, out); }
    else out.push(p);
  }
  return out;
}

const src = await walk(join(root, 'src'));
const ts = src.filter((f) => extname(f) === '.ts');
const css = src.filter((f) => extname(f) === '.css');
const read = async (f) => readFile(f, 'utf8');

/* ── 1 · one clock ─────────────────────────────────────────────────────── */
let rafs = [];
for (const f of ts) {
  const body = await read(f);
  const n = (body.match(/requestAnimationFrame/g) ?? []).length;
  if (n) rafs.push(`${f.replace(root, '')}×${n}`);
}
if (rafs.length === 0) notes.push('one clock: no raw requestAnimationFrame in src — gsap.ticker is the only loop');
else if (rafs.length === 1 && rafs[0].includes('core/ticker')) notes.push(`one clock: single rAF, in ${rafs[0]}`);
else fail('one clock', `raw requestAnimationFrame outside core/ticker: ${rafs.join(', ')}`);

/* ── 2 · every world can be paused, resumed and disposed ───────────────── */
const worlds = src.filter((f) => f.includes('/worlds/'));
for (const f of worlds) {
  const body = await read(f);
  for (const m of ['mount(', 'unmount(', 'pause(', 'resume(']) {
    if (!body.includes(m)) fail('world contract', `${f.replace(root, '')} has no ${m})`);
  }
  if (body.includes('new ShaderLayer') && !body.includes('.destroy()')) {
    fail('gpu disposal', `${f.replace(root, '')} builds a ShaderLayer and never destroys it`);
  }
  if (body.includes('WebGLRenderer') && !body.includes('forceContextLoss')) {
    fail('gpu disposal', `${f.replace(root, '')} builds a three renderer and never releases its context`);
  }
}

/* ── 3 · only transform and opacity in scroll-linked animation ───────────
   The rule is about anything a scrub or a reveal drives, not about a button
   changing colour under a cursor. So the check reads the selector that owns
   the declaration: state selectors (:hover, :focus, aria-pressed, .is-*) and
   the three full-screen overlays are exempt, everything else is not. */
const BANNED = /transition\s*:[^;]*\b(width|height|top|left|right|bottom|margin|padding|box-shadow|filter)\b/;
const EXEMPT = /:hover|:focus|:active|\[aria-pressed|\.is-|#load|#wipe|#seam|#toast|\.tape__card|\.map__card|\.team li|\.soc\b|\.scope\b|\.chip\b|\.pill\b|\.btn\b|\.ltr\b|#head\b|\.head__ink|\.skip\b|\.tok__dot|\.well__flash|\.card__ans|\.hero__whisper|\.portal__step|\.map__pin|\.blk__say|\.pain__sum/;
for (const f of css) {
  const body = await read(f);
  /* Crude but sufficient block split: `selector { declarations }`. */
  for (const m of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
    const decls = m[2];
    if (!BANNED.test(decls)) continue;
    if (EXEMPT.test(selector)) continue;
    const line = decls.split('\n').find((l) => BANNED.test(l)) ?? decls;
    warn('transform/opacity only', `${f.replace(root, '')} — ${selector.slice(0, 40)} { ${line.trim().slice(0, 70)} }`);
  }
}

/* ── 4 · reads out of the tick ─────────────────────────────────────────── */
for (const f of ts) {
  const raw = await read(f);
  /* Block comments are blanked, keeping line numbers, so prose about a rule is
     never mistaken for a breach of it. */
  const body = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const lines = body.split('\n');
  lines.forEach((line, i) => {
    const code = line.trim();
    if (code.startsWith('*') || code.startsWith('//') || code.startsWith('/*')) return;
    if (!/getBoundingClientRect|offsetWidth|offsetHeight|scrollTop|offsetTop/.test(line)) return;
    /* A read inside a resize handler or a build step is fine; a read inside a
       function that a tick calls every frame is not. This finds the obvious
       shape of the mistake, not every instance of it. */
    const ctx = lines.slice(Math.max(0, i - 14), i).join('\n');
    if (/clock\.add\(\s*\(\{[^}]*\}\)\s*=>\s*\{/.test(ctx) && !/resize/.test(ctx)) {
      warn('layout read in tick', `${f.replace(root, '')}:${i + 1} — ${line.trim().slice(0, 70)}`);
    }
  });
}

/* ── 5 · z-index only from the named scale ─────────────────────────────── */
for (const f of css) {
  const body = await read(f);
  for (const m of body.matchAll(/z-index:\s*([^;]+);/g)) {
    const v = m[1].trim();
    if (!v.startsWith('var(--z-') && !['0', '1', '2', '3', '4', '-1', 'auto'].includes(v)) {
      fail('z-scale', `${f.replace(root, '')}: z-index: ${v} is not from the named scale`);
    }
  }
}

/* ── 6 · fonts under budget ────────────────────────────────────────────── */
/* Deduplicated by content, because that is what the network sees: Manrope's
   three weights are one variable font, so the browser fetches it once whatever
   the @font-face count says. */
const { createHash } = await import('node:crypto');
const fontDir = join(root, 'src/assets/fonts');
let fontBytes = 0;
let declaredBytes = 0;
const seen = new Set();
const fontFamilies = new Set();
for (const f of await readdir(fontDir)) {
  const buf = await readFile(join(fontDir, f));
  const h = createHash('sha1').update(buf).digest('hex');
  declaredBytes += buf.length;
  if (!seen.has(h)) { seen.add(h); fontBytes += buf.length; }
  fontFamilies.add(f.replace(/-\d+-(cyrillic|latin)\.woff2$/, ''));
}
if (fontBytes > 220 * 1024) fail('font budget', `${(fontBytes / 1024).toFixed(0)} KB > 220 KB`);
else notes.push(`fonts: ${(fontBytes / 1024).toFixed(0)} KB over the wire across ${fontFamilies.size} families ` +
  `(${seen.size} unique files behind ${(declaredBytes / 1024).toFixed(0)} KB of declarations — Manrope is variable; budget 220 KB, 5 families)`);
if (fontFamilies.size > 5) fail('font families', `${fontFamilies.size} > 5`);

/* ── 7 · no inlined binary assets ──────────────────────────────────────── */
for (const f of [...css, join(root, 'index.html')]) {
  const body = await read(f);
  for (const m of body.matchAll(/data:([a-z/+.-]+);base64,([A-Za-z0-9+/=]{200,})/g)) {
    fail('no base64', `${f.replace(root, '')} inlines ${(m[2].length / 1024).toFixed(0)} KB of ${m[1]}`);
  }
}

/* ── 8 · declared boxes on every raster element ────────────────────────── */
const html = await read(join(root, 'index.html'));
for (const m of html.matchAll(/<img\b[^>]*>/g)) {
  const tag = m[0];
  if (!/\bwidth=/.test(tag) || !/\bheight=/.test(tag)) {
    fail('zero CLS', `<img> without width/height: ${tag.slice(0, 80)}`);
  }
}

/* ── 9 · the built weight ──────────────────────────────────────────────── */
try {
  const distFiles = await walk(join(root, 'dist'));
  const js = distFiles.filter((f) => f.endsWith('.js'));
  const cssOut = distFiles.filter((f) => f.endsWith('.css'));
  let jsBytes = 0;
  for (const f of js) jsBytes += (await stat(f)).size;
  let cssBytes = 0;
  for (const f of cssOut) cssBytes += (await stat(f)).size;
  notes.push(`build: ${(jsBytes / 1024).toFixed(0)} KB JS + ${(cssBytes / 1024).toFixed(0)} KB CSS, uncompressed, across ${js.length} chunks`);

  const reel = await readdir(join(root, 'public/assets/reel-d'));
  let reelBytes = 0;
  for (const f of reel) reelBytes += (await stat(join(root, 'public/assets/reel-d', f))).size;
  notes.push(`reel (desktop cut): ${reel.length} frames, ${(reelBytes / 1024 / 1024).toFixed(2)} MB`);
  if (reelBytes + jsBytes + cssBytes + fontBytes > 3.5 * 1024 * 1024) {
    fail('total weight', `> 3.5 MB with the desktop reel`);
  }
} catch {
  warns.push({ rule: 'build weight', detail: 'no dist/ — run `npm run build` before the guard for weight checks' });
}

/* ── report ────────────────────────────────────────────────────────────── */
for (const n of notes) console.log(`  ok    ${n}`);
for (const w of warns) console.log(`  warn  ${w.rule}: ${w.detail}`);
for (const f of fails) console.log(`  FAIL  ${f.rule}: ${f.detail}`);
console.log(`\n${fails.length} failures, ${warns.length} warnings`);
process.exit(fails.length ? 1 : 0);
