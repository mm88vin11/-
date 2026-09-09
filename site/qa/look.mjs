import { chromium } from 'playwright';
const spec = JSON.parse(process.argv[2] ?? '[["top",0.05]]');
const w = Number(process.env.W ?? 1440);
const h = Number(process.env.H ?? 900);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: w, height: h } });
await p.goto((process.env.QA_URL ?? 'http://localhost:4181/') + '?tier=high', { waitUntil: 'load' });
await p.waitForTimeout(6000);
for (const [name, frac] of spec) {
  await p.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), frac);
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `/tmp/look-${name}.png` });
}
await b.close();
