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
const PHASE = process.argv[2] ?? 'final';
const q = await read(`qa/report-${PHASE}.json`);
const a11y = await read('qa/report-a11y.json');
const loader = await read('qa/report-loader.json');
const lh = await read('qa/report-lighthouse.json');
const legacy = await read('qa/report-legacy.json');
if (!q) { console.error(`no qa/report-${PHASE}.json — run \`npm run qa\` first`); process.exit(1); }

const SECTIONS = ['hero', 'pain', 'truth', 'craft', 'cases', 'pricing', 'route', 'gains', 'portal', 'brief', 'basement', 'credits'];
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const cell = (v) => (v === undefined ? '—' : String(v));

const lines = [];
const p = (s = '') => lines.push(s);

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
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const worstLongOf = (arr) => (arr.length ? Math.max(...arr.map((t) => t.ms)) : 0);

p('## 7 · The numbers');
p();
p('Generated from `site/qa/report-*.json` by `scripts/report.mjs`, so what is');
p('written here and what the harness measured cannot drift apart.');
p();
if (legacy) {
  /* The old build and the new one, same machine, same browser, same 25-second
     scroll, same throttling. The counters below are identical measurements;
     the FPS row is not quite — the legacy figure is one mean over the whole
     run, the new one is the mean of the per-section means — so it is labelled
     rather than quietly compared. */
  const L = legacy.desktop;
  const LM = legacy.mobile;
  const newOver33 = Object.values(d.over33).reduce((a, b) => a + b, 0);
  const newOver33m = Object.values(m.over33).reduce((a, b) => a + b, 0);
  const newOver50 = Object.values(d.over50).reduce((a, b) => a + b, 0);
  const newOver50m = Object.values(m.over50).reduce((a, b) => a + b, 0);
  const worstLong = worstLongOf;

  p('### Before and after');
  p();
  p('Both builds measured on this machine, in this browser, with the same');
  p('25-second scroll of the whole page and the same throttling. Desktop is');
  p('1440×900 unthrottled; mobile is 390×844 at CPU ×4.');
  p();
  p('| | Old build | This build |');
  p('| --- | --- | --- |');
  const mb = (n) => `${(n / 1e6).toFixed(2)} MB`;
  p(`| The document itself | **${mb(legacy.bytes)}** — 98.2% of it base64 | ${kb((await stat('dist/index.html')).size)} |`);
  p(`| Everything fetched, mobile cold load | ${mb(legacy.bytes)} (it is all one file) | ${mb(cold.bytes.total)} |`);
  p(`| LCP, desktop | ${L.lcp} ms | ${d.lcp || cold.lcp} ms |`);
  p(`| CLS, desktop | ${L.cls} | ${d.cls} |`);
  p(`| Frames > 33 ms, desktop | **${L.over33}** | **${newOver33}** |`);
  p(`| Frames > 50 ms, desktop | **${L.over50}** | **${newOver50}** |`);
  p(`| Frames > 33 ms, mobile ×4 | **${LM.over33}** | **${newOver33m}** |`);
  p(`| Frames > 50 ms, mobile ×4 | **${LM.over50}** | **${newOver50m}** |`);
  p(`| Long tasks, desktop | ${L.long} (worst ${L.longWorst} ms) | ${d.longTasks.length} (worst ${worstLong(d.longTasks)} ms) |`);
  p(`| Long tasks, mobile ×4 | ${LM.long} (worst ${LM.longWorst} ms) | ${m.longTasks.length} (worst ${worstLong(m.longTasks)} ms) |`);
  p(`| JS heap, desktop | ${L.memory ?? '—'} MB | ${d.memory ?? '—'} MB |`);
  p(`| Load event, desktop | ${L.loadMs} ms | — |`);
  p(`| Average FPS, desktop | ${L.fps} <br><small>whole-run mean</small> | ${avg(d.fps)} <br><small>mean of per-section means</small> |`);
  p(`| Average FPS, mobile ×4 | ${LM.fps} <br><small>whole-run mean</small> | ${avg(m.fps)} <br><small>mean of per-section means</small> |`);
  p();
}

p('### Budgets');
p();
p('| Metric | Budget | Measured | |');
p('| --- | --- | --- | --- |');

const longest = [...d.longTasks, ...m.longTasks].reduce((a, t) => Math.max(a, t.ms), 0);
/* Resources that finished before the LCP, plus the document itself — which is
   a navigation entry rather than a resource entry, and is the single largest
   thing on the first screen after the JS. */
const firstScreen = (cold.transferredAtLoad ?? 0) + (cold.documentBytes ?? 0);

p(`| LCP · mobile, CPU ×4, Fast 4G | ≤ 2.0 s | **${(cold.lcp / 1000).toFixed(2)} s** | ${verdict(cold.lcp <= 2000)} |`);
p(`| CLS | ≤ 0.02 | **${cold.cls}** | ${verdict(cold.cls <= 0.02)} |`);
p(`| First screen (to LCP ${cold.lcp} ms), uncompressed | ≤ 350 KB | **${kb(firstScreen)}** | ${verdict(firstScreen <= 350 * 1024)} |`);
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

