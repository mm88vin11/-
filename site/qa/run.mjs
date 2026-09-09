/**
 * The measurement rig.
 *
 * Everything the report claims comes out of here. It does three passes:
 *
 *  1. cold load, 390×844, CPU ×4, Fast 4G — LCP, CLS, first-screen weight
 *  2. a 25-second even scroll of the whole page with a trace running, at both
 *     390×844 (throttled) and 1440×900 (unthrottled) — per-section FPS, long
 *     tasks with the section that owned them, worst frame, peak heap
 *  3. screenshots of every section at six widths, into qa/shots/<phase>/
 *
 * Per-section frame accounting comes from the page itself (window.__BAZA_PERF)
 * rather than from the trace: only the page knows which world owned a frame.
 *
 * The environment matters and the report says so: this container has no GPU,
 * so Chromium runs SwiftShader. Software rasterisation makes every WebGL cost
 * an order of magnitude worse than on real hardware, which is a harsh test to
 * pass and a dishonest one to quote as a phone number.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.QA_URL ?? 'http://localhost:4173/';
const PHASE = process.argv[2] ?? 'f9';
const SECTIONS = ['hero', 'pain', 'truth', 'craft', 'cases', 'pricing', 'route', 'gains', 'portal', 'brief', 'basement', 'credits'];
const WIDTHS = [390, 430, 768, 1024, 1440, 1920];

const launch = () => chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--expose-gc'],
});

const nap = (ms) => new Promise((r) => setTimeout(r, ms));

async function throttle(page, { cpu = 1, net = null } = {}) {
  const cdp = await page.context().newCDPSession(page);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  if (net) {
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: net.latency,
      downloadThroughput: net.down, uploadThroughput: net.up,
    });
  }
  return cdp;
}

/**
 * One browser per pass, and one per screenshot viewport.
 *
 * Reusing a single browser across every pass looks tidy and is a trap: this
 * page opens several WebGL contexts per world, SwiftShader holds them, and
 * after a few hundred scroll steps and several viewports the compositor starts
 * handing back plain white frames. The first screenshot pass produced exactly
 * that, and it looked for all the world like a rendering bug in the site.
 */

/** Pass 1 — what the first screen actually costs. */
async function coldLoad(browser, { tier }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const bytes = { total: 0, byType: {} };
  let lcpTime = 0;

  page.on('response', async (res) => {
    try {
      const h = res.headers();
      const len = Number(h['content-length'] ?? 0);
      const type = (h['content-type'] ?? 'other').split(';')[0];
      const size = len || (await res.body().catch(() => Buffer.alloc(0))).length;
      bytes.total += size;
      bytes.byType[type] = (bytes.byType[type] ?? 0) + size;
    } catch { /* redirects and aborted requests */ }
  });

  await throttle(page, { cpu: 4, net: { latency: 150, down: (9 * 1024 * 1024) / 8, up: (1.5 * 1024 * 1024) / 8 } });
  const t0 = Date.now();
  await page.goto(`${BASE}${tier ? `?tier=${tier}` : ''}`, { waitUntil: 'load', timeout: 90_000 });
  const loadMs = Date.now() - t0;
  await nap(6000);

  const m = await page.evaluate(() => {
    const p = window.__BAZA_PERF;
    const nav = performance.getEntriesByType('navigation')[0];
    const first = performance.getEntriesByName('first-contentful-paint')[0];
    return {
      lcp: p.lcp, cls: p.cls, tier: p.tier, memory: p.memory,
      fcp: first ? Math.round(first.startTime) : null,
      domInteractive: nav ? Math.round(nav.domInteractive) : null,
      longTasks: p.longTasks,
      /* `p.lcp` comes from the page's own PerformanceObserver, which is the
         only place the number exists: LCP entries are delivered to observers
         and are not retained in the entry buffer, so `getEntriesByName` and
         `getEntriesByType` both come back empty here. Reading them meant this
         silently fell back to a flat 4-second window and called eleven reel
         frames, every font and matter.js part of the first screen. */
      transferredAtLoad: performance.getEntriesByType('resource')
        .filter((r) => r.responseEnd <= p.lcp)
        .reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0),
      firstScreen: performance.getEntriesByType('resource')
        .filter((r) => r.responseEnd <= p.lcp)
        .map((r) => ({ n: r.name.split('/').pop(), b: r.transferSize || r.encodedBodySize || 0 }))
        .sort((a, b) => b.b - a.b),
      /* The document itself is a navigation entry, not a resource entry, and
         leaving it out understates the first screen by the whole of index.html. */
      documentBytes: performance.getEntriesByType('navigation')[0]?.transferSize ?? 0,
    };
  });
  lcpTime = m.lcp;

  /* First-screen weight: everything that finished before the LCP. */
  await ctx.close();
  return { loadMs, lcp: lcpTime, ...m, bytes };
}

