/* ═══════════════════════════════════════════════════════════════════════════
   БАЗА — 21 · worlds 01–03
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var K = window.BAZA, $ = K.$, $$ = K.$$, D = document, W = window;
var Clock = K.Clock, clamp = K.clamp, rnd = K.rnd, Snd = K.Snd, RM = K.RM;

/* Pixel helper: paint an N×N sprite from a string map onto a canvas, one
   character per cell. Every block, coin and character in this world is drawn
   this way, so nothing here is an image request. */
function sprite(cv, map, pal, scale) {
  var rows = map, n = rows.length, m = rows[0].length;
  var s = scale || Math.floor(Math.min(cv.width / m, cv.height / n)) || 1;
  var ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cv.width, cv.height);
  var ox = Math.floor((cv.width - m * s) / 2), oy = Math.floor((cv.height - n * s) / 2);
  for (var y = 0; y < n; y++) for (var x = 0; x < m; x++) {
    var c = pal[rows[y][x]];
    if (!c) continue;
    ctx.fillStyle = c;
    ctx.fillRect(ox + x * s, oy + y * s, s, s);
  }
}

/* ═════════════════════════════════════════════════════ 01 · МИР 1-1 ══════ */
(function mario() {
  var sec = $('#pain'); if (!sec) return;
  var host = $('#mBlocks'), coinLayer = $('#mCoinLayer'), sum = $('#mSum');
  var coinsEl = $('#mCoins'), leakEl = $('#mLeak'), guy = $('#mGuy');

  var PAIN = [
    { k: 'Заявки теряются',    v: 78,  say: 'Пишут в Telegram, Avito, на почту и в директ. Часть сообщений вы находите через день, часть не находите вообще.' },
    { k: 'Сайт стыдно открыть', v: 64,  say: 'На встрече вы показываете презентацию, а не сайт. Клиент всё равно потом его откроет — и увидит позапрошлый сезон.' },
    { k: 'Клиенты не ждут',     v: 92,  say: 'Ответ через три часа — это уже отказ. Пока вы освободились, человек написал ещё двоим и купил у того, кто ответил первым.' },
    { k: 'Всё держится на вас', v: 120, say: 'Отпуск, болезнь, выходной — и продажи встают. Вы не владелец, вы точка отказа.' }
  ];

  /* ——— sprites, on the 16×16 grid the originals used ——— */
  var PAL = { '.': null, 'o': '#e39b1f', 'y': '#f8d548', 'd': '#8a5a12', 'k': '#0a0a0a', 'w': '#ffffff' };
  var QBLOCK = [
    'oooooooooooooooo','okkkkkkkkkkkkkko','okyyyyyyyyyyyyko','okyyyykkkkyyyyko',
    'okyyykkyyyykkyko','okyyykkyyyykkyko','okyyyyyyyykkyyko','okyyyyyykkyyyyko',
    'okyyyyykkyyyyyko','okyyyyykkyyyyyko','okyyyyyyyyyyyyko','okyyyyykkyyyyyko',
    'okyyyyykkyyyyyko','okyyyyyyyyyyyyko','okkkkkkkkkkkkkko','oooooooooooooooo'
  ];
  var UBLOCK = [
    'dddddddddddddddd','dkkkkkkkkkkkkkkd','dkddddddddddddkd','dkddddddddddddkd',
    'dkddddddddddddkd','dkddddddddddddkd','dkddddddddddddkd','dkddddddddddddkd',
    'dkddddddddddddkd','dkddddddddddddkd','dkddddddddddddkd','dkddddddddddddkd',
    'dkddddddddddddkd','dkddddddddddddkd','dkkkkkkkkkkkkkkd','dddddddddddddddd'
  ];
  var MPAL = { '.': null, 'r': '#d63b26', 'b': '#3a5bc7', 's': '#e8a86b', 'k': '#3a2410', 'y': '#f2d24b' };
  var GUY = [
    '.....rrrrr......','....rrrrrrrrr...','....kkksssk.....','...kskssskssk...',
    '...ksksssskssk..','...kkssssskkkk..','.....sssssss....','...rrbrrrrbrr...',
    '..rrrbrrrrbrrr..','..sssbbrrbbsss..','..sssbbbbbbsss..','..ssbbbbbbbbss..',
    '....bbbb.bbbb...','...kkkk...kkkk..','..kkkkk...kkkkk.','..kkkk.....kkkk.'
  ];

  /* ——— build the four blocks ——— */
  var hit = 0, coins = 0, leak = 0;
  PAIN.forEach(function (p, i) {
    var cell = D.createElement('div');
    cell.className = 'blkcell';
    cell.innerHTML =
      '<button class="blk" type="button" aria-label="Блок: ' + p.k + '">' +
        '<canvas width="128" height="128"></canvas>' +
      '</button>' +
      '<p class="blk__say"><b>' + p.k + '</b>' + p.say + '</p>';
    host.appendChild(cell);
    var b = cell.querySelector('.blk'), cv = cell.querySelector('canvas');
    sprite(cv, QBLOCK, PAL, 8);
    b.addEventListener('click', function () { bump(cell, b, cv, p); });
  });

  K.invite($$('.blk', host));

  function bump(cell, b, cv, p) {
    if (cell.classList.contains('is-done')) return;
    cell.classList.add('is-done');
    b.classList.add('is-hit');
    setTimeout(function () { b.classList.remove('is-hit'); }, 320);
    sprite(cv, UBLOCK, PAL, 8);
    Snd.bump(); setTimeout(function () { Snd.coin(); }, 60);

    /* Mario walks to the block he just took, then jumps at it. */
    walkTo(b);
    popCoin(b);

    hit++; coins++; leak += p.v;
    coinsEl.textContent = '×' + String(coins).padStart(2, '0');
    countTo(leakEl, leak);

    if (hit === PAIN.length) {
      setTimeout(function () {
        sum.classList.add('is-in');
        Snd.clear();
        setTimeout(function () { K.ensureVisible(sum); }, 260);
      }, 620);
    }
  }

  var shown = 0;
  function countTo(el, to) {
    var from = shown, t0 = performance.now(), dur = 620;
    (function step(t) {
      var p = clamp((t - t0) / dur, 0, 1);
      var v = Math.round(from + (to - from) * K.ease(p));
      el.textContent = v.toLocaleString('ru-RU') + ' тыс ₽/мес';
      if (p < 1) requestAnimationFrame(step); else shown = to;
    })(t0);
  }

  /* a coin on a real parabola, not a CSS keyframe that always looks the same */
  function popCoin(b) {
    var r = b.getBoundingClientRect(), hr = coinLayer.getBoundingClientRect();
    var el = D.createElement('canvas');
    el.width = el.height = 64;
    el.style.cssText = 'position:absolute;width:26px;height:26px;image-rendering:pixelated;will-change:transform';
    var pal = { '.': null, 'y': '#f8d548', 'o': '#e39b1f', 'k': '#8a5a12' };
    sprite(el, ['..oooo..','.oyyyyo.','oyykkyyo','oyk..kyo','oyk..kyo','oyykkyyo','.oyyyyo.','..oooo..'], pal, 8);
    coinLayer.appendChild(el);
    var x = r.left - hr.left + r.width / 2 - 13, y0 = r.top - hr.top;
    var t0 = performance.now(), V = 240, G = 900;
    (function step(t) {
      var s = (t - t0) / 1000;
      var dy = -V * s + .5 * G * s * s;
      el.style.transform = 'translate3d(' + x + 'px,' + (y0 + dy) + 'px,0) rotateY(' + (s * 900) + 'deg)';
      el.style.opacity = String(clamp(1 - (s - .35) / .35, 0, 1));
      if (s < .72) requestAnimationFrame(step); else el.remove();
    })(t0);
  }

  /* ——— Mario ——— */
  var guyC = $('#mGuyC');
  guyC.width = 128; guyC.height = 128;
  sprite(guyC, GUY, MPAL, 8);
  guy.style.left = '8%';
  function walkTo(b) {
    var r = b.getBoundingClientRect(), sr = sec.getBoundingClientRect();
    guy.style.left = (r.left - sr.left + r.width / 2 - 22) + 'px';
    if (RM) return;
    guy.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-86px)' }, { transform: 'translateY(0)' }],
      { duration: 560, easing: 'cubic-bezier(.3,.7,.4,1)' }
    );
    Snd.jump();
  }

  /* ——— ground + parallax scenery ——— */
  var gcv = $('#mGround');
  function paintGround() {
    var dpr = Math.min(W.devicePixelRatio || 1, 2);
    var r = gcv.getBoundingClientRect();
    gcv.width = Math.max(1, r.width * dpr | 0); gcv.height = Math.max(1, r.height * dpr | 0);
    var c = gcv.getContext('2d'); c.imageSmoothingEnabled = false;
    var s = Math.max(6, Math.round(gcv.height / 5));
    for (var y = 0; y < gcv.height; y += s) for (var x = 0; x < gcv.width; x += s) {
      var odd = ((x / s | 0) + (y / s | 0)) % 2;
      c.fillStyle = odd ? '#c9722a' : '#e08a3c';
      c.fillRect(x, y, s, s);
      c.fillStyle = 'rgba(0,0,0,.22)';
      c.fillRect(x, y + s - Math.max(1, s * .16), s, Math.max(1, s * .16));
      c.fillRect(x + s - Math.max(1, s * .16), y, Math.max(1, s * .16), s);
    }
  }
  paintGround();

  var scene = $('#marioScene');
  var CLOUD = ['..wwww......','.wwwwwww....','wwwwwwwwww..','.wwwwwwww...'];
  var HILL  = ['....gggg....','..gggggggg..','.gggggggggg.','gggggggggggg'];
  var props = [];
  /* Kept to the right of the text column: a pixel cloud drifting behind a
     headline reads as a rendering fault, not as weather. */
  [[54, 10, 120], [68, 26, 90], [80, 8, 140], [92, 20, 100]].forEach(function (p) {
    var e = D.createElement('canvas');
    e.className = 'mario__cloud'; e.width = 96; e.height = 32;
    e.style.setProperty('--l', p[0] + '%'); e.style.setProperty('--t', p[1] + '%');
    e.style.setProperty('--w', p[2] + 'px');
    sprite(e, CLOUD, { '.': null, 'w': '#ffffff' }, 8);
    scene.appendChild(e); props.push({ el: e, k: .06 + Math.random() * .05 });
  });
  [[4, 200], [58, 260], [86, 170]].forEach(function (p) {
    var e = D.createElement('canvas');
    e.className = 'mario__hill'; e.width = 96; e.height = 32;
    e.style.setProperty('--l', p[0] + '%'); e.style.setProperty('--w', p[1] + 'px');
    sprite(e, HILL, { '.': null, 'g': '#3aa03a' }, 8);
    scene.appendChild(e); props.push({ el: e, k: .13 + Math.random() * .04 });
  });

  var job = Clock.add(function (y) {
    var rel = y - sec.offsetTop;
    for (var i = 0; i < props.length; i++) {
      props[i].el.style.transform = 'translate3d(' + (-rel * props[i].k) + 'px,0,0)';
    }
  }, { resize: paintGround });
  Clock.bind(sec, job);
})();

