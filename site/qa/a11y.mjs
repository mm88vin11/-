/**
 * Accessibility, measured.
 *
 * Four things the brief asks for by name, each checked rather than asserted:
 *
 *  1. contrast ≥ 4.5:1 for body text in every world (3:1 for large text)
 *  2. every canvas is aria-hidden and every image has alt text
 *  3. the whole page is reachable by keyboard, with a focus ring that is
 *     actually visible
 *  4. the site is readable with WebGL switched off
 *
 * Backgrounds behind text are resolved by walking up for the nearest opaque
 * colour, which is how the design system is built: a world's text sits on its
 * own `--w-bg`, never directly on a canvas.
 */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.QA_URL ?? 'http://localhost:4173/';
const nap = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});

const out = {};

/* ── 1–2 · contrast, alt text, aria-hidden ─────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?tier=high`, { waitUntil: 'load', timeout: 90_000 });
  await nap(5000);
  /* Every section has to be visited so its world mounts and its DOM exists. */
  for (const id of ['pain', 'truth', 'craft', 'cases', 'pricing', 'route', 'gains', 'portal', 'brief', 'basement', 'credits']) {
    await page.evaluate((s) => {
      const el = document.getElementById(s);
      if (el) window.scrollTo(0, el.offsetTop + el.offsetHeight * 0.4);
    }, id);
    await nap(700);
  }

  out.contrast = await page.evaluate(() => {
    const lum = (c) => {
      const s = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
      return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
    };
    const parse = (str) => {
      const m = str.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
      return { rgb: parts.slice(0, 3), a: parts.length > 3 ? parts[3] : 1 };
    };
    const over = (fg, bg) => fg.rgb.map((v, i) => v * fg.a + bg[i] * (1 - fg.a));
    /* Start at the element itself, not its parent: a button paints its own
       background behind its own label, and skipping it reported every filled
       button as cream-on-cream. */
    const bgOf = (el) => {
      for (let n = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        const c = parse(cs.backgroundColor);
        if (c && c.a > 0.92) return c.rgb;
        if (c && c.a > 0) return over(c, bgOf(n.parentElement ?? document.body));
      }
      return [10, 10, 10];
    };
    /* An ancestor painting a gradient or an image is a background this script
       cannot resolve to one colour. Those nodes are listed separately rather
       than guessed at, because a guess here is worse than an admission. */
    const painted = (el) => {
      for (let n = el; n; n = n.parentElement) {
        if (getComputedStyle(n).backgroundImage !== 'none') return true;
      }
      return false;
    };
    const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };

    const bad = [];
    const unresolved = [];
    let checked = 0;
    for (const el of document.querySelectorAll('p, h1, h2, h3, h4, li, a, button, span, b, u, i, label, small, time')) {
      const text = (el.textContent ?? '').trim();
      if (!text || el.children.length > 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.15) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const fg = parse(cs.color);
      if (!fg) continue;
      const sel = `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`;
      if (painted(el)) {
        unresolved.push({ sel, text: text.slice(0, 40),
                          section: el.closest('section')?.id ?? 'chrome' });
        continue;
      }
      const bg = bgOf(el);
      const eff = over(fg, bg);
      const size = parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700);
      const need = large ? 3 : 4.5;
      const got = ratio(eff, bg);
      checked++;
      if (got < need) {
        bad.push({
          section: el.closest('section')?.id ?? el.closest('header,footer,aside,nav')?.id ?? 'chrome',
          text: text.slice(0, 44), ratio: +got.toFixed(2), need,
          color: cs.color, size: Math.round(size), sel,
        });
      }
    }
    return { checked, failures: bad, unresolved };
  });

  out.media = await page.evaluate(() => ({
    canvasesWithoutAriaHidden: Array.from(document.querySelectorAll('canvas'))
      .filter((c) => c.getAttribute('aria-hidden') !== 'true')
      .map((c) => c.id || c.className),
    imagesWithoutAlt: Array.from(document.querySelectorAll('img'))
      .filter((i) => i.getAttribute('alt') === null)
      .map((i) => i.src.split('/').pop()),
    imagesWithoutBox: Array.from(document.querySelectorAll('img'))
      .filter((i) => !i.getAttribute('width') || !i.getAttribute('height'))
      .map((i) => i.src.split('/').pop()),
  }));

  /* ── 3 · keyboard ────────────────────────────────────────────────────── */
  await page.evaluate(() => window.scrollTo(0, 0));
  await nap(400);
  const visited = [];
  let ringless = 0;
  for (let i = 0; i < 170; i++) {
    await page.keyboard.press('Tab');
    const step = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || (el.className || '').toString().split(' ')[0],
        section: el.closest('section')?.id ?? 'chrome',
        outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
        inView: r.top > -40 && r.top < window.innerHeight + 40,
      };
    });
    if (!step) break;
    if (!step.outline) ringless++;
    visited.push(step);
  }
  out.keyboard = {
    stops: visited.length,
    sectionsReached: [...new Set(visited.map((v) => v.section))],
    stopsWithoutVisibleRing: ringless,
  };

  await ctx.close();
}

/* ── 4 · no WebGL ──────────────────────────────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (String(type).startsWith('webgl')) return null;
      return real.call(this, type, ...rest);
    };
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}`, { waitUntil: 'load', timeout: 90_000 });
  await nap(6000);
  const state = await page.evaluate(() => ({
    live: document.body.classList.contains('is-live'),
    loaderGone: document.getElementById('load')?.hasAttribute('hidden'),
    headingsVisible: Array.from(document.querySelectorAll('h2'))
      .filter((h) => h.getBoundingClientRect().height > 0).length,
    bodyText: document.body.innerText.replace(/\s+/g, ' ').trim().length,
    fallbackSections: Array.from(document.querySelectorAll('[data-fallback="1"]')).map((s) => s.id),
  }));
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
  await nap(1500);
  await page.screenshot({ path: 'qa/shots/no-webgl.png' });
  out.noWebGL = { ...state, errors: errors.slice(0, 6) };
  await ctx.close();
}

await browser.close();
await writeFile('qa/report-a11y.json', JSON.stringify(out, null, 2));

console.log(`contrast: checked ${out.contrast.checked} text nodes, ${out.contrast.failures.length} below threshold, ` +
            `${out.contrast.unresolved.length} on a gradient this script cannot resolve`);
for (const f of out.contrast.failures.slice(0, 20)) {
  console.log(`   ${f.ratio}:1 (need ${f.need}) · ${f.section} · ${f.sel} · "${f.text}"`);
}
console.log('media:', JSON.stringify(out.media));
console.log('keyboard:', out.keyboard.stops, 'stops,', out.keyboard.stopsWithoutVisibleRing, 'without a ring; sections:', out.keyboard.sectionsReached.join(','));
console.log('no-webgl:', JSON.stringify(out.noWebGL));