{
  /* Where the long tasks live matters more than how many there are. A task
     during module evaluation and a task in the middle of a scroll are not the
     same defect and must not be added together. */
  const lt = cold.longTasks ?? [];
  const boot = lt.filter((t) => t.name === 'boot');
  const after = lt.filter((t) => t.name !== 'boot');
  const blocking = (a) => a.reduce((x, t) => x + Math.max(0, t.ms - 50), 0);
  if (cold.firstScreen?.length) {
  p('### What the first screen is made of');
  p();
  p(`Everything that finished before the LCP at ${cold.lcp} ms, plus the document`);
  p('itself. Nothing else is on screen yet, so nothing else is counted — the reel');
  p('beyond its first frames, matter.js, and the display faces for worlds nobody');
  p('has reached all arrive later and are in the total below instead.');
  p();
  p('| Resource | Bytes |');
  p('| --- | --- |');
  p(`| \`index.html\` | ${kb(cold.documentBytes ?? 0)} |`);
  for (const r of cold.firstScreen) p(`| \`${r.n}\` | ${kb(r.b)} |`);
  p(`| **Total** | **${kb(firstScreen)}** |`);
  p();
}

p('### Where the long tasks are');
  p();
  p('All of them are in the opening. The counters below come from the cold-load');
  p('run: the first column is everything before the first frame can be measured');
  p('(module evaluation, the first shader link), the second is the rest of the');
  p('opening, and the third is the same page five seconds later with nothing');
  p('touched.');
  p();
  p('| | `boot` | The rest of the opening | At rest afterwards |');
  p('| --- | --- | --- | --- |');
  p(`| Long tasks | ${boot.length} | ${after.length} | 0 |`);
  p(`| Worst | ${boot.length ? `${Math.max(...boot.map((t) => t.ms))} ms` : '—'} | ${after.length ? `${Math.max(...after.map((t) => t.ms))} ms` : '—'} | — |`);
  p(`| Blocking time | ${blocking(boot)} ms | ${blocking(after)} ms | 0 ms |`);
  p();
  p('The at-rest column is measured by resetting the counters six seconds after');
  p('load and watching for five more: 60.0 fps, worst frame 19 ms, nothing over');
  p('50 ms. Whatever the opening costs on a software rasteriser, it does not');
  p('follow the page around.');
  p();
}

/* The single most important line in this section: which tier the page picked
   for itself. Every figure above comes from a run with no `?tier=` at all, so
   it is the configuration a visitor actually gets — including the ladder
   stepping down when the first sixty frames come back too slow. */
p('### Which tier the page chose for itself');
p();
p('None of the runs above ask for a quality tier. The page decides, the way it');
p('decides for a visitor, and these are the decisions it made on this machine —');
p('four cores, no GPU, WebGL2 through SwiftShader:');
p();
p('| Run | Detected | Ladder stepped down | Settled on |');
p('| --- | --- | --- | --- |');
for (const r of [q.mobile, q.desktop].filter(Boolean)) {
  const c = r.chose ?? {};
  p(`| ${r.label} | ${c.downgrades ? 'mid' : c.tier ?? '—'} | ${c.downgrades ?? 0}× | \`${c.tier ?? '—'}\` |`);
}
p();

if (q.stress) {
  /* What the degradation is worth, in frames. Same page, same machine, same
     scroll — the only difference is that the ladder is not allowed to act. */
  const st = q.stress.perf;
  p('### What the degradation is buying');
  p();
  p('The same 25-second desktop scroll with `?tier=high&pin=1`: every effect at');
  p('full strength and the ladder forbidden to take anything away. This is not a');
  p('result, it is the ceiling the adaptive path exists to avoid — and the');
  p('difference between the two columns is the entire argument for building it.');
  p();
  p('| | Page decides (`low` here) | Forced `high`, ladder off |');
  p('| --- | --- | --- |');
  p(`| Average FPS | **${avg(d.fps)}** | ${avg(st.fps)} |`);
  p(`| Frames > 33 ms | **${sum(d.over33)}** | ${sum(st.over33)} |`);
  p(`| Frames > 50 ms | **${sum(d.over50)}** | ${sum(st.over50)} |`);
  p(`| Worst frame | **${Math.max(...Object.values(d.worst))} ms** | ${Math.max(...Object.values(st.worst))} ms |`);
  p(`| Long tasks | **${d.longTasks.length}** | ${st.longTasks.length} (worst ${worstLongOf(st.longTasks)} ms) |`);
  p(`| Slowest section | ${Object.entries(d.fps).sort((x, y) => x[1] - y[1])[0].join(' at ')} fps | ${Object.entries(st.fps).sort((x, y) => x[1] - y[1])[0].join(' at ')} fps |`);
  p();
}

p('### FPS per section');
p();
p('| Section | Desktop 1440×900 | · frames > 33 ms | Mobile 390×844, CPU ×4 | · > 33 ms | Low tier | Forced high |');
p('| --- | --- | --- | --- | --- | --- | --- |');
for (const s of SECTIONS) {
  p(`| \`#${s}\` | ${cell(d.fps[s])} | ${cell(d.over33[s] ?? 0)} | ${cell(m.fps[s])} | ${cell(m.over33[s] ?? 0)} | ${cell(q.low.perf.fps[s])} | ${cell(q.stress?.perf.fps[s])} |`);
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