/* ═════════════════════════════════════════════════════ 02 · МАТРИЦА ══════ */
(function matrix() {
  var sec = $('#truth'); if (!sec) return;
  var cv = $('#mxRain'), ctx = cv.getContext('2d');
  var GLYPH = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789БАЗА'.split('');
  var cols = [], size = 15, speed = 1;

  function reset() {
    var dpr = Math.min(W.devicePixelRatio || 1, 1.5);
    var r = cv.getBoundingClientRect();
    cv.width = Math.max(1, r.width * dpr | 0); cv.height = Math.max(1, r.height * dpr | 0);
    size = Math.max(12, Math.round(15 * dpr));
    var n = Math.ceil(cv.width / size);
    cols = [];
    for (var i = 0; i < n; i++) cols.push({ y: Math.random() * -cv.height, v: rnd(2, 7) });
  }
  reset();

  function frame() {
    /* The trail is a translucent wipe, not a per-glyph fade — one fill instead
       of thousands of alpha writes. */
    ctx.fillStyle = 'rgba(4,7,10,.09)';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.font = '700 ' + size + 'px "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      var g = GLYPH[Math.random() * GLYPH.length | 0];
      ctx.fillStyle = '#c9ffe0'; ctx.fillText(g, i * size, c.y);
      ctx.fillStyle = 'rgba(93,255,155,.62)'; ctx.fillText(g, i * size, c.y - size);
      c.y += c.v * speed * Clock.dt;
      if (c.y > cv.height + rnd(0, 400)) { c.y = rnd(-600, -20); c.v = rnd(2, 7); }
    }
  }
  if (!RM) {
    var job = Clock.add(frame, { resize: reset, onScroll: false, always: true });
    Clock.bind(sec, job, '20% 0px');
  }

  /* ——— the choice ——— */
  var blue = $('#pillBlue'), red = $('#pillRed'), typeEl = $('#mxType'), again = $('#mxAgain');

  if (!K.COARSE) {
    [blue, red].forEach(function (p) {
      p.addEventListener('pointermove', function (e) {
        var r = p.getBoundingClientRect();
        var dx = (e.clientX - r.left) / r.width - .5, dy = (e.clientY - r.top) / r.height - .5;
        p.style.transform = 'rotateY(' + (dx * 12) + 'deg) rotateX(' + (-dy * 12) + 'deg) translateY(-3px)';
      });
      p.addEventListener('pointerleave', function () { p.style.transform = ''; });
    });
  }

  K.invite([blue, red]);

  var TXT = 'Вкладка закрыта. Завтра в 9:40 первая заявка снова придёт в личку, и разбирать её будете вы.';
  blue.addEventListener('click', function () {
    sec.classList.remove('is-red'); sec.classList.add('is-blue');
    speed = .35;
    typeEl.textContent = '';
    var i = 0;
    (function step() {
      typeEl.textContent = TXT.slice(0, ++i);
      if (i < TXT.length) setTimeout(step, RM ? 0 : 26);
    })();
  });
  again.addEventListener('click', function () { red.click(); });

  red.addEventListener('click', function () {
    sec.classList.remove('is-blue'); sec.classList.add('is-red');
    speed = 2.2;
    setTimeout(function () { speed = 1.2; }, 900);
    K.watchReveals(sec);
  });

  /* ——— the funnel you draw yourself ——— */
  var QS = [
    { id: 'src',  q: 'Откуда падают заявки',            multi: 1, opts: ['Сайт', 'Instagram', 'Telegram', 'Avito', 'Звонки', 'Сарафан'] },
    { id: 'who',  q: 'Кто отвечает первым',             multi: 0, opts: ['Я сам', 'Менеджер', 'Как получится', 'Никто до вечера'] },
    { id: 'time', q: 'Через сколько человек получает ответ', multi: 0, opts: ['Минуты', 'Часы', 'На следующий день', 'Когда как'] },
    { id: 'log',  q: 'Где остаётся след',               multi: 0, opts: ['CRM', 'Таблица', 'В переписке', 'В голове'] }
  ];
  var pick = {};
  var qHost = $('#mxQs'), out = $('#mxOut'), flow = $('#mxFlow'), verdict = $('#mxVerdict');

  QS.forEach(function (q) {
    var wrap = D.createElement('div');
    wrap.className = 'mx__q';
    wrap.innerHTML = '<p>' + q.q + (q.multi ? ' <em>отметьте все</em>' : '') + '</p><div class="chips"></div>';
    var box = wrap.querySelector('.chips');
    q.opts.forEach(function (o) {
      var b = D.createElement('button');
      b.className = 'chip'; b.type = 'button'; b.textContent = o;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        Snd.click();
        if (q.multi) {
          var on = b.getAttribute('aria-pressed') === 'true';
          b.setAttribute('aria-pressed', on ? 'false' : 'true');
          pick[q.id] = $$('.chip[aria-pressed="true"]', box).map(function (x) { return x.textContent; });
        } else {
          $$('.chip', box).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
          b.setAttribute('aria-pressed', 'true');
          pick[q.id] = o;
        }
        render();
      });
      box.appendChild(b);
    });
    qHost.appendChild(wrap);
  });

  function render() {
    var src = pick.src && pick.src.length ? pick.src : null;
    if (!src || !pick.who || !pick.time || !pick.log) return;
    var first = !out.classList.contains('is-on');
    out.classList.add('is-on');
    if (first) setTimeout(function () { K.ensureVisible(out); }, 220);

    /* The leak is wherever the answer is worst — that is the node we mark. */
    var slowest = pick.time === 'Минуты' ? 0 : pick.time === 'Часы' ? 2 : 3;
    var lost = pick.log === 'CRM' ? 0 : pick.log === 'Таблица' ? 1 : 3;
    var thin = pick.who === 'Я сам' ? 3 : pick.who === 'Как получится' ? 3 : pick.who === 'Никто до вечера' ? 4 : 1;
    var worst = Math.max(slowest, lost, thin);
    var leakIdx = worst === thin ? 1 : worst === slowest ? 2 : 3;

    var nodes = [
      { k: 'источник',  v: src.join(', ') },
      { k: 'отвечает',  v: pick.who },
      { k: 'скорость',  v: pick.time },
      { k: 'след',      v: pick.log }
    ];
    flow.innerHTML = nodes.map(function (n, i) {
      return '<div class="mx__node' + (i === leakIdx ? ' mx__node--leak' : '') + '">' +
             '<u>' + (i === leakIdx ? 'здесь течёт' : n.k) + '</u><b>' + n.v + '</b></div>';
    }).join('');

    var say;
    if (leakIdx === 1) say = 'Узкое место — <b>кто отвечает</b>. Пока первым отвечает человек, скорость ответа равна его расписанию, а не спросу.';
    else if (leakIdx === 2) say = 'Узкое место — <b>скорость</b>. Заявка живёт минуты: за это время человек пишет ещё двоим и покупает у того, кто ответил первым.';
    else say = 'Узкое место — <b>след</b>. Если заявка живёт в переписке, её невозможно посчитать, а значит невозможно починить.';

    var many = src.length >= 3 ? ' Источников у вас ' + src.length + ' — и каждый ведёт в отдельное окно.' : '';
    verdict.innerHTML = say + many + ' Это не наша схема: вы её сейчас нарисовали сами, мы только записали.';
  }
})();