/** Pass 2 — a scripted scroll with the page's own frame accounting running. */
async function scrollRun(browser, { width, height, cpu, tier, pin, label }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: width < 500 ? 2 : 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await throttle(page, { cpu });
  /* No `tier` means no query string at all: the page decides for itself, which
     is the only configuration a visitor ever gets and therefore the only one
     the headline figures may come from. A run that forces `high` on a machine
     whose own detection would pick `mid` measures a setting the site would
     never choose — useful as a ceiling, dishonest as a result. */
  const q = tier ? `?tier=${tier}${pin ? '&pin=1' : ''}` : '';
  await page.goto(`${BASE}${q}`, { waitUntil: 'load', timeout: 90_000 });
  await nap(5000);
  await page.evaluate(() => { window.__BAZA_PERF; });
  /* Reset the counters so the loader's own frames are not in the scroll stats. */
  await page.evaluate(() => {
    const mod = window;
    if (mod.__BAZA_RESET) mod.__BAZA_RESET();
  });

  const total = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);
  const STEPS = 250;      /* 25 s at 100 ms a step */
  const liveCounts = [];
  for (let i = 0; i <= STEPS; i++) {
    const y = Math.round((total * i) / STEPS);
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await nap(100);
    if (i % 25 === 0) {
      liveCounts.push(await page.evaluate(() => window.__BAZA_PERF.liveWorlds));
    }
  }

  const perf = await page.evaluate(() => window.__BAZA_PERF);
  /* Which tier the page picked, and whether the ladder took anything away
     during the run. On an auto run these two numbers are the evidence that
     adaptive degradation is a working mechanism and not a paragraph. */
  const chose = await page.evaluate(() => window.__BAZA_TIER ?? null);
  await ctx.close();
  return { label, width, height, cpu, requested: tier ?? 'auto', pin: !!pin, chose, perf, errors, liveCounts };
}

