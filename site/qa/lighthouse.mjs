/**
 * Lighthouse, mobile preset.
 *
 * Read the caveat in the report before quoting the performance number: this
 * container has no GPU, Chromium runs SwiftShader, and Lighthouse's mobile
 * preset then throttles that software rasteriser by another 4×. Accessibility
 * and best-practices are hardware-independent and mean exactly what they say.
 */
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { writeFile } from 'node:fs/promises';

const BASE = process.env.QA_URL ?? 'http://localhost:4173/';
const chrome = await launch({
  chromePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  chromeFlags: ['--headless=new', '--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});

const runOne = async (formFactor) => {
  const res = await lighthouse(BASE, {
    port: chrome.port,
    output: ['json', 'html'],
    logLevel: 'error',
    formFactor,
    screenEmulation: formFactor === 'mobile'
      ? { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false }
      : { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false },
    throttlingMethod: 'simulate',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  });
  await writeFile(`qa/lighthouse-${formFactor}.html`, res.report[1]);
  const c = res.lhr.categories;
  const audits = res.lhr.audits;
  return {
    scores: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.round((v.score ?? 0) * 100)])),
    metrics: {
      lcp: audits['largest-contentful-paint']?.displayValue,
      cls: audits['cumulative-layout-shift']?.displayValue,
      tbt: audits['total-blocking-time']?.displayValue,
      fcp: audits['first-contentful-paint']?.displayValue,
      si: audits['speed-index']?.displayValue,
    },
    failedAudits: Object.values(audits)
      .filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode === 'binary')
      .map((a) => a.id)
      .slice(0, 20),
  };
};

const out = { mobile: await runOne('mobile'), desktop: await runOne('desktop') };
await chrome.kill();
await writeFile('qa/report-lighthouse.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
