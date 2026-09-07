/* Functional test for the lead pipeline.

   The regression this guards against is specific: the previous build collected
   the payload, logged it to the console and showed a success screen without
   sending anything anywhere. So the test does not check that the UI says
   "sent" — it checks that a request actually left the page, and what was in it.

   The Telegram endpoint is intercepted, never called: no traffic reaches the
   real bot, and the token never has to be read to run the test.
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
  results.push({ name, pass, detail });
  console.log(`   ${pass ? '✓' : '✗'} ${name}${detail ? '  — ' + detail : ''}`);
}

(async () => {
  const srv = await serve();
  const PAGE = 'http://127.0.0.1:' + srv.address().port + '/index.html';
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const sent = [];
  // intercept before anything can reach the real bot
  await page.route('**://api.telegram.org/**', route => {
    let body = null;
    try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) { }
    sent.push({ url: route.request().url(), body });
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });

  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));

  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.classList.contains('booted'),
    null, { timeout: 25000 }).catch(() => { });

  console.log('\n── lead pipeline');

  check('B.lead is exposed', await page.evaluate(() => !!(window.BAZA && window.BAZA.lead)));
  check('a delivery channel is configured',
    await page.evaluate(() => window.BAZA.lead.haveChannel()));

  // ---- fill the brief ------------------------------------------------------
  await page.evaluate(() => document.querySelector('#brief').scrollIntoView());
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    document.querySelectorAll('#brWants .chip')[0].click();
    document.querySelectorAll('#brWhen .chip')[0].click();
    document.querySelectorAll('#brPain .chip')[0].click();
  });
  await page.waitForTimeout(150);

  const budgetShown = await page.evaluate(() => document.querySelector('#brFrom').textContent.trim());
  check('budget fork computes from the choices', budgetShown !== '—' && budgetShown !== '',
    'from = ' + budgetShown);

  await page.click('#brNext');
  await page.waitForTimeout(250);

  // ---- validation must actually block -------------------------------------
  await page.click('#brSend');
  await page.waitForTimeout(200);
  check('empty form is rejected', sent.length === 0 &&
    await page.evaluate(() => !document.querySelector('#brErr').hidden));

  await page.fill('#brName', 'Владислав');
  await page.fill('#brPhone', '89000000000');
  await page.click('#brSend');
  await page.waitForTimeout(200);
  check('missing consent is rejected', sent.length === 0);

  await page.click('.br__agree .br__box');

  // ---- the real submit -----------------------------------------------------
  await page.click('#brSend');
  await page.waitForTimeout(1600);

  check('a request actually left the page', sent.length > 0,
    sent.length + ' call(s) to api.telegram.org');

  if (sent.length) {
    const b = sent[0].body || {};
    const text = b.text || '';
    check('sendMessage endpoint used', /\/sendMessage$/.test(sent[0].url));
    check('chat_id is set', !!b.chat_id, String(b.chat_id));
    check('name is in the message', text.includes('Владислав'));
    check('phone is in the message', /9000000000/.test(text.replace(/\D/g, '')));
    check('quiz answers are in the message', /Нужно:|Болит:|Сроки:/.test(text));
    check('attribution is in the message', /Источник:/.test(text));
    check('token never appears in the message body', !/\d{8,}:[A-Za-z0-9_-]{30,}/.test(text));
  }

  const doneShown = await page.evaluate(() =>
    !document.querySelector('#brDone').hidden);
  check('success screen shown', doneShown);

  const queued = await page.evaluate(() => window.BAZA.lead.queued());
  check('queue drained after a successful send', queued === 0, 'queue = ' + queued);

  // ---- offline behaviour ---------------------------------------------------
  console.log('\n── offline fallback');
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page2 = await ctx2.newPage();
  await page2.route('**://api.telegram.org/**', r => r.abort('failed'));
  await page2.goto(PAGE, { waitUntil: 'load' });
  await page2.waitForFunction(() => document.documentElement.classList.contains('booted'),
    null, { timeout: 25000 }).catch(() => { });
  await page2.evaluate(() => document.querySelector('#brief').scrollIntoView());
  await page2.evaluate(() => {
    document.querySelectorAll('#brWants .chip')[0].click();
    document.querySelector('#brNext').click();
  });
  await page2.waitForTimeout(200);
  await page2.fill('#brName', 'Тест');
  await page2.fill('#brPhone', '89111111111');
  await page2.click('.br__agree .br__box');
  await page2.click('#brSend');
  await page2.waitForTimeout(2000);

  const q2 = await page2.evaluate(() => window.BAZA.lead.queued());
  check('failed send is kept in the queue', q2 > 0, 'queue = ' + q2);
  const warn = await page2.evaluate(() =>
    document.querySelector('#brDone').classList.contains('is-warn'));
  check('visitor is told delivery failed', warn);
  const manual = await page2.evaluate(() => {
    const a = document.querySelector('#brDone a');
    return a ? a.href : '';
  });
  check('a manual Telegram link is offered', /t\.me\/.+\?text=/.test(manual));

  // ---- honeypot ------------------------------------------------------------
  console.log('\n── spam filters');
  const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page3 = await ctx3.newPage();
  const sent3 = [];
  await page3.route('**://api.telegram.org/**', route => {
    sent3.push(1);
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page3.goto(PAGE, { waitUntil: 'load' });
  await page3.waitForFunction(() => document.documentElement.classList.contains('booted'),
    null, { timeout: 25000 }).catch(() => { });
  await page3.evaluate(() => {
    document.querySelector('#brief').scrollIntoView();
    document.querySelectorAll('#brWants .chip')[0].click();
    document.querySelector('#brNext').click();
  });
  await page3.waitForTimeout(300);
  await page3.fill('#brName', 'Бот');
  await page3.fill('#brPhone', '89222222222');
  await page3.click('.br__agree .br__box');
  await page3.evaluate(() => {
    document.querySelector('[name="company_url"]').value = 'http://spam.example';
  });
  await page3.click('#brSend');
  await page3.waitForTimeout(1200);
  check('honeypot submission is not delivered', sent3.length === 0);

  // a fast-but-real fill must still get through, annotated rather than dropped
  console.log('\n── fast fill is delivered, not dropped');
  const ctx4 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page4 = await ctx4.newPage();
  const sent4 = [];
  await page4.route('**://api.telegram.org/**', route => {
    let body = null;
    try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
    sent4.push(body);
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page4.goto(PAGE, { waitUntil: 'load' });
  await page4.waitForFunction(() => document.documentElement.classList.contains('booted'),
    null, { timeout: 25000 }).catch(() => {});
  await page4.evaluate(() => {
    document.querySelector('#brief').scrollIntoView();
    document.querySelectorAll('#brWants .chip')[0].click();
    document.querySelector('#brNext').click();
  });
  await page4.waitForTimeout(120);
  await page4.fill('#brName', 'Быстрый');
  await page4.fill('#brPhone', '89333333333');
  await page4.click('.br__agree .br__box');
  await page4.click('#brSend');
  await page4.waitForTimeout(1500);
  check('sub-2s fill is still delivered', sent4.length > 0, sent4.length + ' call(s)');
  check('fast fill is flagged for the operator',
    sent4.length > 0 && /заполнено за/.test(sent4[0].text || ''));

  check('no page exceptions', errs.length === 0, errs.slice(0, 2).join(' // '));

  await browser.close();
  srv.close();

  const failed = results.filter(r => !r.pass);
  console.log(failed.length
    ? `\n✗ ${failed.length}/${results.length} checks failed`
    : `\n✓ all ${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})();
