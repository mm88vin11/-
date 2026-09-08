/* ═══════════════════════════════════════════════════════════════════════════
   БАЗА — 23 · worlds 07–09
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var K = window.BAZA, $ = K.$, $$ = K.$$, D = document, W = window;
var Clock = K.Clock, clamp = K.clamp, lerp = K.lerp, rnd = K.rnd, Snd = K.Snd, RM = K.RM;

/* ═════════════════════════════════════════════════════ 07 · БОЛОТО ═══════ */
(function swamp() {
  var sec = $('#gains'); if (!sec) return;

  var LAYERS = [
    { n: 'Работающий продукт', p: 'Не макет и не «дизайн в фигме». Открывается по ссылке, работает на телефоне, принимает заявки с первого дня.' },
    { n: 'Заявки в одном месте', p: 'Куда бы человек ни написал, заявка падает в одну воронку с источником, временем и статусом.' },
    { n: 'Доступы на ваше имя',  p: 'Домен, хостинг, аналитика, CRM — всё оформлено на вас. Уйти от нас можно в любой день и ничего не потерять.' },
    { n: 'Понятные цифры',       p: 'Дашборд, где видно: сколько пришло, сколько дошло, сколько стоило. Без «показов» и «охватов».' },
    { n: 'Команда, которая умеет','p': 'Получасовая запись, как всё устроено, и месяц, когда мы рядом. Дальше вы справляетесь без нас — и это цель, а не риск.' }
  ];

  var onion = $('#onion'), list = $('#swampList'), hint = $('#onionHint');

  /* The onion is drawn as real concentric shells so a peel can take one shell
     away and leave a smaller onion behind — a stack of divs could not. */
  var NS = 'http://www.w3.org/2000/svg';
  var svg = D.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Луковица: снимайте слои');

  var defs = D.createElementNS(NS, 'defs');
  defs.innerHTML =
    '<radialGradient id="ogl" cx="38%" cy="30%"><stop offset="0" stop-color="#fff6d8"/><stop offset="1" stop-color="#e8d69a"/></radialGradient>';
  svg.appendChild(defs);

  /* stem + leaves first, so the shells cover their base */
  var stem = D.createElementNS(NS, 'path');
  stem.setAttribute('d', 'M100 46 C96 30 88 20 78 12 C92 16 100 26 102 38 C106 26 116 18 128 14 C118 24 106 32 104 46 Z');
  stem.setAttribute('fill', '#6f9b31');
  svg.appendChild(stem);

  var shells = [];
  var N = LAYERS.length;
  for (var i = 0; i < N; i++) {
    var t = i / N;
    var rx = 78 - t * 13, ry = 70 - t * 12;
    var g = D.createElementNS(NS, 'g');
    g.setAttribute('class', 'onion__layer');
    g.style.setProperty('--peel', (-38 - i * 7) + 'deg');
    g.style.setProperty('--px', (-26 - i * 6) + '%');
    g.style.setProperty('--py', (40 + i * 6) + '%');

    var body = D.createElementNS(NS, 'path');
    body.setAttribute('d', onionPath(100, 112, rx, ry));
    body.setAttribute('fill', i === 0 ? 'url(#ogl)' : shade(i));
    body.setAttribute('stroke', 'rgba(120,96,40,.35)');
    body.setAttribute('stroke-width', '1');
    g.appendChild(body);

    /* the papery ribs */
    for (var k = -2; k <= 2; k++) {
      var rib = D.createElementNS(NS, 'path');
      rib.setAttribute('d', 'M100 ' + (112 - ry) + ' Q' + (100 + k * rx * .34) + ' 112 100 ' + (112 + ry * .92));
      rib.setAttribute('fill', 'none');
      rib.setAttribute('stroke', 'rgba(150,120,55,.26)');
      rib.setAttribute('stroke-width', '.9');
      g.appendChild(rib);
    }
    svg.appendChild(g);
    shells.push(g);
  }
  onion.insertBefore(svg, onion.firstChild);

  function onionPath(cx, cy, rx, ry) {
    return 'M' + cx + ' ' + (cy - ry) +
      ' C' + (cx + rx * .96) + ' ' + (cy - ry * .82) + ' ' + (cx + rx) + ' ' + (cy + ry * .34) + ' ' + cx + ' ' + (cy + ry) +
      ' C' + (cx - rx) + ' ' + (cy + ry * .34) + ' ' + (cx - rx * .96) + ' ' + (cy - ry * .82) + ' ' + cx + ' ' + (cy - ry) + ' Z';
  }
  function shade(i) {
    var tints = ['#f3e6b8', '#eddda6', '#e6d294', '#dfc783', '#d8bd74'];
    return tints[i % tints.length];
  }

  LAYERS.forEach(function (l, i) {
    var li = D.createElement('li');
    li.className = 'layer';
    li.innerHTML = '<span class="layer__n">' + (i + 1) + '</span><span><b>' + l.n + '</b><p>' + l.p + '</p></span>';
    list.appendChild(li);
  });
  var rows = $$('.layer', list);

  var peeled = 0;
  function peel() {
    if (peeled >= N) return;
    /* outermost first — shells are drawn largest to smallest */
    var g = shells[peeled];
    g.classList.add('is-off');
    rows[peeled].classList.add('is-on');
    rows[peeled].scrollIntoView ? null : null;
    peeled++;
    Snd.click();
    hint.textContent = peeled >= N ? '' : 'ещё ' + (N - peeled) + ' ' + plural(N - peeled, ['слой', 'слоя', 'слоёв']);
    if (peeled >= N) { onion.classList.add('is-done'); Snd.clear(); }
  }
  function plural(n, f) {
    var m = n % 100;
    if (m > 4 && m < 20) return f[2];
    m = n % 10;
    return m === 1 ? f[0] : m > 1 && m < 5 ? f[1] : f[2];
  }
  onion.addEventListener('click', peel);
  onion.setAttribute('tabindex', '0');
  onion.setAttribute('role', 'button');
  onion.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); peel(); }
  });
  hint.textContent = 'снимите слой — их ' + N;

  /* ——— the swamp itself: reeds, fireflies, a shack on the far bank ——— */
  var bg = $('#swampBg'), ctx = bg.getContext('2d');
  var flies = [];
  function size() {
    var dpr = Math.min(W.devicePixelRatio || 1, 1.5);
    var r = bg.getBoundingClientRect();
    bg.width = Math.max(1, r.width * dpr | 0); bg.height = Math.max(1, r.height * dpr | 0);
    flies = [];
    for (var i = 0; i < 26; i++) {
      flies.push({ x: Math.random() * bg.width, y: Math.random() * bg.height,
                   r: rnd(1, 2.4) * dpr, a: Math.random() * 6.28, s: rnd(.2, .7) });
    }
  }
  size();

  function frame(t) {
    var w = bg.width, h = bg.height;
    ctx.clearRect(0, 0, w, h);

    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#4e7d33'); g.addColorStop(.34, '#33622a');
    g.addColorStop(.62, '#22491c'); g.addColorStop(1, '#132a0d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    /* low sun through the canopy */
    var sg = ctx.createRadialGradient(w * .74, h * .2, 0, w * .74, h * .2, w * .6);
    sg.addColorStop(0, 'rgba(255,238,150,.22)'); sg.addColorStop(1, 'rgba(255,238,150,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);

    /* mist bands */
    for (var m = 0; m < 3; m++) {
      ctx.fillStyle = 'rgba(200,228,160,' + (.035 + m * .014) + ')';
      var my = h * (.5 + m * .13);
      ctx.fillRect(0, my, w, h * .045);
    }

    /* the far bank: a treeline and Shrek's shack, sitting on the horizon
       rather than everything being crowded into the bottom strip */
    var hz = h * .52;
    ctx.fillStyle = 'rgba(14,38,10,.72)';
    ctx.beginPath();
    ctx.moveTo(0, hz + h * .06);
    for (var tx = 0; tx <= w; tx += w / 60) {
      var th = Math.abs(Math.sin(tx * .0042) + Math.sin(tx * .011)) * h * .05;
      ctx.lineTo(tx, hz - th);
    }
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();

    var sw = w * .052, sx = w * .78, sy = hz - sw * .16;
    ctx.fillStyle = 'rgba(58,38,18,.9)';
    ctx.fillRect(sx, sy, sw, sw * .9);
    ctx.beginPath();
    ctx.moveTo(sx - sw * .12, sy); ctx.lineTo(sx + sw * .5, sy - sw * .42);
    ctx.lineTo(sx + sw * 1.12, sy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(230,200,110,.5)';
    ctx.fillRect(sx + sw * .34, sy + sw * .26, sw * .3, sw * .3);

    /* reeds, deterministic so they do not crawl */
    ctx.strokeStyle = 'rgba(12,32,8,.5)';
    for (var i = 0; i < 46; i++) {
      var x = ((i * 137.5) % 100) / 100 * w;
      var hh = h * (.16 + ((i * 53) % 40) / 240);
      var sway = Math.sin(t * .0006 + i) * w * .004;
      ctx.lineWidth = Math.max(1, w / 720);
      ctx.beginPath(); ctx.moveTo(x, h);
      ctx.quadraticCurveTo(x + sway, h - hh * .6, x + sway * 2.4, h - hh);
      ctx.stroke();
    }

    /* fireflies */
    for (var f = 0; f < flies.length; f++) {
      var fl = flies[f];
      fl.a += .012 * fl.s;
      fl.x += Math.cos(fl.a) * fl.s; fl.y += Math.sin(fl.a * .7) * fl.s * .6;
      if (fl.x < 0) fl.x = w; if (fl.x > w) fl.x = 0;
      if (fl.y < 0) fl.y = h; if (fl.y > h) fl.y = 0;
      var al = .35 + .35 * Math.sin(t * .003 + f);
      ctx.fillStyle = 'rgba(220,255,140,' + al + ')';
      ctx.beginPath(); ctx.arc(fl.x, fl.y, fl.r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(200,255,120,' + (al * .16) + ')';
      ctx.beginPath(); ctx.arc(fl.x, fl.y, fl.r * 5, 0, 7); ctx.fill();
    }
  }

  if (RM) { frame(0); }
  else {
    var job = Clock.add(function () { frame(performance.now()); },
                        { resize: size, onScroll: false, always: true });
    Clock.bind(sec, job, '20% 0px');
  }

  var tune = $('#swampTune');
  tune.addEventListener('click', function () {
    if (!Snd.on) { K.toast('Включите звук кнопкой справа внизу'); return; }
    tune.classList.add('is-on');
    Snd.riff();
    setTimeout(function () { tune.classList.remove('is-on'); }, 900);
  });
})();

/* ═════════════════════════════════════════════════════ 08 · ПОРТАЛ ═══════ */
(function portal() {
  var sec = $('#portal'); if (!sec) return;
  var ring = $('#ring'), world = $('#ptWorld'), spark = $('#ptSpark');
  var pct = $('#ringPct'), go = $('#ptGo'), skip = $('#ptSkip');
  var wctx = world.getContext('2d'), sctx = spark.getContext('2d');

  var cx = 0, cy = 0, R = 0, dpr = 1;
  /* Coverage is tracked as 72 angular buckets. Drawing "a circle" means
     visiting enough of them at roughly the right radius — which is forgiving
     of a shaky hand while still refusing a straight line. */
  var BUCKETS = 72;
  var hitB = new Uint8Array(BUCKETS);
  var covered = 0, open = 0, opened = false, drawing = false;
  var embersArr = [], trail = [];

  function size() {
    dpr = Math.min(W.devicePixelRatio || 1, 2);
    var r = ring.getBoundingClientRect();
    var w = Math.max(1, r.width * dpr | 0), h = Math.max(1, r.height * dpr | 0);
    world.width = spark.width = w; world.height = spark.height = h;
    cx = w / 2; cy = h / 2; R = Math.min(w, h) * .40;
  }
  size();

  function coverage() { return covered / BUCKETS; }

  function mark(x, y) {
    var dx = x - cx, dy = y - cy;
    var d = Math.hypot(dx, dy);
    /* a generous annulus: half a radius wide */
    if (d < R * .55 || d > R * 1.45) return;
    var a = Math.atan2(dy, dx) + Math.PI;
    var b = Math.floor(a / (Math.PI * 2) * BUCKETS) % BUCKETS;
    if (!hitB[b]) { hitB[b] = 1; covered++; }
    trail.push({ x: x, y: y, t: performance.now() });
    if (trail.length > 90) trail.shift();
    for (var i = 0; i < 2; i++) {
      embersArr.push({ x: x, y: y, vx: rnd(-1, 1) * dpr, vy: rnd(-1.6, -.2) * dpr,
                       life: 1, r: rnd(1, 2.6) * dpr });
    }
  }

  function toLocal(e) {
    var r = spark.getBoundingClientRect();
    return [(e.clientX - r.left) * (spark.width / r.width),
            (e.clientY - r.top) * (spark.height / r.height)];
  }

  ring.addEventListener('pointerdown', function (e) {
    if (opened) return;
    drawing = true;
    ring.classList.add('is-drawing');
    ring.setPointerCapture && ring.setPointerCapture(e.pointerId);
    var p = toLocal(e); mark(p[0], p[1]);
  });
  ring.addEventListener('pointermove', function (e) {
    if (!drawing || opened) return;
    e.preventDefault();
    var p = toLocal(e); mark(p[0], p[1]);
    var c = coverage();
    pct.textContent = Math.round(c * 100) + '%';
    if (c >= .82) openPortal();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) {
    ring.addEventListener(t, function () {
      drawing = false;
      ring.classList.remove('is-drawing');
    });
  });

  function openPortal() {
    if (opened) return;
    opened = true;
    ring.classList.add('is-open');
    sec.classList.add('ring-open');
    Snd.craft();
    /* No toast here on purpose: a portal tearing open in front of you does not
       need a caption, and a cream pill over the cream far side is invisible
       anyway. */
  }
  skip.addEventListener('click', function () {
    for (var i = 0; i < BUCKETS; i++) hitB[i] = 1;
    covered = BUCKETS;
    openPortal();
  });

  /* ——— what you see through the hole ——— */
  /* genitive, because the label reads "сигнал из …" */
  var CITY = ['Казани', 'Москвы', 'Санкт-Петербурга', 'Дубая', 'Лимасола', 'Кремниевой долины'];
  var cityI = 0, cityT = 0;

  function drawWorld(t) {
    var w = world.width, h = world.height;
    wctx.clearRect(0, 0, w, h);
    if (open <= .001) return;

    wctx.save();
    /* The disc is a real hole: everything beyond it is clipped away, so the
       far side is not a picture sitting on the page but a view through it. */
    wctx.beginPath();
    wctx.arc(cx, cy, R * open, 0, 7);
    wctx.clip();

    /* Sky above a horizon rather than one flat wash — a solid cream disc
       reads as a hole punched in the page, not as somewhere to go. */
    var HZ = cy + R * .18;
    var g = wctx.createLinearGradient(0, cy - R, 0, HZ);
    g.addColorStop(0, '#8ec6e8'); g.addColorStop(.55, '#e7d9b6'); g.addColorStop(1, '#f6e2b4');
    wctx.fillStyle = g; wctx.fillRect(cx - R, cy - R, R * 2, R + R * .18);

    var sg = wctx.createRadialGradient(cx + R * .3, HZ - R * .1, 0, cx + R * .3, HZ - R * .1, R * .55);
    sg.addColorStop(0, 'rgba(255,236,180,.95)'); sg.addColorStop(1, 'rgba(255,236,180,0)');
    wctx.fillStyle = sg; wctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    /* the skyline sits on the horizon */
    wctx.fillStyle = 'rgba(46,40,30,.34)';
    for (var b = -8; b < 9; b++) {
      var bw = R * .11, bh = R * (.1 + Math.abs(Math.sin(b * 2.1)) * .26);
      wctx.fillRect(cx + b * bw * 1.2, HZ - bh, bw * .92, bh);
    }

    /* ground */
    var gg = wctx.createLinearGradient(0, HZ, 0, cy + R);
    gg.addColorStop(0, '#efe3c8'); gg.addColorStop(1, '#f2ebdd');
    wctx.fillStyle = gg; wctx.fillRect(cx - R, HZ, R * 2, R);

    wctx.strokeStyle = 'rgba(10,10,10,.1)'; wctx.lineWidth = dpr;
    for (var i = 1; i < 5; i++) {
      var y = HZ + R * (i * i * .038);
      wctx.beginPath(); wctx.moveTo(cx - R, y); wctx.lineTo(cx + R, y); wctx.stroke();
    }

    /* the line from the other side */
    if (t - cityT > 2400) { cityT = t; cityI = (cityI + 1) % CITY.length; }
    wctx.fillStyle = 'rgba(10,10,10,.78)';
    wctx.font = '800 ' + Math.round(R * .095) + 'px Manrope, sans-serif';
    wctx.textAlign = 'center';
    wctx.fillText('сигнал из ' + CITY[cityI], cx, cy + R * .5);
    wctx.font = '700 ' + Math.round(R * .055) + 'px "JetBrains Mono", monospace';
    wctx.fillStyle = 'rgba(10,10,10,.5)';
    wctx.fillText('здесь бизнес работает без владельца', cx, cy + R * .63);
    wctx.restore();

    /* the burning rim */
    wctx.save();
    wctx.globalCompositeOperation = 'lighter';
    var rg = wctx.createRadialGradient(cx, cy, R * open * .84, cx, cy, R * open * 1.2);
    rg.addColorStop(0, 'rgba(255,154,60,0)');
    rg.addColorStop(.5, 'rgba(255,154,60,.5)');
    rg.addColorStop(1, 'rgba(255,90,20,0)');
    wctx.fillStyle = rg;
    wctx.beginPath(); wctx.arc(cx, cy, R * open * 1.25, 0, 7); wctx.fill();
    wctx.restore();
  }

  function drawSparks(t) {
    var w = spark.width, h = spark.height;
    sctx.clearRect(0, 0, w, h);

    /* the arc you have actually drawn, bucket by bucket */
    if (!opened) {
      sctx.lineWidth = 3 * dpr; sctx.lineCap = 'round';
      for (var b = 0; b < BUCKETS; b++) {
        if (!hitB[b]) continue;
        var a0 = (b / BUCKETS) * Math.PI * 2 - Math.PI;
        var a1 = ((b + 1) / BUCKETS) * Math.PI * 2 - Math.PI;
        var pulse = .55 + .45 * Math.sin(t * .004 + b * .3);
        sctx.strokeStyle = 'rgba(255,154,60,' + pulse + ')';
        sctx.beginPath(); sctx.arc(cx, cy, R, a0, a1); sctx.stroke();
      }
    } else {
      sctx.lineWidth = 2.4 * dpr;
      for (var s = 0; s < 3; s++) {
        sctx.strokeStyle = 'rgba(255,' + (120 + s * 40) + ',40,' + (.5 - s * .12) + ')';
        sctx.beginPath();
        for (var k = 0; k <= 64; k++) {
          var a = k / 64 * Math.PI * 2;
          var wob = Math.sin(a * 7 + t * .005 + s) * R * .015 + Math.sin(a * 13 - t * .003) * R * .01;
          var rr = R * open + wob + s * 3 * dpr;
          var px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
          k ? sctx.lineTo(px, py) : sctx.moveTo(px, py);
        }
        sctx.closePath(); sctx.stroke();
      }
    }

    /* embers thrown off the rim */
    sctx.save();
    sctx.globalCompositeOperation = 'lighter';
    for (var i = embersArr.length - 1; i >= 0; i--) {
      var e = embersArr[i];
      e.x += e.vx; e.y += e.vy; e.vy += .04 * dpr; e.life -= .022;
      if (e.life <= 0) { embersArr.splice(i, 1); continue; }
      sctx.fillStyle = 'rgba(255,' + (140 + 90 * e.life | 0) + ',60,' + e.life + ')';
      sctx.beginPath(); sctx.arc(e.x, e.y, e.r * e.life, 0, 7); sctx.fill();
    }
    if (opened && embersArr.length < 90 && Math.random() < .6) {
      var a2 = Math.random() * Math.PI * 2;
      embersArr.push({ x: cx + Math.cos(a2) * R * open, y: cy + Math.sin(a2) * R * open,
                       vx: Math.cos(a2) * rnd(.2, 1) * dpr, vy: Math.sin(a2) * rnd(.2, 1) * dpr - .4,
                       life: 1, r: rnd(1, 2.4) * dpr });
    }
    sctx.restore();
  }

  var job = Clock.add(function () {
    var t = performance.now();
    open = lerp(open, opened ? 1 : coverage() * .34, RM ? 1 : .07);
    drawWorld(t);
    drawSparks(t);
  }, { resize: size, onScroll: false, always: true });
  Clock.bind(sec, job, '25% 0px');

  /* ——— stepping through ——— */
  var wipe = $('#wipe');
  function step(ev) {
    var r = ring.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (ev && ev.clientX) { x = ev.clientX; y = ev.clientY; }
    wipe.style.setProperty('--wx', x + 'px');
    wipe.style.setProperty('--wy', y + 'px');
    wipe.classList.remove('is-clear');
    wipe.classList.add('is-go');
    Snd.flux();
    /* Land on the far side mid-wipe, so the light world is already there when
       the disc clears — the circle opens into the next world rather than
       fading to it. */
    setTimeout(function () { K.goTo('brief'); }, 620);
    setTimeout(function () {
      wipe.classList.add('is-clear');
      setTimeout(function () { wipe.classList.remove('is-go', 'is-clear'); }, 640);
    }, 1150);
  }
  go.addEventListener('click', step);
})();

/* ═════════════════════════════════════════════════════ 09 · СВЕТЛЫЙ МИР ══ */
(function light() {
  var sec = $('#brief'); if (!sec) return;

  /* ——— the cities, carried over from the previous build, with the local
         time worked out from a fixed UTC offset per city ——— */
  var CITIES = [
    ['Москва', 3], ['Санкт-Петербург', 3], ['Казань', 3], ['Екатеринбург', 5],
    ['Новосибирск', 7], ['Краснодар', 3], ['Минск', 3], ['Алматы', 5],
    ['Астана', 5], ['Ташкент', 5], ['Ереван', 4], ['Тбилиси', 4],
    ['Бишкек', 6], ['Дубай', 4], ['Лимасол · Кипр', 3], ['Кремниевая долина', -7],
    ['Лос-Анджелес', -7], ['Майами', -4], ['Нью-Йорк', -4]
  ];
  var run = $('#cityRun');
  function localTime(off) {
    var d = new Date();
    var utc = d.getTime() + d.getTimezoneOffset() * 60000;
    var l = new Date(utc + off * 3600000);
    return String(l.getHours()).padStart(2, '0') + ':' + String(l.getMinutes()).padStart(2, '0');
  }
  function fill() {
    var html = CITIES.map(function (c) {
      return '<span class="city">' + c[0] + '<time>' + localTime(c[1]) + '</time></span>';
    }).join('');
    /* doubled, because the marquee loops on a 50% translate */
    run.innerHTML = html + html;
  }
  fill();
  setInterval(fill, 60000);

  /* ——— who we turn down ——— */
  var NO = [
    'Нужно «просто сверстать по макету» — без задачи и без цифр.',
    'Результат нужен вчера, а решения принимаются неделями.',
    'Проект должен окупиться за счёт того, что мы поработаем в долг.',
    'Никто со стороны бизнеса не готов выделить пару часов в неделю.',
    'Задача — обмануть алгоритм или клиента, а не заработать честно.'
  ];
  var X = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
  $('#filterList').innerHTML = NO.map(function (n) { return '<li>' + X + '<span>' + n + '</span></li>'; }).join('');

  /* ——— the brief ——— */
  var WHAT = [
    { k: 'Сайт',            p: 180, w: 4 },
    { k: 'Интернет-магазин', p: 260, w: 6 },
    { k: 'CRM и автоматизация', p: 140, w: 3 },
    { k: 'ИИ-бот',          p: 90,  w: 2 },
    { k: 'Приложение',      p: 320, w: 8 },
    { k: 'Пока не знаю',    p: 0,   w: 0 }
  ];
  var WHEN = [
    { k: 'Вчера',        m: 1.25 }, { k: 'В этом месяце', m: 1.0 },
    { k: 'В квартале',   m: .92 },  { k: 'Присматриваюсь', m: .88 }
  ];
  var PAIN = [
    { k: 'Заявки теряются' }, { k: 'Мало заявок' }, { k: 'Всё вручную' },
    { k: 'Стыдно показать' }, { k: 'Нет аналитики' }
  ];

  var pick = { what: [], when: null, pain: [] };

  function chips(host, items, multi, key) {
    items.forEach(function (it) {
      var b = D.createElement('button');
      b.className = 'chip'; b.type = 'button'; b.textContent = it.k;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        Snd.click();
        if (multi) {
          var on = b.getAttribute('aria-pressed') === 'true';
          b.setAttribute('aria-pressed', on ? 'false' : 'true');
          pick[key] = $$('.chip[aria-pressed="true"]', host).map(function (x) { return x.textContent; });
        } else {
          $$('.chip', host).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
          b.setAttribute('aria-pressed', 'true');
          pick[key] = it.k;
        }
        calc();
      });
      host.appendChild(b);
    });
  }
  chips($('#bWhat'), WHAT, true, 'what');
  chips($('#bWhen'), WHEN, false, 'when');
  chips($('#bPain'), PAIN, true, 'pain');

  var priceEl = $('#bPrice'), termEl = $('#bTerm');
  function calc() {
    var base = 0, weeks = 0;
    pick.what.forEach(function (k) {
      var it = WHAT.find(function (x) { return x.k === k; });
      if (it) { base += it.p; weeks += it.w; }
    });
    var m = 1;
    if (pick.when) { var wn = WHEN.find(function (x) { return x.k === pick.when; }); if (wn) m = wn.m; }
    base = Math.round(base * m);
    base += pick.pain.length * 12;
    if (!base) { priceEl.textContent = '—'; termEl.textContent = 'срок ≈ —'; return; }
    var lo = Math.round(base * .88 / 10) * 10, hi = Math.round(base * 1.3 / 10) * 10;
    priceEl.textContent = lo + '–' + hi + ' тыс ₽';
    termEl.textContent = 'срок ≈ ' + Math.max(2, Math.round(weeks * .6)) + ' нед.';
  }
  calc();

  var s1 = $('#bs1'), s2 = $('#bs2'), sd = $('#bsDone');
  $('#bNext').addEventListener('click', function () {
    if (!pick.what.length) { K.toast('Отметьте хотя бы одну задачу'); return; }
    s1.classList.remove('is-on'); s2.classList.add('is-on');
  });
  $('#bBack').addEventListener('click', function () {
    s2.classList.remove('is-on'); s1.classList.add('is-on');
  });

  var agree = $('#bAgree');
  agree.addEventListener('click', function () {
    var on = agree.getAttribute('aria-pressed') === 'true';
    agree.setAttribute('aria-pressed', on ? 'false' : 'true');
  });

  function summary() {
    var L = [];
    L.push('Заявка в БАЗУ');
    L.push('Задача: ' + (pick.what.join(', ') || 'не выбрано'));
    if (pick.when) L.push('Старт: ' + pick.when);
    if (pick.pain.length) L.push('Больно сейчас: ' + pick.pain.join(', '));
    L.push('Ориентир: ' + priceEl.textContent + ', ' + termEl.textContent);
    var n = $('#fName').value.trim(), c = $('#fTo').value.trim(), m = $('#fMore').value.trim();
    if (n) L.push('Имя: ' + n);
    if (c) L.push('Связь: ' + c);
    if (m) L.push('Детали: ' + m);
    L.push('Источник: lllbaza.ru');
    return L.join('\n');
  }

  s2.addEventListener('submit', function (e) {
    e.preventDefault();
    var to = $('#fTo');
    if (!to.value.trim()) {
      to.closest('.field').classList.add('is-bad');
      to.focus();
      K.toast('Оставьте, куда вам ответить');
      return;
    }
    to.closest('.field').classList.remove('is-bad');
    if (agree.getAttribute('aria-pressed') !== 'true') {
      K.toast('Нужно согласие на обработку данных');
      return;
    }
    /* No backend in a single file: the brief is put on the clipboard and the
       Telegram thread is opened, so nothing the visitor typed is lost. */
    K.copy(summary(), 'Заявка скопирована — вставьте её в Telegram');
    s2.classList.remove('is-on'); sd.classList.add('is-on');
    Snd.clear();
    setTimeout(function () { W.open('https://t.me/lllbaza', '_blank', 'noopener'); }, 700);
  });

  $('#bFwd').addEventListener('click', function () {
    var t = [
      'Коротко, зачем это нам.',
      '',
      'Сейчас заявки приходят в несколько разных мест, отвечает человек, и скорость ответа зависит от его расписания. Часть обращений теряется, посчитать их невозможно.',
      '',
      'Что предлагается: ' + (pick.what.join(', ') || 'сайт и автоматизация') + '.',
      'Ориентир по бюджету: ' + (priceEl.textContent === '—' ? 'уточняется после разбора' : priceEl.textContent) + '.',
      'Срок: ' + termEl.textContent.replace('срок ≈ ', '') + '.',
      '',
      'Начинаем с разбора: это отдельная небольшая работа со своей ценой, её стоимость уходит в счёт проекта. По итогам разбора будет точная цифра, которая дальше не меняется.',
      '',
      'Подрядчик: БАЗА, lllbaza.ru'
    ].join('\n');
    K.copy(t, 'Текст для руководства скопирован');
  });
})();

})();