/* ═════════════════════════════════════════════════════ 03 · ВЕРСТАК ══════ */
(function craft() {
  var sec = $('#craft'); if (!sec) return;

  /* Ingredients are 8×8 pixel blocks, drawn from a palette per item. */
  var ITEM = {
    design: { n: 'Дизайн',      lore: 'то, ради чего остаются', c: ['#f0d24a', '#c9a520', '#8a6d0e'] },
    code:   { n: 'Код',         lore: 'то, из-за чего работает', c: ['#5fb0f2', '#2f7fc4', '#1a4f80'] },
    intg:   { n: 'Интеграции',  lore: 'то, что связывает всё',   c: ['#c96be8', '#8f3fb0', '#5c2273'] },
    data:   { n: 'Аналитика',   lore: 'то, что видно в цифрах',  c: ['#8ac44a', '#5e9430', '#38601c'] },
    bot:    { n: 'ИИ-бот',      lore: 'тот, кто не спит',        c: ['#f28b3c', '#c25e17', '#7d3a0a'] },
    copy:   { n: 'Текст',       lore: 'то, что читают',          c: ['#e8e0cf', '#b3ab99', '#7a7365'] },
    crm:    { n: 'CRM',         lore: 'то, где остаётся след',   c: ['#4ad6c0', '#219e8b', '#125e52'] },
    seo:    { n: 'Поиск',       lore: 'то, откуда приходят',     c: ['#e05c6e', '#a83345', '#6b1c28'] }
  };

  function blockCv(cv, item, s) {
    var c = ITEM[item].c;
    var ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    var u = Math.floor(cv.width / 8) || 1;
    for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) {
      /* a stable per-cell shade, so the block reads as a texture not as noise */
      var h = ((x * 7 + y * 13 + item.length * 5) % 5);
      ctx.fillStyle = h < 2 ? c[0] : h < 4 ? c[1] : c[2];
      ctx.fillRect(x * u, y * u, u, u);
    }
    /* bevel */
    ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(0, 0, cv.width, u);
    ctx.fillRect(0, 0, u, cv.height);
    ctx.fillStyle = 'rgba(0,0,0,.34)'; ctx.fillRect(0, cv.height - u, cv.width, u);
    ctx.fillRect(cv.width - u, 0, u, cv.height);
  }

  var RECIPES = [
    { id: 'site', out: 'design',
      grid: ['design', 'copy', 'design', 'code', 'design', 'code', 'seo', 'code', 'data'],
      n: 'Сайт, который продаёт',
      p: 'Не «сделать красиво», а собрать путь от первого экрана до заявки так, чтобы человек дошёл. Дизайн, тексты, код и аналитика — в одном рецепте.',
      meta: ['от <b>180</b> тыс ₽', 'срок <b>3–5 нед.</b>'],
      li: ['Первый экран, который не закрывают через 4 секунды',
           'Заявка уходит туда, где её видно, а не в личку',
           'Скорость загрузки, за которую не стыдно перед поиском',
           'Аналитика с первого дня: видно, что именно сработало'] },
    { id: 'crm', out: 'crm',
      grid: [null, 'intg', null, 'crm', 'crm', 'crm', 'data', 'intg', 'data'],
      n: 'CRM и автоматизация',
      p: 'Заявки перестают жить в переписке. Каждая падает в одно место, получает статус и напоминает о себе сама.',
      meta: ['от <b>140</b> тыс ₽', 'срок <b>2–4 нед.</b>'],
      li: ['Одно окно вместо шести мессенджеров',
           'Заявка не теряется, даже если все заняты',
           'Понятно, сколько стоит клиент и откуда он пришёл',
           'Менеджер перестаёт быть архивом компании'] },
    { id: 'bot', out: 'bot',
      grid: ['bot', 'bot', 'bot', 'intg', 'code', 'intg', null, 'crm', null],
      n: 'ИИ-бот',
      p: 'Отвечает быстрее вас и не устаёт к пятнице. Запись, цены, статус заказа, типовые вопросы — всё это перестаёт быть вашей работой.',
      meta: ['от <b>90</b> тыс ₽', 'срок <b>2–3 нед.</b>'],
      li: ['Ответ за секунды в любое время суток',
           'Записывает, переносит и напоминает сам',
           'Передаёт человеку только то, что правда требует человека',
           'Учится на ваших же переписках, а не на общих фразах'] },
    { id: 'grow', out: 'data',
      grid: ['data', 'seo', 'data', 'copy', 'design', 'copy', 'data', 'seo', 'data'],
      n: 'Рост и сопровождение',
      p: 'Когда сайт уже работает, узкое место переезжает. Мы смотрим на цифры раз в месяц и двигаем то, что реально мешает.',
      meta: ['от <b>45</b> тыс ₽/мес', 'горизонт <b>от 3 мес.</b>'],
      li: ['Гипотезы из данных, а не из вкусов',
           'Правки без ожидания «свободного разработчика»',
           'Отчёт на языке денег, а не показов',
           'Плохие новости приходят первыми'] }
  ];

  var gridHost = $('#benchGrid'), outSlot = $('#benchOut'), hint = $('#benchHint');
  var hotbar = $('#hotbar'), outHost = $('#craftOut');

  var slots = [];
  for (var i = 0; i < 9; i++) {
    var s = D.createElement('div');
    s.className = 'slot';
    s.innerHTML = '<canvas width="48" height="48"></canvas>';
    gridHost.appendChild(s);
    slots.push(s);
  }

  /* tooltip: Minecraft's own, not a generic bubble */
  var tip = D.createElement('div');
  tip.className = 'mctip'; D.body.appendChild(tip);
  function showTip(e, item) {
    var it = ITEM[item]; if (!it) return;
    tip.innerHTML = it.n + '<i>' + it.lore + '</i>';
    tip.classList.add('is-on');
    var x = e.clientX + 14, y = e.clientY + 16;
    if (x + 250 > W.innerWidth) x = W.innerWidth - 250;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { tip.classList.remove('is-on'); }

  var cards = {};
  RECIPES.forEach(function (r, ri) {
    var b = D.createElement('button');
    b.className = 'hot'; b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', r.n);
    b.innerHTML = '<canvas width="48" height="48"></canvas>';
    blockCv(b.querySelector('canvas'), r.out);
    hotbar.appendChild(b);
    if (!K.COARSE) {
      b.addEventListener('pointermove', function (e) { showTip(e, r.out); });
      b.addEventListener('pointerleave', hideTip);
    }
    b.addEventListener('click', function () { pickRecipe(ri); });

    var card = D.createElement('div');
    card.className = 'craft__card';
    card.innerHTML =
      '<h3>' + r.n + '</h3><p>' + r.p + '</p>' +
      '<div class="craft__meta">' + r.meta.map(function (m) { return '<span>' + m + '</span>'; }).join('') + '</div>' +
      '<ul class="craft__list">' + r.li.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>';
    outHost.appendChild(card);
    cards[ri] = card;
  });

  var timers = [];
  /* Set the moment someone picks from the shelf. The first recipe is laid out
     on load and must not scroll the page out from under anybody. */
  var touched = false;

  function pickRecipe(ri) {
    timers.forEach(clearTimeout); timers = [];
    var r = RECIPES[ri];
    $$('.hot', hotbar).forEach(function (h, i) { h.setAttribute('aria-pressed', i === ri ? 'true' : 'false'); });
    Object.keys(cards).forEach(function (k) { cards[k].classList.toggle('is-on', +k === ri); });
    hint.textContent = 'рецепт: ' + r.n.toLowerCase();

    slots.forEach(function (s) { s.classList.remove('is-on'); });
    outSlot.classList.remove('is-on');

    /* Ingredients land one at a time — a crafting grid that fills instantly
       reads as a static picture. */
    r.grid.forEach(function (item, i) {
      if (!item) return;
      timers.push(setTimeout(function () {
        blockCv(slots[i].querySelector('canvas'), item);
        slots[i].classList.add('is-on');
        Snd.click();
      }, 60 + i * 55));
    });
    timers.push(setTimeout(function () {
      blockCv(outSlot.querySelector('canvas'), r.out);
      outSlot.classList.add('is-on');
      Snd.craft();
      /* `cards[ri]`, not the loop-local `card`: `var` is function-scoped, so
         that name resolves to the last recipe built, never the picked one. */
      if (touched) K.ensureVisible(cards[ri], 12);
    }, 60 + 9 * 55 + 120));
  }
  pickRecipe(0);
  K.invite($$('.hot', hotbar), 1);
  $$('.hot', hotbar).forEach(function (h) {
    h.addEventListener('click', function () { touched = true; }, true);
  });

  /* ——— the terrain silhouette behind it ——— */
  var bg = $('#craftBg');
  function paintBg() {
    var dpr = Math.min(W.devicePixelRatio || 1, 1.5);
    var r = bg.getBoundingClientRect();
    bg.width = Math.max(1, r.width * dpr | 0); bg.height = Math.max(1, r.height * dpr | 0);
    var c = bg.getContext('2d');
    var u = Math.max(10, Math.round(bg.width / 90));
    c.clearRect(0, 0, bg.width, bg.height);
    [[.10, '#1b2416'], [.055, '#232b1c']].forEach(function (layer, li) {
      c.fillStyle = layer[1];
      var cols = Math.ceil(bg.width / u), h = bg.height;
      var seed = li * 137;
      for (var x = 0; x < cols; x++) {
        var n = Math.sin((x + seed) * .31) * .5 + Math.sin((x + seed) * .11) * .5;
        var top = h - (h * (.16 + li * .07) + n * h * .06);
        c.fillRect(x * u, Math.round(top / u) * u, u, h);
      }
    });
  }
  paintBg();
  var job = Clock.add(function () {}, { resize: paintBg, onScroll: false });
  Clock.bind(sec, job);
})();

})();
