/**
 * The opening, measured.
 *
 * Four checks the brief asks for by name and one it implies:
 *
 *  1. the preloader at CPU ×6 with no dropped frame — recorded as video and
 *     also measured from inside the page, frame interval by frame interval
 *  2. the mark's flight into the header lands to the pixel (FLIP)
 *  3. the second visit in a tab is the short version
 *  4. prefers-reduced-motion is a real branch, not a stub
 *  5. a world that throws takes only its own section down
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.QA_URL ?? 'http://localhost:4173/';
const nap = (ms) => new Promise((r) => setTimeout(r, ms));
await mkdir('qa/video', { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const out = {};

/* Frame intervals are sampled from inside the page rather than from the trace:
   the loader owns the only job running at that point, so its own clock is the
   most direct evidence there is. */
const SAMPLER = `
  window.__frames = [];
  let last = 0;
  const probe = (t) => {
    if (last) window.__frames.push(t - last);
    last = t;
    if (window.__frames.length < 400) requestAnimationFrame(probe);
  };
  requestAnimationFrame(probe);
`;

/* ── 1 · the preloader at CPU ×6 ───────────────────────────────────────── */
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: 'qa/video', size: { width: 1280, height: 800 } },
  });
  const page = await ctx.newPage();
  await page.addInitScript(SAMPLER);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await page.goto(BASE, { waitUntil: 'commit' });
  await nap(7000);
  const frames = await page.evaluate(() => window.__frames ?? []);
  const sorted = [...frames].sort((a, b) => a - b);
  out.loaderCpu6 = {
    frames: frames.length,
    median: +(sorted[Math.floor(sorted.length / 2)] ?? 0).toFixed(1),
    p95: +(sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(1),
    worst: +Math.max(...frames, 0).toFixed(1),
    /* A "dropped frame" at 60Hz is an interval over ~33 ms — two frames' worth. */
    dropped: frames.filter((f) => f > 33).length,
    stalls50: frames.filter((f) => f > 50).length,
  };
  await ctx.close();
}

/* ── 2 · the FLIP, to the pixel ────────────────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'commit' });
  /* Sample once the flight class is on, before it finishes. */
  const measured = await page.evaluate(async () => {
    const load = document.getElementById('load');
    const mark = document.getElementById('loadMark');
    const header = document.getElementById('headLogo');
    for (let i = 0; i < 400; i++) {
      if (load?.classList.contains('is-flying')) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    await new Promise((r) => setTimeout(r, 1000));
    const a = mark.getBoundingClientRect();
    const b = header.getBoundingClientRect();
    return {
      markW: +a.width.toFixed(2), logoW: +b.width.toFixed(2),
      dx: +(a.left - b.left).toFixed(2), dy: +(a.top - b.top).toFixed(2),
      dw: +(a.width - b.width).toFixed(2), dh: +(a.height - b.height).toFixed(2),
      markAspect: +(a.width / a.height).toFixed(4),
      logoAspect: +(b.width / b.height).toFixed(4),
    };
  });
  out.flip = measured;
  await ctx.close();
}

/* ── 3 · second visit in the same tab ──────────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await nap(5000);
  const first = await page.evaluate(() => performance.now());
  await page.reload({ waitUntil: 'commit' });
  const t0 = Date.now();
  await page.waitForFunction(() => document.body.classList.contains('is-live'), null, { timeout: 15000 });
  out.secondVisit = { msToLive: Date.now() - t0, firstVisitSampledAt: Math.round(first) };
  await ctx.close();
}

/* ── 4 · reduced motion ────────────────────────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'load' });
  await nap(5000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.35));
  await nap(1500);
  out.reducedMotion = await page.evaluate(() => ({
    rmFlag: document.documentElement.dataset.rm,
    tier: document.documentElement.dataset.tier,
    live: document.body.classList.contains('is-live'),
    risesRevealed: document.querySelectorAll('[data-rise].is-in').length,
    risesTotal: document.querySelectorAll('[data-rise]').length,
    seamOn: document.getElementById('seam')?.classList.contains('is-on') ?? false,
    canvasesHidden: Array.from(document.querySelectorAll('canvas.world__bg'))
      .filter((c) => getComputedStyle(c).display === 'none').length,
  }));
  out.reducedMotion.errors = errors.slice(0, 5);
  await page.screenshot({ path: 'qa/shots/reduced-motion.png' });
  await ctx.close();
}

/* ── 5 · one world falls over, the rest does not ───────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  /* Break WebGL context creation only for the world canvases, leaving 2D and
     the rest of the page alone — the closest thing to "one world throws". */
  await page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (String(type).startsWith('webgl') && this.id === 'mxRain') throw new Error('injected failure');
      return real.call(this, type, ...rest);
    };
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'load' });
  await nap(4000);
  for (const id of ['truth', 'craft', 'cases', 'route', 'gains']) {
    await page.evaluate((s) => {
      const el = document.getElementById(s);
      if (el) window.scrollTo(0, el.offsetTop + el.offsetHeight * 0.4);
    }, id);
    await nap(900);
  }
  out.isolation = await page.evaluate(() => ({
    fallbackSections: Array.from(document.querySelectorAll('[data-fallback="1"]')).map((s) => s.id),
    stillLive: document.body.classList.contains('is-live'),
    laterSectionsRendered: Array.from(document.querySelectorAll('#craft h2, #cases h2, #route h2, #gains h2'))
      .filter((h) => h.getBoundingClientRect().height > 0).length,
    truthTextVisible: (document.querySelector('#truth .h-lg')?.textContent ?? '').length,
  }));
  out.isolation.pageErrors = errors.slice(0, 5);
  await ctx.close();
}

await browser.close();
await writeFile('qa/report-loader.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