/** Pass 3 — every section at every width. */
async function shots(tier) {
  const dir = `qa/shots/${PHASE}`;
  await mkdir(dir, { recursive: true });
  const found = [];
  for (const width of WIDTHS) {
    const browser = await launch();
    /* Capped height: a 1920-wide shot at 1.9× is a 3600px surface, which is
       both unrepresentative and the thing SwiftShader falls over on. */
    const height = Math.min(Math.round(width * 1.9), 1200);
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    /* Pinned for the sweep: these are pictures of the design, and this machine
       downgrades within seconds of loading. */
    await page.goto(`${BASE}?tier=${tier}&pin=1`, { waitUntil: 'load', timeout: 90_000 });
    await nap(5000);
    for (const id of SECTIONS) {
      /* The middle of the section, not its top edge: a seam lives on every
         boundary and a screenshot taken there photographs the transition
         instead of the world. */
      /* Twice, deliberately: `content-visibility: auto` means a section that
         has never been on screen reports its placeholder height, so the first
         scroll only gets us close and every offset below it then moves. The
         second read is the accurate one. */
      for (const settle of [900, 1100]) {
        await page.evaluate((s) => {
          const el = document.getElementById(s);
          if (!el) return;
          const centre = el.offsetTop + el.offsetHeight / 2 - window.innerHeight / 2;
          window.scrollTo(0, Math.max(0, centre));
        }, id);
        await nap(settle);
      }
      await page.screenshot({ path: `${dir}/${width}-${id}.png` });
    }

    /* And one frame of every seam, mid-transition, so the eleven transitions
       are reviewable as pictures rather than as claims. */
    if (width === 1440) {
      for (let i = 1; i < SECTIONS.length; i++) {
        await page.evaluate((s) => {
          const el = document.getElementById(s);
          if (el) window.scrollTo(0, el.offsetTop - window.innerHeight * 0.5);
        }, SECTIONS[i]);
        await nap(900);
        await page.screenshot({ path: `${dir}/seam-${SECTIONS[i - 1]}-${SECTIONS[i]}.png` });
      }
    }
    /* Overflow check: nothing may scroll the document sideways. */
    const overflow = await page.evaluate(() => ({
      docWidth: document.documentElement.scrollWidth,
      winWidth: window.innerWidth,
      /* Only elements that are not inside something that deliberately clips or
         scrolls: a marquee inside a mask is not a document overflow. */
      offenders: Array.from(document.querySelectorAll('*'))
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 2)
        .filter((el) => {
          for (let n = el.parentElement; n; n = n.parentElement) {
            const cs = getComputedStyle(n);
            if (cs.overflowX === 'hidden' || cs.overflowX === 'auto' || cs.overflowX === 'scroll') return false;
            if (cs.maskImage !== 'none' || cs.webkitMaskImage !== 'none') return false;
          }
          return true;
        })
        .slice(0, 6)
        .map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`),
    }));
    found.push({ width, ...overflow });
    await ctx.close();
    await browser.close();
  }
  return found;
}

const SHOTS_ONLY = process.argv.includes('--shots-only');
/* Re-measures the cold pass alone and merges it into the phase's existing
   JSON, for when the harness changed and the build did not. */
const COLD_ONLY = process.argv.includes('--cold-only');
const out = {};

if (COLD_ONLY) {
  const { readFile } = await import('node:fs/promises');
  const prev = JSON.parse(await readFile(`qa/report-${PHASE}.json`, 'utf8'));
  const browser = await launch();
  console.log('· cold load only, 390×844, CPU ×4, Fast 4G');
  prev.cold = await coldLoad(browser, { tier: null });
  await browser.close();
  console.log('  LCP', prev.cold.lcp, 'ms · CLS', prev.cold.cls,
    '· first screen', ((prev.cold.transferredAtLoad + prev.cold.documentBytes) / 1024).toFixed(0), 'KB',
    '· total', (prev.cold.bytes.total / 1024).toFixed(0), 'KB');
  await writeFile(`qa/report-${PHASE}.json`, JSON.stringify(prev, null, 2));
  process.exit(0);
}

if (SHOTS_ONLY) {
  console.log('· screenshots only, 6 widths × 12 sections');
  out.shots = await shots('high');
  await writeFile(`qa/report-shots-${PHASE}.json`, JSON.stringify(out, null, 2));
  console.log(`\nwrote qa/report-shots-${PHASE}.json`);
  process.exit(0);
}

let browser = await launch();
console.log('· cold load, 390×844, CPU ×4, Fast 4G');
out.cold = await coldLoad(browser, { tier: null });
console.log('  LCP', out.cold.lcp, 'ms · CLS', out.cold.cls, '· total bytes', (out.cold.bytes.total / 1024).toFixed(0), 'KB');

await browser.close();

const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const avg = (o) => {
  const v = Object.values(o);
  return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '0';
};
const say = (r) => console.log(
  `  ${r.label}: tier ${r.chose?.tier ?? '?'}${r.chose?.downgrades ? ` (ladder acted ${r.chose.downgrades}×)` : ''}` +
  ` · avg ${avg(r.perf.fps)} fps · >33 ${sum(r.perf.over33)} · >50 ${sum(r.perf.over50)}` +
  ` · long ${r.perf.longTasks.length}`);

console.log('· scroll run, 390×844, CPU ×4, tier chosen by the page');
browser = await launch();
out.mobile = await scrollRun(browser, { width: 390, height: 844, cpu: 4, label: 'mobile' });
await browser.close();
say(out.mobile);

console.log('· scroll run, 1440×900, no throttle, tier chosen by the page');
browser = await launch();
out.desktop = await scrollRun(browser, { width: 1440, height: 900, cpu: 1, label: 'desktop' });
await browser.close();
say(out.desktop);

/* The ceiling, not a result: every effect at full strength with the ladder
   held off, on a machine with no GPU. It exists to put a number on what
   adaptive degradation is buying. */
console.log('· stress run, 1440×900, tier=high pinned (degradation disabled)');
browser = await launch();
out.stress = await scrollRun(browser, { width: 1440, height: 900, cpu: 1, tier: 'high', pin: true, label: 'stress' });
await browser.close();
say(out.stress);

console.log('· scroll run, 390×844, tier=low (degradation path)');
browser = await launch();
out.low = await scrollRun(browser, { width: 390, height: 844, cpu: 4, tier: 'low', pin: true, label: 'low-tier' });
await browser.close();
say(out.low);

console.log('· screenshots, 6 widths × 12 sections');
out.shots = await shots('high');
await mkdir('qa', { recursive: true });
await writeFile(`qa/report-${PHASE}.json`, JSON.stringify(out, null, 2));
console.log(`\nwrote qa/report-${PHASE}.json`);
