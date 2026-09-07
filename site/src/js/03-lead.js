/* ==========================================================================
   БАЗА — lead pipeline.

   Восстановлено из боевой сборки и усилено. Заявка обязана дойти, даже если
   в момент отправки у человека отвалилась сеть или он закрыл вкладку.

   Порядок каналов, первый успешный останавливает цепочку:
     1. endpoint            — свой обработчик (CRM / Make / n8n / worker)
     2. Telegram, HTML      — красивое сообщение с разметкой
     3. Telegram, plain     — тот же смысл, если разметку не приняли
   Не ушло вообще — заявка ложится в localStorage и досылается при следующем
   заходе, а человеку предлагается продублировать её в личку одной кнопкой.
   ========================================================================== */
(function (w, d) {
  'use strict';

  var B = (w.BAZA = w.BAZA || {});

  /* ═══ КУДА УХОДИТ ЗАЯВКА ═════════════════════════════════════════════════
     endpoint — свой обработчик. Получает POST application/json с телом
                payload(). Это единственный по-настоящему безопасный путь:
                за ним токен вообще не приезжает в браузер.
     tgToken + tgChat — прямая отправка ботом, когда бэкенда нет.
     tgUser — куда отправить человека руками, если не ушло ничем.          */
  var LEAD = {
    endpoint: '',
    tgToken: '',
    tgChat: '-5492086609',
    tgUser: 'lllbaza'
  };

  /* Токен на клиенте строкой хранить нельзя: сканеры круглосуточно обходят
     сайты и ищут шаблон вида 1234567890:AA… — найденный угоняют за минуты.
     Здесь искать нечего: TGX — это XOR с TGK, склеенный обратно только в
     памяти вкладки. От сканеров спасает, от человека с консолью — нет.
     Настоящая защита одна: endpoint выше. */
  var TGX = 'ekxFQ1l6UwJTG3IRJhp/bCQvMx4cEyZkO1kaZV4qYwcoHEITWC0LVQJIeTQJBw==';
  var TGK = 'BzqpjJb0a+HPgR23';

  var _tg;
  function tgSecret() {
    if (_tg !== undefined) return _tg;
    _tg = '';
    try {
      if (TGX && TGK) {
        var raw = atob(TGX), out = '';
        for (var i = 0; i < raw.length; i++) {
          out += String.fromCharCode(raw.charCodeAt(i) ^ TGK.charCodeAt(i % TGK.length));
        }
        _tg = out;
      }
    } catch (e) { _tg = ''; }
    return _tg;
  }

  function haveChannel() {
    return !!(LEAD.endpoint || ((LEAD.tgToken || tgSecret()) && LEAD.tgChat));
  }

  /* ─────────────────────────────────────────────────────────── контекст ── */
  /* Собирается один раз при загрузке: откуда человек пришёл, с чего смотрит,
     сколько уже был на сайте. В сообщении это отвечает на «кто это вообще». */

  var T0 = Date.now();
  var SESSION = (function () {
    var s = { utm: {}, ref: '', entry: '', screen: '', first: 1 };
    try {
      var q = new URLSearchParams(w.location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
        var v = q.get(k);
        if (v) s.utm[k.replace('utm_', '')] = v.slice(0, 80);
      });
      // клик по рекламе часто приносит только один из этих
      ['yclid', 'gclid', 'fbclid'].forEach(function (k) {
        var v = q.get(k); if (v) s.utm[k] = v.slice(0, 80);
      });
      s.ref = (d.referrer || '').slice(0, 160);
      s.entry = (w.location.pathname + w.location.hash).slice(0, 120);
      s.screen = w.innerWidth + '×' + w.innerHeight +
        (w.devicePixelRatio > 1 ? ' @' + (Math.round(w.devicePixelRatio * 10) / 10) + 'x' : '');
    } catch (e) { }
    // метка «первый визит» помогает продажникам: возврат — другой разговор
    try {
      var K = 'lb-seen-v1';
      if (localStorage.getItem(K)) s.first = 0;
      localStorage.setItem(K, String(Date.now()));
    } catch (e) { }
    // сохраняем первую атрибуцию: человек мог уйти и вернуться напрямую
    try {
      var A = 'lb-attr-v1';
      var saved = JSON.parse(localStorage.getItem(A) || 'null');
      if (Object.keys(s.utm).length || (s.ref && !/lllbaza/.test(s.ref))) {
        localStorage.setItem(A, JSON.stringify({ utm: s.utm, ref: s.ref, at: Date.now() }));
      } else if (saved) {
        s.utm = saved.utm || s.utm;
        s.ref = s.ref || saved.ref || '';
        s.attrAged = 1;
      }
    } catch (e) { }
    return s;
  })();

  function humanTime(ms) {
    var sec = Math.round(ms / 1000);
    if (sec < 60) return sec + ' сек';
    var m = Math.floor(sec / 60);
    if (m < 60) return m + ' мин ' + (sec % 60) + ' сек';
    return Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин';
  }

  function whereFrom() {
    var u = SESSION.utm;
    var bits = [];
    if (u.source) bits.push(u.source + (u.medium ? ' / ' + u.medium : ''));
    if (u.campaign) bits.push('кампания «' + u.campaign + '»');
    if (u.yclid) bits.push('Яндекс.Директ');
    else if (u.gclid) bits.push('Google Ads');
    if (!bits.length) {
      if (!SESSION.ref) bits.push('прямой заход или закладка');
      else if (/lllbaza/.test(SESSION.ref)) bits.push('переход внутри сайта');
      else bits.push(SESSION.ref.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]);
    }
    if (SESSION.attrAged) bits.push('(атрибуция с прошлого визита)');
    return bits.join(', ');
  }

  /* ───────────────────────────────────────────────────────────── payload ── */

  function payload(fields) {
    var p = {
      id: 'lb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      at: new Date().toISOString(),
      onSite: Date.now() - T0,
      site: 'lllbaza.ru',
      utm: SESSION.utm,
      ref: SESSION.ref,
      entry: SESSION.entry,
      screen: SESSION.screen,
      firstVisit: !!SESSION.first,
      ua: (navigator.userAgent || '').slice(0, 200)
    };
    for (var k in fields) if (Object.prototype.hasOwnProperty.call(fields, k)) p[k] = fields[k];
    return p;
  }

  /* ────────────────────────────────────────────────────────── сообщение ── */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function lines(p) {
    var L = [];
    if (p.name) L.push(['Имя', p.name]);
    if (p.phone) L.push(['Телефон', p.phone]);
    if (p.contact) L.push(['Связь', p.contact]);
    if (p.msg) L.push(['Задача', p.msg]);
    if (p.wants && p.wants.length) L.push(['Нужно', p.wants.join(', ')]);
    if (p.pain && p.pain.length) L.push(['Болит', p.pain.join(', ')]);
    if (p.when) L.push(['Сроки', p.when]);
    if (p.budget) L.push(['Вилка на сайте', p.budget]);
    if (p.term) L.push(['Срок по расчёту', p.term]);
    if (p.reco) L.push(['Сайт советовал', p.reco]);
    return L;
  }

  function toHtml(p) {
    var out = ['<b>Заявка с сайта</b>'];
    if (p.firstVisit) out.push('<i>первый визит</i>');
    out.push('');
    lines(p).forEach(function (r) {
      out.push('<b>' + esc(r[0]) + ':</b> ' + esc(r[1]));
    });
    out.push('');
    out.push('<i>Источник:</i> ' + esc(whereFrom()));
    out.push('<i>На сайте:</i> ' + esc(humanTime(p.onSite)));
    out.push('<i>Экран:</i> ' + esc(p.screen));
    if (p.fastFill) out.push('<i>⚠ заполнено за</i> ' + esc(Math.round(p.fastFill / 100) / 10) + ' сек');
    if (p.trail) out.push('<i>Путь:</i> ' + esc(p.trail));
    // телефон отдельной строкой без разметки — так его удобно тапнуть в TG
    if (p.phone) out.push('\n<code>' + esc(String(p.phone).replace(/[^\d+]/g, '')) + '</code>');
    return out.join('\n');
  }

  function toText(p) {
    var out = ['Заявка с сайта' + (p.firstVisit ? ' (первый визит)' : ''), ''];
    lines(p).forEach(function (r) { out.push(r[0] + ': ' + r[1]); });
    out.push('—————————————');
    out.push('Источник: ' + whereFrom());
    out.push('На сайте: ' + humanTime(p.onSite));
    if (p.fastFill) out.push('⚠ форма заполнена за ' + (Math.round(p.fastFill / 100) / 10) + ' сек');
    if (p.trail) out.push('Путь: ' + p.trail);
    return out.join('\n');
  }

  /* ─────────────────────────────────────────────────────────── очередь ─── */

  var LQ = 'lb-lead-queue-v2';

  function qRead() {
    try {
      var v = JSON.parse(localStorage.getItem(LQ) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function qWrite(list) {
    try { localStorage.setItem(LQ, JSON.stringify(list.slice(-20))); } catch (e) { }
  }
  function qSave(p) {
    var q = qRead();
    if (!q.some(function (x) { return x && x.id === p.id; })) q.push(p);
    qWrite(q);
  }
  function qDrop(id) {
    qWrite(qRead().filter(function (x) { return x && x.id !== id; }));
  }

  /* ────────────────────────────────────────────────────────── отправка ─── */

  /* Таймаут обязателен: зависший канал не должен держать интерфейс. */
  function post(url, body, ms) {
    var ac = null;
    try { ac = new AbortController(); } catch (e) { ac = null; }
    var to = setTimeout(function () { try { if (ac) ac.abort(); } catch (e) { } }, ms || 11000);
    var opt = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // вкладку могут закрыть сразу после нажатия — запрос должен пережить это
      keepalive: true
    };
    if (ac) opt.signal = ac.signal;
    if (!w.fetch) return Promise.resolve(false);
    return fetch(url, opt).then(
      function (r) { clearTimeout(to); return !!(r && r.ok); },
      function () { clearTimeout(to); return false; }
    );
  }

  function send(p) {
    var steps = [];
    if (LEAD.endpoint) steps.push(function () { return post(LEAD.endpoint, p); });

    var tok = LEAD.tgToken || tgSecret();
    if (tok && LEAD.tgChat) {
      var url = 'https://api.telegram.org/bot' + tok + '/sendMessage';
      steps.push(function () {
        return post(url, {
          chat_id: LEAD.tgChat, text: toHtml(p),
          parse_mode: 'HTML', disable_web_page_preview: true
        });
      });
      // разметку могли не принять — тот же смысл уходит простым текстом
      steps.push(function () {
        return post(url, {
          chat_id: LEAD.tgChat, text: toText(p), disable_web_page_preview: true
        });
      });
    }

    if (!steps.length) return Promise.resolve(false);
    var i = 0;
    function run() {
      if (i >= steps.length) return Promise.resolve(false);
      return steps[i++]().then(function (ok) { return ok ? true : run(); }, run);
    }
    return run();
  }

  /* Дожать всё, что не ушло в прошлый раз. Тихо: человек об этом не просил. */
  function flush() {
    var q = qRead();
    if (!q.length || !haveChannel()) return;
    q.forEach(function (p) {
      if (!p || !p.id) return;
      send(p).then(function (ok) { if (ok) qDrop(p.id); });
    });
  }

  /* ─────────────────────────────────────────────────── публичный вызов ─── */

  /* Единственная точка входа для форм. Возвращает промис со статусом:
       'sent'    — дошло
       'queued'  — не дошло, лежит в очереди, предложите дубль в личку
     Заявка кладётся в очередь ДО отправки, а не после неудачи: если вкладку
     закроют в момент запроса, она всё равно догонит при следующем заходе. */
  function submit(fields) {
    var p = payload(fields);
    qSave(p);
    return send(p).then(function (ok) {
      if (ok) { qDrop(p.id); return { status: 'sent', payload: p }; }
      return { status: 'queued', payload: p };
    }, function () {
      return { status: 'queued', payload: p };
    });
  }

  /* Ссылка «дописать в личку» — заявка не теряется даже без единого канала. */
  function manualLink(p) {
    var t = toText(p);
    return 'https://t.me/' + LEAD.tgUser + '?text=' + encodeURIComponent(t.slice(0, 1800));
  }

  function copyText(p) {
    var t = toText(p);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(t).then(function () { return true; },
        function () { return false; });
    }
    return Promise.resolve(false);
  }

  /* ───────────────────────────────────────────────────────── антиспам ──── */

  /* Два фильтра, оба без капчи — и с разной ценой ошибки, поэтому и
     последствия у них разные.

     honeypot — поле, скрытое от человека. Заполнить его вручную нельзя, так
     что ложное срабатывание практически исключено: такую отправку роняем
     молча.

     время — заполнение за секунду выглядит как скрипт. Но так же выглядит
     человек с автозаполнением, который ткнул «дальше» и сразу «отправить».
     Ронять из-за этого живую заявку нельзя: она не дошла бы, и никто бы не
     узнал. Поэтому время не роняет ничего — оно лишь помечает сообщение,
     а решение принимает человек на той стороне. */
  function isTrap(form) {
    try {
      var hp = form.querySelector('[name="company_url"]');
      return !!(hp && hp.value);
    } catch (e) { return false; }
  }

  function fillSpeed(openedAt) {
    if (!openedAt) return 0;
    return Date.now() - openedAt;
  }

  B.lead = {
    submit: submit,
    flush: flush,
    manualLink: manualLink,
    copyText: copyText,
    isTrap: isTrap,
    fillSpeed: fillSpeed,
    haveChannel: haveChannel,
    toText: toText,
    tgUser: LEAD.tgUser,
    queued: function () { return qRead().length; }
  };

  // досылаем на свободном ходу, чтобы не мешать первой отрисовке
  var idle = w.requestIdleCallback || function (f) { return setTimeout(f, 1500); };
  idle(function () { flush(); });
})(window, document);
