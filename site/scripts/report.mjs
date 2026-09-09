/**
 * Turns the QA artefacts into the measurements section of ../REPORT.md.
 *
 * The report quotes numbers, so the numbers are generated from the JSON the
 * harness wrote rather than typed by hand. Run after `npm run qa:all`.
 */
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const read = async (f) => { try { return JSON.parse(await readFile(f, 'utf8')); } catch { return null; } };
const q = await read('qa/report-final.json');
const a11y = await read('qa/report-a11y.json');
const loader = await read('qa/report-loader.json');
const lh = await read('qa/report-lighthouse.json');
if (!q) { console.error('no qa/report-final.json — run `npm run qa` first'); process.exit(1); }

const SECTIONS = ['hero', 'pain', 'truth', 'craft', 'cases', 'pricing', 'route', 'gains', 'portal', 'brief', 'basement', 'credits'];
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const cell = (v) => (v === undefined ? '—' : String(v));

const lines = [];
const p = (s = '') => lines.push(s);

p('## 7 · The numbers');
p();
p('Generated from `site/qa/report-*.json` by `scripts/report.mjs`, so what is');
p('written here and what the harness measured cannot drift apart.');
p();
p('### Budgets');
p();
p('| Metric | Budget | Measured | |');
p('| --- | --- | --- | --- |');

const verdict = (ok) => (ok ? '✅' : '⚠️');
const cold = q.cold;
const d = q.desktop.perf;
const m = q.mobile.perf;
const worstDesk = Object.entries(d.over33).reduce((a, [k, v]) => a + v, 0);
const worstMob50 = Object.entries(m.over50).reduce((a, [k, v]) => a + v, 0);
const avg = (o) => {
  const vals = Object.values(o);
  return vals.length ? (vals.reduce((x, y) => x + y, 0) / vals.length).toFixed(1) : '—';
};
const longest = [...d.longTasks, ...m.longTasks].reduce((a, t) => Math.max(a, t.ms), 0);
const firstScreen = cold.transferredAtLoad ?? 0;

p(`| LCP · mobile, CPU ×4, Fast 4G | ≤ 2.0 s | **${(cold.lcp / 1000).toFixed(2)} s** | ${verdict(cold.lcp <= 2000)} |`);
p(`| CLS | ≤ 0.02 | **${cold.cls}** | ${verdict(cold.cls <= 0.02)} |`);
p(`| First screen (to LCP), uncompressed | ≤ 350 KB | **${kb(firstScreen)}** | ${verdict(firstScreen <= 350 * 1024)} |`);
p(`| Total after every lazy load · mobile | ≤ 3.5 MB | **${(cold.bytes.total / 1048576).toFixed(2)} MB** | ${verdict(cold.bytes.total <= 3.5 * 1048576)} |`);
p(`| Desktop scroll, average FPS | ≥ 58 | **${avg(d.fps)}** | ${verdict(Number(avg(d.fps)) >= 58)} |`);
p(`| Desktop, frames > 33 ms | 0 | **${worstDesk}** | ${verdict(worstDesk === 0)} |`);
p(`| Mobile scroll, average FPS | ≥ 55 | **${avg(m.fps)}** | ${verdict(Number(avg(m.fps)) >= 55)} |`);
p(`| Mobile, frames > 50 ms (whole page) | ≤ 3 | **${worstMob50}** | ${verdict(worstMob50 <= 3)} |`);
p(`| Long tasks after load | none > 120 ms | **${longest ? `${longest} ms longest` : 'none at all'}** | ${verdict(longest <= 120)} |`);
p(`| Live worlds at once | ≤ 3 | **${Math.max(...q.desktop.liveCounts.map((x) => x.length))}** | ${verdict(Math.max(...q.desktop.liveCounts.map((x) => x.length)) <= 3)} |`);
p(`| JS heap, peak | — | **${d.memory ?? '—'} MB** | |`);
p(`| Console errors across all runs | 0 | **${q.mobile.errors.length + q.desktop.errors.length + q.low.errors.length}** | ${verdict((q.mobile.errors.length + q.desktop.errors.length + q.low.errors.length) === 0)} |`);
p();

p('### FPS per section');
p();
p('| Section | Desktop 1440×900 | · frames > 33 ms | Mobile 390×844, CPU ×4 | · > 33 ms | Low tier |');
p('| --- | --- | --- | --- | --- | --- |');
for (const s of SECTIONS) {
  p(`| \`#${s}\` | ${cell(d.fps[s])} | ${cell(d.over33[s] ?? 0)} | ${cell(m.fps[s])} | ${cell(m.over33[s] ?? 0)} | ${cell(q.low.perf.fps[s])} |`);
}
p();

/* The preview server sends everything uncompressed, so the transfer figures
   above are the raw bytes. Any real host gzips or brotlis text, and the first
   screen is mostly text — so the same page over a normal connection is a good
   deal lighter than the row above says. Both numbers are here rather than the
   flattering one. */
{
  const files = [];
  const walk = async (dir) => {
    for (const name of await readdir(dir)) {
      const full = join(dir, name);
      const st = await stat(full);
      if (st.isDirectory()) await walk(full); else files.push(full);
    }
  };
  await walk('dist');
  const isText = (f) => /\.(js|css|html|json|svg|txt|xml)$/.test(f);
  let rawText = 0;
  let gzText = 0;
  for (const f of files.filter(isText)) {
    const buf = await readFile(f);
    rawText += buf.length;
    gzText += gzipSync(buf).length;
  }
  p('### Compression');
  p();
  p(`Everything above was measured against \`vite preview\`, which serves raw`);
  p(`bytes. The site is mostly text on the first screen, and every real host`);
  p(`compresses it, so the same build over a normal connection is smaller:`);
  p();
  p(`| | Raw | gzip |`);
  p('| --- | --- | --- |');
  p(`| All JS + CSS + HTML in \`dist/\` | ${kb(rawText)} | **${kb(gzText)}** (−${Math.round((1 - gzText / rawText) * 100)}%) |`);
  p();
  p('Images and fonts are already compressed formats and are not affected.');
  p();
}

