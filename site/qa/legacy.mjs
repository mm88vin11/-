/**
 * The old build, measured the same way as the new one.
 *
 * "Before and after" is only worth printing if both halves were measured on
 * the same machine, in the same browser, with the same scroll. So this serves
 * the original 13.5 MB single file and runs the same 25-second scroll against
 * it, sampling frame intervals from an injected rAF loop (the old page has no
 * perf hooks of its own) plus the same PerformanceObservers.
 *
 *   ASSET_SRC=<dir containing the legacy html> node qa/legacy.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FILE = process.env.LEGACY_HTML;
if (!FILE) { console.error('LEGACY_HTML=<path to the old single file> is required'); process.exit(1); }
const nap = (ms) => new Promise((r) => setTimeout(r, ms));

const html = await readFile(FILE);
const size = (await stat(FILE)).size;
const server = createServer((_, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
});
await new Promise((r) => server.listen(4199, r));

const SAMPLER = `
  window.__f = []; window.__long = []; window.__cls = 0; window.__lcp = 0;
  let last = 0;
  const probe = (t) => { if (last) window.__f.push(t - last); last = t; requestAnimationFrame(probe); };
  requestAnimationFrame(probe);
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)); })
    .observe({ type: 'longtask', buffered: true }); } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
    .observe({ type: 'layout-shift', buffered: true }); } catch {}
  try { new PerformanceObserver((l) => { const es = l.getEntries(); window.__lcp = Math.round(es[es.length - 1].startTime); })
    .observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
`;

async function run({ width, height, cpu, label }) {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: width < 500 ? 2 : 1 });
  const page = await ctx.newPage();
  await page.addInitScript(SAMPLER);
  let bytes = 0;
  page.on('response', async (res) => {
    try { bytes += (await res.body().catch(() => Buffer.alloc(0))).length; } catch { /* ignore */ }
  });
  const cdp = await ctx.newCDPSession(page);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });

  const t0 = Date.now();
  await page.goto('http://localhost:4199/', { waitUntil: 'load', timeout: 180_000 });
  const loadMs = Date.now() - t0;
  await nap(8000);
  await page.evaluate(() => { window.__f.length = 0; window.__long.length = 0; });

  const total = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);
  for (let i = 0; i <= 250; i++) {
    await page.evaluate((v) => window.scrollTo(0, v), Math.round((total * i) / 250));
    await nap(100);
  }
  const out = await page.evaluate(() => ({
    frames: window.__f.length,
    over33: window.__f.filter((x) => x > 33).length,
    over50: window.__f.filter((x) => x > 50).length,
    avgMs: window.__f.reduce((a, b) => a + b, 0) / Math.max(1, window.__f.length),
    long: window.__long.length,
    longWorst: window.__long.length ? Math.max(...window.__long) : 0,
    cls: Math.round(window.__cls * 1e4) / 1e4,
    lcp: window.__lcp,
    memory: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
    rafCount: (document.documentElement.outerHTML.match(/requestAnimationFrame/g) ?? []).length,
  }));
  await browser.close();
  return { label, width, height, cpu, loadMs, bytes, ...out, fps: Math.round((1000 / out.avgMs) * 10) / 10 };
}

const report = {
  file: FILE,
  bytes: size,
  desktop: await run({ width: 1440, height: 900, cpu: 1, label: 'desktop' }),
  mobile: await run({ width: 390, height: 844, cpu: 4, label: 'mobile' }),
};
server.close();
await writeFile('qa/report-legacy.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
