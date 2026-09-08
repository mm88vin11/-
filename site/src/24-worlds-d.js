/* ═══════════════════════════════════════════════════════════════════════════
   БАЗА — 24 · worlds 10–11 + the metrics tape
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var K = window.BAZA, $ = K.$, $$ = K.$$, D = document, W = window, B = D.body;
var Clock = K.Clock, clamp = K.clamp, lerp = K.lerp, rnd = K.rnd, Snd = K.Snd, RM = K.RM;

/* ═════════════════════════════════════════════════════ 10 · ИЗНАНКА ══════ */
(function upside() {
  var sec = $('#basement'); if (!sec) return;
  var row = $('#wallRow'), wire = $('#wallWire'), read = $('#wallRead');
  var goBtn = $('#wallGo'), codeEl = $('#udCode');

  var AZ = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'.split('');
  var WORD = 'ИЗНАНКА';
  var BULB = ['#ffcf6a', '#ff7a5c', '#7ad1ff', '#9dff8a', '#ff9de0'];

  AZ.forEach(function (ch, i) {
    var d = D.createElement('span');
    d.className = 'ltr';
    d.style.setProperty('--bulb', BULB[i % BULB.length]);
    d.innerHTML = '<b>' + ch + '</b>';
    row.appendChild(d);
  });
  var cells = $$('.ltr', row);

  /* The wire is drawn after layout so it actually sags between the bulbs it
     is hanging from, rather than being a decorative squiggle behind them. */
  function drawWire() {
    var r = row.getBoundingClientRect();
    if (!r.width) return;
    wire.setAttribute('viewBox', '0 0 ' + Math.round(r.width) + ' ' + Math.round(r.height));
    wire.style.width = r.width + 'px';
    wire.style.height = r.height + 'px';
    var pts = cells.map(function (c) {
      var cr = c.getBoundingClientRect();
      return [cr.left - r.left + cr.width / 2, cr.top - r.top + 5];
    });
    var d = '';
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      if (Math.abs(b[1] - a[1]) > 20) { d += 'M' + a[0] + ' ' + a[1]; continue; }
      var mx = (a[0] + b[0]) / 2, my = Math.max(a[1], b[1]) + 9;
      d += (i === 0 || !d ? 'M' + a[0] + ' ' + a[1] : '') + 'Q' + mx + ' ' + my + ' ' + b[0] + ' ' + b[1];
    }
    wire.innerHTML = '<path d="' + d + '" fill="none" stroke="rgba(207,220,232,.2)" stroke-width="1.4"/>';
  }
  requestAnimationFrame(drawWire);
  Clock.add(function () {}, { resize: drawWire, onScroll: false });

  var running = false;
  goBtn.addEventListener('click', function () {
    if (running) return;
    running = true;
    cells.forEach(function (c) { c.classList.remove('is-lit'); });
    read.textContent = '';
    var i = 0;
    (function next() {
      if (i >= WORD.length) {
        running = false;
        codeEl.textContent = WORD;
        Snd.clear();
        return;
      }
      var idx = AZ.indexOf(WORD[i]);
      if (idx >= 0) cells[idx].classList.add('is-lit');
      read.textContent += WORD[i];
      Snd.click();
      i++;
      setTimeout(next, RM ? 0 : 460);
    })();
  });

  $('#udCopy').addEventListener('click', function () {
    K.copy(WORD, 'Кодовое слово скопировано');
  });

  /* the drifting spores */
  var air = $('#udAir'), actx = air.getContext('2d'), motes = [];
  function size() {
    var dpr = Math.min(W.devicePixelRatio || 1, 1.5);
    var r = air.getBoundingClientRect();
    air.width = Math.max(1, r.width * dpr | 0); air.height = Math.max(1, r.height * dpr | 0);
    motes = [];
    for (var i = 0; i < 70; i++) {
      motes.push({ x: Math.random() * air.width, y: Math.random() * air.height,
                   r: rnd(.6, 2.2) * dpr, v: rnd(-.3, -.05) * dpr, d: rnd(-.2, .2) * dpr,
                   a: rnd(.15, .6) });
    }
  }
  size();
  function frame() {
    actx.clearRect(0, 0, air.width, air.height);
    for (var i = 0; i < motes.length; i++) {
      var m = motes[i];
      m.y += m.v * Clock.dt;
      m.x += (m.d + Math.sin(m.y * .01) * .2) * Clock.dt;
      if (m.y < -10) { m.y = air.height + 10; m.x = Math.random() * air.width; }
      actx.fillStyle = 'rgba(210,228,245,' + m.a + ')';
      actx.beginPath(); actx.arc(m.x, m.y, m.r, 0, 7); actx.fill();
    }
  }
  if (RM) frame();
  else {
    var job = Clock.add(frame, { resize: size, onScroll: false, always: true });
    Clock.bind(sec, job, '20% 0px');
  }

  /* the button nobody should press */
  var nope = $('#nope'), pressed = 0;
  var LINES = [
    'Вам же сказали.',
    'Второй раз — это уже осознанно.',
    'Хорошо. Гирлянда ваша.',
    'Всё, кнопка закончилась. Идите оставьте заявку.'
  ];
  nope.addEventListener('click', function () {
    K.toast(LINES[Math.min(pressed, LINES.length - 1)]);
    Snd.bump();
    pressed++;
    if (pressed === 3) {
      cells.forEach(function (c, i) {
        setTimeout(function () { c.classList.add('is-lit'); }, i * 40);
      });
      read.textContent = 'ВСЁ СРАЗУ';
    }
    if (pressed >= 4) {
      sec.style.transition = 'transform 900ms cubic-bezier(.16,.84,.24,1)';
      sec.style.transform = 'rotate(180deg)';
      setTimeout(function () { sec.style.transform = ''; }, 2400);
    }
  });
})();

