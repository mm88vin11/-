/* Verification harness.
   Loads the folder build in a real browser at several viewports, records every
   console error and page exception, walks the whole page by scroll while
   sampling frame pacing, and writes screenshots for eyeballing.

   Run: node site/build/check.js [--shots] [--only=desktop]
*/
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { execFileSync } = require('child_process');

/* Собираем перед проверкой и падаем, если сборка не прошла. Раньше неудачный
   запуск из другого каталога оставлял в dist прошлую сборку, и стенд честно
   мерил вчерашний код. */
try {
  execFileSync('python3', [path.join(__dirname, 'bundle.py'), '--folder'], { stdio: 'pipe' });
} catch (e) {
  console.error('build failed:\n' + (e.stderr || e.stdout || e.message).toString());
  process.exit(2);
}

const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'dist', 'site');

/* Served over HTTP rather than opened from disk: fetch() cannot read file://
   URLs, so a file:// run exercises the <img> fallback instead of the real
   decode path and buries the console in CORS noise that production never has. */
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.json': 'application/json' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rep) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const f = path.join(SITE, rel);
      if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        rep.writeHead(404); return rep.end('nope');
      }
      rep.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rep);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}
const SHOTDIR = path.join(ROOT, 'dist', 'shots');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, dsf: 2, touch: false },
  { name: 'laptop', width: 1280, height: 720, dsf: 1, touch: false },
  { name: 'tablet', width: 820, height: 1180, dsf: 2, touch: true },
  { name: 'phone', width: 390, height: 844, dsf: 3, touch: true },
  { name: 'phone-sm', width: 360, height: 640, dsf: 2, touch: true }
];

const wantShots = process.argv.includes('--shots');
const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1];