p('### Weight, by type (mobile cold load)');
p();
p('| Type | Bytes |');
p('| --- | --- |');
for (const [type, n] of Object.entries(cold.bytes.byType).sort((x, y) => y[1] - x[1])) {
  p(`| ${type} | ${kb(n)} |`);
}
p();

if (loader) {
  p('### The opening');
  p();
  const l = loader.loaderCpu6;
  p(`* **Preloader at CPU ×6:** ${l.frames} frames sampled, median ${l.median} ms, p95 ${l.p95} ms, worst ${l.worst} ms.`);
  p(`  Frames over 33 ms: **${l.dropped}**. Over 50 ms: **${l.stalls50}**. Video: \`site/qa/video/\`.`);
  const f = loader.flip;
  if (f?.error) {
    p(`* **FLIP into the header:** not measured — ${f.error}.`);
  } else if (f) {
    p(`* **FLIP into the header:** after the flight the mark's box is ${f.markW}px wide against the header logo's ${f.logoW}px —`);
    p(`  Δwidth ${f.dw}px, Δheight ${f.dh}px, Δx ${f.dx}px, Δy ${f.dy}px. Aspect ${f.markAspect} vs ${f.logoAspect}.`);
  }
  p(`* **Second visit in the same tab:** live in ${loader.secondVisit.msToLive} ms (the short version, no pour).`);
  const rm = loader.reducedMotion;
  p(`* **prefers-reduced-motion:** flag ${rm.rmFlag === '1' ? 'set' : 'NOT set'}, tier \`${rm.tier}\`, ${rm.risesRevealed}/${rm.risesTotal} reveals shown immediately, seam layer ${rm.seamOn ? 'active' : 'idle'}, ${rm.errors.length} errors.`);
  const iso = loader.isolation;
  p(`* **One world failing:** with \`#truth\`'s WebGL context forced to throw, ${iso.fallbackSections.length ? `\`${iso.fallbackSections.join('`, `')}\` fell back` : 'the world degraded'}, its copy is still ${iso.truthTextVisible} characters of readable DOM, ${iso.laterSectionsRendered}/4 later sections still rendered, page still live: ${iso.stillLive}, uncaught errors: ${iso.pageErrors.length}.`);
  p();
}

if (a11y) {
  p('### Accessibility');
  p();
  p(`* **Contrast:** ${a11y.contrast.checked} text nodes measured against their resolved background; **${a11y.contrast.failures.length}** below 4.5:1 (3:1 for large text).`);
  if (a11y.contrast.failures.length) {
    p();
    p('  | Section | Element | Ratio | Needed |');
    p('  | --- | --- | --- | --- |');
    for (const f of a11y.contrast.failures.slice(0, 12)) {
      p(`  | \`#${f.section}\` | \`${f.sel}\` "${f.text.slice(0, 28)}" | ${f.ratio}:1 | ${f.need}:1 |`);
    }
  }
  p();
  p(`* **Keyboard:** ${a11y.keyboard.stops} tab stops reached across ${a11y.keyboard.sectionsReached.length} sections; ${a11y.keyboard.stopsWithoutVisibleRing} without a visible focus ring.`);
  p(`* **Media:** ${a11y.media.canvasesWithoutAriaHidden.length} canvases missing \`aria-hidden\`, ${a11y.media.imagesWithoutAlt.length} images without \`alt\`, ${a11y.media.imagesWithoutBox.length} without declared width/height.`);
  const n = a11y.noWebGL;
  p(`* **Without WebGL:** page goes live: ${n.live}; loader clears: ${n.loaderGone}; ${n.headingsVisible} headings rendered; ${n.bodyText} characters of readable text; ${n.errors.length} errors. Screenshot: \`site/qa/shots/no-webgl.png\`.`);
  p();
}

if (lh) {
  p('### Lighthouse');
  p();
  p('| Category | Mobile | Desktop |');
  p('| --- | --- | --- |');
  for (const k of ['performance', 'accessibility', 'best-practices', 'seo']) {
    p(`| ${k} | ${lh.mobile.scores[k] ?? '—'} | ${lh.desktop.scores[k] ?? '—'} |`);
  }
  p();
  p(`Mobile metrics: LCP ${lh.mobile.metrics.lcp}, CLS ${lh.mobile.metrics.cls}, TBT ${lh.mobile.metrics.tbt}, FCP ${lh.mobile.metrics.fcp}, Speed Index ${lh.mobile.metrics.si}.`);
  p();
  p('Full HTML reports: `site/qa/lighthouse-mobile.html`, `site/qa/lighthouse-desktop.html`.');
  p();
}

p('### Horizontal overflow');
p();
p('| Width | Document scrolls sideways | Offenders |');
p('| --- | --- | --- |');
for (const s of q.shots) {
  p(`| ${s.width} | ${s.docWidth > s.winWidth ? `**yes — ${s.docWidth}px**` : 'no'} | ${s.offenders.length ? s.offenders.join(', ') : '—'} |`);
}
p();
p('Screenshots: `site/qa/shots/final/` — 12 sections × 6 widths, plus one frame');
p('of each of the eleven seams mid-transition.');

await writeFile('qa/report-section.md', lines.join('\n'));
console.log(lines.join('\n'));