/* ═════════════════════════════════════════════════════ 11 · ТИТРЫ ════════ */
(function crawl() {
  var sec = $('#credits'); if (!sec) return;
  var deck = $('#crawlDeck'), pre = $('#crawlPre'), stars = $('#stars');
  var ctx = stars.getContext('2d'), field = [];

  function size() {
    var dpr = Math.min(W.devicePixelRatio || 1, 1.5);
    var r = stars.getBoundingClientRect();
    stars.width = Math.max(1, r.width * dpr | 0); stars.height = Math.max(1, r.height * dpr | 0);
    field = [];
    for (var i = 0; i < 190; i++) {
      field.push({ x: Math.random() * stars.width, y: Math.random() * stars.height,
                   r: rnd(.4, 1.5) * dpr, a: rnd(.25, 1), t: Math.random() * 6.28 });
    }
  }
  size();

  function paintStars(t) {
    ctx.clearRect(0, 0, stars.width, stars.height);
    for (var i = 0; i < field.length; i++) {
      var s = field[i];
      var tw = s.a * (.6 + .4 * Math.sin(t * .0013 + s.t));
      ctx.fillStyle = 'rgba(255,255,255,' + tw + ')';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
    }
  }

  /* The crawl is driven by scroll rather than a fixed-duration keyframe, so
     the reader sets the pace — a timed crawl either outruns you or stalls. */
  var job = Clock.add(function (y) {
    var top = sec.offsetTop;
    var run = sec.offsetHeight + W.innerHeight;
    var p = clamp((y + W.innerHeight - top) / Math.max(1, run), 0, 1);
    var h = deck.offsetHeight || 800;
    deck.style.setProperty('--cy', (-p * (h + W.innerHeight * .9)) + 'px');
    pre.classList.toggle('is-in', p > .02 && p < .3);
    paintStars(performance.now());
  }, { resize: size, always: true, onScroll: false });
  Clock.bind(sec, job, '30% 0px');
})();

/* ═════════════════════════════════════════════ the metrics tape ═════════ */
(function tape() {
  var run = $('#tapeRun'), mask = $('#tapeMask');
  if (!run) return;

  /* The same sixteen numbers the previous build carried, with the same
     up-is-green / down-is-red reading. */
  var MET = [
    ['Заявки', '+167%', 1], ['Стоимость лида', '−38%', 0],
    ['Конверсия', '+52%', 1], ['Отказы', '−29%', 0],
    ['Органический охват', '+156%', 1], ['Время до конверсии', '−42%', 0],
    ['Ошибки 404', '−94%', 0], ['Позиции в поиске', '+67', 1],
    ['Время на сайте', '+1.9 мин', 1], ['Скорость загрузки', '−2.4 c', 0],
    ['Мобильный трафик', '+152%', 1], ['Потерянные заявки', '−81%', 0],
    ['Повторные обращения', '+73%', 1], ['Стоимость заявки', '−27%', 0],
    ['Индексация страниц', '+218', 1], ['Брендовый поиск', '+89%', 1]
  ];
  var UP = '<svg viewBox="0 0 8 7" fill="currentColor" aria-hidden="true"><path d="M4 0l4 7H0z"/></svg>';
  var DN = '<svg viewBox="0 0 8 7" fill="currentColor" aria-hidden="true"><path d="M4 7L0 0h8z"/></svg>';

  function html() {
    return MET.map(function (m) {
      return '<span class="tape__m tape__m--' + (m[2] ? 'up' : 'down') + '">' +
             '<span class="tape__mk">' + m[0] + '</span>' +
             '<span class="tape__mv">' + (m[2] ? UP : DN) + m[1] + '</span></span>';
    }).join('');
  }
  /* two copies so the wrap is seamless */
  run.innerHTML = html() + html();

  var x = 0, half = 0, drag = null, vel = -.42;
  function measure() { half = run.scrollWidth / 2; }
  requestAnimationFrame(measure);

  Clock.add(function () {
    if (!half) { measure(); return; }
    if (!drag) x += vel * Clock.dt;
    if (x <= -half) x += half;
    if (x > 0) x -= half;
    run.style.transform = 'translate3d(' + x + 'px,0,0)';
  }, { resize: measure, onScroll: false, always: true });

  mask.addEventListener('pointerdown', function (e) {
    drag = { x: e.clientX, x0: x };
    mask.classList.add('is-drag');
    mask.setPointerCapture && mask.setPointerCapture(e.pointerId);
  });
  mask.addEventListener('pointermove', function (e) {
    if (!drag) return;
    x = drag.x0 + (e.clientX - drag.x);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) {
    mask.addEventListener(t, function () { drag = null; mask.classList.remove('is-drag'); });
  });

  var card = $('#tapeCard');
  $('#tapeQ').addEventListener('click', function () { card.classList.toggle('is-open'); });
  $('#tapeX').addEventListener('click', function () { card.classList.remove('is-open'); });
  D.addEventListener('click', function (e) {
    if (!card.classList.contains('is-open')) return;
    if (card.contains(e.target) || e.target.closest('#tapeQ')) return;
    card.classList.remove('is-open');
  });
})();

})();