(async () => {
  const srv = await serve();
  const PAGE = 'http://127.0.0.1:' + srv.address().port + '/index.html';

  // the environment ships its own chromium; point at it rather than
  // downloading a second copy for the pinned playwright version
  const EXE = process.env.CHROMIUM_BIN ||
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch(
    require('fs').existsSync(EXE) ? { executablePath: EXE } : {});
  let failures = 0;
  const report = [];

  for (const vp of VIEWPORTS) {
    if (only && vp.name !== only) continue;

    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dsf,
      hasTouch: vp.touch,
      isMobile: vp.touch,
      reducedMotion: 'no-preference'
    });
    const page = await ctx.newPage();

    const errors = [];
    page.on('console', m => {
      if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300));
    });
    page.on('pageerror', e => errors.push('pageerror: ' + (e.message || e).toString().slice(0, 300)));
    page.on('requestfailed', r => {
      const u = r.url();
      // file:// favicon probes are noise, everything else is a real miss
      if (!/favicon/.test(u)) errors.push('404: ' + u.replace(PAGE, '').slice(-90));
    });

    await page.goto(PAGE, { waitUntil: 'load', timeout: 60000 });

    // the reel gates the reveal; wait for it or the 7s failsafe
    await page.waitForFunction(
      () => document.documentElement.classList.contains('booted'),
      null, { timeout: 20000 }
    ).catch(() => errors.push('boot: never revealed'));

    const height = await page.evaluate(() => document.body.scrollHeight);

    /* Walk the page and sample frame pacing. Long frames are what a visitor
       feels as judder, so the number that matters is not the average but how
       many frames blew past the 16.7ms budget. */
    const pacing = await page.evaluate(async (vh) => {
      const gaps = [];
      let last = performance.now();
      let raf = 0;
      const tick = (t) => { gaps.push(t - last); last = t; raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);

      /* Скорость прокрутки — человеческая, 900 px/сек. Прошлый вариант шагал
         по трети экрана каждые 34 мс, то есть примерно в двадцать раз быстрее,
         чем это физически делает человек: под такой нагрузкой любая страница
         показывает две трети «длинных» кадров, и число говорит о стенде, а не о
         сайте. */
      const total = document.body.scrollHeight;
      const t0 = performance.now();
      let y = 0;
      while (performance.now() - t0 < 12000 && y < total) {
        y += 900 / 60;
        window.scrollTo(0, y);
        await new Promise(r => requestAnimationFrame(r));
      }
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 120));
      cancelAnimationFrame(raf);

      const g = gaps.slice(3).sort((a, b) => a - b);
      if (!g.length) return null;
      const at = q => g[Math.min(g.length - 1, Math.floor(g.length * q))];
      return {
        frames: g.length,
        p50: +at(0.5).toFixed(1),
        p95: +at(0.95).toFixed(1),
        worst: +g[g.length - 1].toFixed(1),
        over33: g.filter(x => x > 33).length
      };
    }, vp.height);

    /* Горизонтальное «ёрзанье».

       Сравнивать scrollWidth с clientWidth здесь нельзя: в мобильной
       эмуляции Chrome пустой документ уже показывает разницу в полторы сотни
       пикселей, и проверка ловит эмулятор, а не сайт. Проверяется то, что
       человек реально чувствует пальцем, — уезжает ли страница вбок, — а
       список виновников собирается только если уезжает, и только из тех
       элементов, которые не обрезаны предком. */
    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      const before = window.scrollX;
      window.scrollTo(400, window.scrollY);
      const moved = Math.round(window.scrollX);
      window.scrollTo(before, window.scrollY);
      if (moved <= 1) return null;

      const vw = de.clientWidth;
      const clipped = (el) => {
        for (let a = el.parentElement; a && a !== de; a = a.parentElement) {
          const o = getComputedStyle(a).overflowX;
          if (o === 'hidden' || o === 'clip' || o === 'auto' || o === 'scroll') return true;
        }
        return false;
      };
      const who = [];
      document.querySelectorAll('body *').forEach(el => {
        if (who.length >= 6) return;
        const r = el.getBoundingClientRect();
        if (!r.width || r.right <= vw + 2) return;
        if (clipped(el)) return;
        const sel = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
          (el.className && typeof el.className === 'string'
            ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
        if (!who.includes(sel)) who.push(sel + ' →' + Math.round(r.right));
      });
      return { over: moved, who };
    });

    if (wantShots) {
      fs.mkdirSync(SHOTDIR, { recursive: true });
      // the cookie bar is correct behaviour but it sits over the art in shots
      await page.evaluate(() => { const c = document.querySelector('#cook'); if (c) c.hidden = true; });
      const spots = await page.evaluate(() =>
        Array.from(document.querySelectorAll('section[id]')).map(s => ({
          id: s.id, y: s.getBoundingClientRect().top + window.scrollY
        })));
      for (const s of spots) {
        await page.evaluate(y => window.scrollTo(0, y), s.y + 40);
        await page.waitForTimeout(650);
        await page.screenshot({ path: path.join(SHOTDIR, `${vp.name}-${s.id}.png`) });
      }
    }

    await ctx.close();

    const ok = errors.length === 0 && !overflow;
    if (!ok) failures++;
    report.push({ vp: vp.name, errors, pacing, overflow, height });

    console.log(`\n── ${vp.name} (${vp.width}×${vp.height} @${vp.dsf}x)${vp.touch ? ' touch' : ''}`);
    console.log(`   page height ${height}px`);
    if (pacing) {
      const pct = (100 * pacing.over33 / pacing.frames).toFixed(0);
      console.log(`   long frames (>33ms): ${pacing.over33}/${pacing.frames} (${pct}%)` +
        `  · p95 ${pacing.p95}ms · worst ${pacing.worst}ms`);
      console.log(`   (p50 ${pacing.p50}ms — sits on the 16.7/33.3 boundary, so it flips` +
        ` between identical builds; judge by the long-frame share)`);
    }
    if (overflow) console.log(`   ✗ page scrolls sideways by ${overflow.over}px → ${overflow.who.join(', ')}`);
    if (errors.length) {
      console.log(`   ✗ ${errors.length} error(s):`);
      [...new Set(errors)].slice(0, 12).forEach(e => console.log('     • ' + e));
    } else {
      console.log('   ✓ no console errors');
    }
  }

  await browser.close();
  srv.close();
  fs.writeFileSync(path.join(ROOT, 'dist', 'check-report.json'), JSON.stringify(report, null, 1));
  /* Про высокий DPR. Headless Chromium растеризует на процессоре, поэтому
     число длинных кадров здесь следует за количеством пикселей, а не за
     сайтом: одна и та же страница даёт 1-3% на @1x и упирается в потолок на
     @2x/@3x. На живом устройстве канвасы композитятся видеокартой. Судить о
     плавности по @1x-строкам; @2x полезен только чтобы поймать ошибки и
     боковой скролл. */
  console.log('\nПлавность судится по @1x-строкам: на @2x/@3x headless-браузер' +
    ' растеризует на CPU, и счётчик упирается в число пикселей, а не в сайт.');
  console.log(failures ? `\n✗ ${failures} viewport(s) with problems` : '\n✓ all viewports clean');
  process.exit(failures ? 1 : 0);
})();
