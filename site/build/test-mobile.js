/* Mobile behaviour test.

   Guards the three things that made the page feel unstable on a phone:
     1. a swipe that starts on an interactive canvas must still scroll,
     2. focusing a form field must not zoom the viewport (iOS zooms in on any
        input under 16px and never zooms back out),
     3. tapping things must not move the page under the finger.
*/
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'dist', 'site');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const f = path.join(SITE, rel);
      if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        r.writeHead(404); return r.end();
      }
      r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(r);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`   ${pass ? '✓' : '✗'} ${name}${detail ? '  — ' + detail : ''}`);
}

(async () => {
  const srv = await serve();
  const PAGE = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true
  });
  const page = await ctx.newPage();
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.classList.contains('booted'),
    null, { timeout: 25000 }).catch(() => { });
  await page.evaluate(() => { const c = document.querySelector('#cook'); if (c) c.hidden = true; });

  console.log('\n── text size (iOS zoom trigger)');
  const small = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('input,select,textarea').forEach(el => {
      const cs = getComputedStyle(el);
      if (el.type === 'hidden' || el.type === 'range' || el.type === 'checkbox') return;
      const px = parseFloat(cs.fontSize);
      if (px < 16) bad.push((el.id || el.name || el.type) + ' ' + px + 'px');
    });
    return bad;
  });
  check('every text field is at least 16px', small.length === 0, small.join(', ') || 'none under 16px');

  console.log('\n── swipes must scroll, not get eaten');
  // any element that claims the whole gesture is a dead zone for scrolling
  const eaters = await page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight, bad = [];
    document.querySelectorAll('body *').forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.touchAction !== 'none') return;
      const r = el.getBoundingClientRect();
      // only care about things big enough to swallow a real swipe
      if (r.width * r.height < vw * vh * 0.06) return;
      bad.push((el.id ? '#' + el.id : el.tagName.toLowerCase() +
        (typeof el.className === 'string' && el.className
          ? '.' + el.className.trim().split(/\s+/)[0] : '')) +
        ' ' + Math.round(r.width) + '×' + Math.round(r.height));
    });
    return [...new Set(bad)];
  });
  check('no large element blocks scrolling outright', eaters.length === 0,
    eaters.join(', ') || 'none');

  // and prove it with a real finger drag across the portal
  await page.evaluate(() => {
    const el = document.querySelector('#atlas');
    if (el) el.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(600);
  const ringBox = await page.evaluate(() => {
    const r = document.querySelector('.st__ring');
    if (!r) return null;
    const b = r.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  if (ringBox) {
    const before = await page.evaluate(() => window.scrollY);
    // a quick flick, the way a thumb scrolls past a widget
    await page.touchscreen.tap(ringBox.x, ringBox.y);
    await page.mouse.move(ringBox.x, ringBox.y);
    await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      const mk = (type, cy) => new TouchEvent(type, {
        bubbles: true, cancelable: true,
        touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: el, clientX: x, clientY: cy })],
        changedTouches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: cy })]
      });
      el.dispatchEvent(mk('touchstart', y));
      let cancelled = false;
      for (let i = 1; i <= 6; i++) {
        const ev = mk('touchmove', y - i * 22);
        el.dispatchEvent(ev);
        if (ev.defaultPrevented) cancelled = true;
      }
      el.dispatchEvent(mk('touchend', y - 132));
      window.__swipeCancelled = cancelled;
    }, ringBox);
    const cancelled = await page.evaluate(() => window.__swipeCancelled);
    check('a quick swipe over the portal is left to the page', cancelled === false,
      cancelled ? 'preventDefault fired without a hold' : 'not cancelled');
  }

  console.log('\n── taps must not move the page');
  const jump = await page.evaluate(async () => {
    document.querySelector('#pain').scrollIntoView({ block: 'center' });
    await new Promise(r => setTimeout(r, 500));
    const y0 = window.scrollY;
    const b = document.querySelector('#painBlocks button, #painBlocks .mblock');
    if (b) { b.click(); await new Promise(r => setTimeout(r, 450)); }
    return Math.abs(window.scrollY - y0);
  });
  check('tapping a Mario block does not scroll the page', jump <= 2, jump + 'px');

  console.log('\n── viewport meta');
  const meta = await page.evaluate(() =>
    (document.querySelector('meta[name=viewport]') || {}).content || '');
  check('pinch-zoom is left available to the visitor',
    !/user-scalable\s*=\s*no/.test(meta) && !/maximum-scale\s*=\s*1/.test(meta), meta);

  await browser.close();
  srv.close();
  const failed = results.filter(r => !r.pass);
  console.log(failed.length
    ? `\n✗ ${failed.length}/${results.length} checks failed`
    : `\n✓ all ${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})();
