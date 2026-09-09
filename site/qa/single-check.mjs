/**
 * Does the single-file build actually work as a file?
 *
 * `build:single` is only worth having if the result opens by double-click with
 * nothing beside it, so this loads it over `file://` — no server — and checks
 * that the loader clears, the reel decodes, and each section paints its own
 * ground colour rather than a blank or a white frame. Pixels are sampled from
 * the screenshots because "it looked fine" is how the white-seam bug survived
 * three passes.
 *
 *   npm run build:single && node qa/single-check.mjs
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const FILE = process.env.SINGLE_HTML ?? new URL('../dist-single/index.html', import.meta.url).pathname;
await p.goto(`file://${FILE}`, { waitUntil: 'load' });
await p.waitForTimeout(8000);
const state = await p.evaluate(() => ({
  live: document.body.classList.contains('is-live'),
  reel: document.body.classList.contains('reel-ready'),
  loaderHidden: document.getElementById('load')?.hasAttribute('hidden'),
  docH: document.body.scrollHeight,
  headings: document.querySelectorAll('h2').length,
}));
const shots = [];
for (const [name, frac] of [['hero', 0.05], ['pain', 0.14], ['pricing', 0.34], ['gains', 0.62], ['credits', 0.93]]) {
  await p.evaluate(f => window.scrollTo(0, document.body.scrollHeight * f), frac);
  await p.waitForTimeout(1800);
  const f = `/tmp/single-${name}.png`;
  await p.screenshot({ path: f });
  const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => { const i = (y * info.width + x) * info.channels; return data.slice(i, i + 3).join(','); };
  shots.push(`${name}=${at(640, 420)}`);
}
console.log(JSON.stringify(state), '| pixels:', shots.join(' '), '| errors:', errs.slice(0, 3));
await b.close();
