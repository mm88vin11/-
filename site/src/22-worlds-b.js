/* ═══════════════════════════════════════════════════════════════════════════
   БАЗА — 22 · worlds 04–06
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var K = window.BAZA, $ = K.$, $$ = K.$$, D = document, W = window;
var Clock = K.Clock, clamp = K.clamp, lerp = K.lerp, rnd = K.rnd, Snd = K.Snd, RM = K.RM;

/* ═════════════════════════════════════════════════════ 04 · ЛЕНТА ════════ */
(function tok() {
  var sec = $('#cases'); if (!sec) return;
  var feed = $('#feed'), bars = $('#feedBars'), rail = $('#feedRail');
  var dots = $('#tokDots'), sound = $('#feedSound');

  var CASES = [
    { tag: 'Бренд одежды · сайт', num: '×2,4', unit: 'заявок в месяц',
      ttl: 'Сайт, который не догнать', note: 'Партнёры пишут сами и спрашивают, кто делал дизайн.',
      likes: '12,4K', c: ['#1a1a2e', '#3d2b56', '#7a3f7a'] },
    { tag: 'Оптовые продажи · сайт и CRM', num: '×3', unit: 'к прошлому месяцу',
      ttl: 'Месяц после запуска = три прошлых', note: 'Заявка из формы сразу уходит в CRM и не ждёт человека.',
      likes: '9,1K', c: ['#0f2027', '#203a43', '#2c5364'] },
    { tag: 'Рекламное агентство · сайт', num: '+68%', unit: 'дошли до заявки',
      ttl: 'Ссылку теперь скидывают первыми', note: 'Раньше вкладку закрывали прямо на встрече с клиентом.',
      likes: '7,8K', c: ['#2b1a0f', '#5c3a1e', '#a05c22'] },
    { tag: 'Сеть барбершопов · ИИ-бот', num: '9 сек', unit: 'среднее время ответа',
      ttl: 'Отвечает быстрее владельца', note: 'Запись, перенос, цены — без администратора на телефоне.',
      likes: '15,2K', c: ['#101820', '#1f3b2c', '#3f6b4a'] },
    { tag: 'Сервис доставки · приложение', num: '×2', unit: 'повторных заказов',
      ttl: 'Возвращаются без рассылок', note: 'Ни push-спама, ни скидок. Просто удобно, поэтому возвращаются.',
      likes: '11,0K', c: ['#1b1024', '#3a1b4a', '#6b2d5c'] }
  ];

  /* Card art is generated: a soft three-stop field with a drifting grid, so
     five cards look like five places without five photographs. */
  function paintArt(cv, cs, seed) {
    var dpr = Math.min(W.devicePixelRatio || 1, 2);
    var r = cv.getBoundingClientRect();
    var w = Math.max(1, r.width * dpr | 0), h = Math.max(1, r.height * dpr | 0);
    if (!w || !h) return;
    cv.width = w; cv.height = h;
    var c = cv.getContext('2d');
    var g = c.createLinearGradient(0, 0, w * .3, h);
    g.addColorStop(0, cs[0]); g.addColorStop(.55, cs[1]); g.addColorStop(1, cs[2]);
    c.fillStyle = g; c.fillRect(0, 0, w, h);

    var rg = c.createRadialGradient(w * .7, h * .26, 0, w * .7, h * .26, w * .9);
    rg.addColorStop(0, 'rgba(255,255,255,.16)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = rg; c.fillRect(0, 0, w, h);

    c.strokeStyle = 'rgba(255,255,255,.055)'; c.lineWidth = dpr;
    var step = w / 7;
    for (var i = 1; i < 14; i++) {
      c.beginPath();
      var off = Math.sin(i * 1.7 + seed) * step * .34;
      c.moveTo(i * step + off, -20); c.lineTo(i * step - off, h + 20); c.stroke();
    }
    c.fillStyle = 'rgba(0,0,0,.2)';
    c.fillRect(0, h * .62, w, h * .38);
  }

  var arts = [];
  CASES.forEach(function (cs, i) {
    var card = D.createElement('article');
    card.className = 'card';
    card.innerHTML =
      '<div class="card__art"><canvas></canvas></div>' +
      '<p class="card__tag">' + cs.tag + '</p>' +
      '<p class="card__num">' + cs.num + ' <small>' + cs.unit + '</small></p>' +
      '<h3 class="card__ttl">' + cs.ttl + '</h3>' +
      '<p class="card__note">' + cs.note + '</p>' +
      '<p class="card__by"><i>Б</i>@baza · запущено</p>';
    feed.appendChild(card);
    arts.push({ cv: card.querySelector('canvas'), c: cs.c, s: i * 2.3 });

    var b = D.createElement('i'); bars.appendChild(b);

    var dot = D.createElement('button');
    dot.className = 'tok__dot'; dot.type = 'button'; dot.setAttribute('role', 'tab');
    dot.innerHTML = '<u>' + String(i + 1).padStart(2, '0') + '</u><b>' + cs.ttl + '</b>';
    dot.addEventListener('click', function () {
      feed.scrollTo({ top: card.offsetTop, behavior: RM ? 'auto' : 'smooth' });
    });
    dots.appendChild(dot);
  });

  rail.innerHTML =
    '<button type="button" aria-label="Нравится"><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9A5.4 5.4 0 0 1 12 6.6 5.4 5.4 0 0 1 21.6 12c-2.1 4.4-9.6 9-9.6 9z"/></svg><span id="tokLikes">12,4K</span></button>' +
    '<button type="button" aria-label="Комментарии"><svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c5 0 9 3.3 9 7.4 0 4.1-4 7.4-9 7.4-.9 0-1.8-.1-2.6-.3L4 20l1.2-3.4C3.2 15.2 3 13 3 10.4 3 6.3 7 3 12 3z"/></svg><span>318</span></button>' +
    '<button type="button" aria-label="Поделиться"><svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor"><path d="M14 3v4C7.5 7.6 4.4 12 3 20c2.6-4.4 6-6.2 11-6.2V18l7-7.5z"/></svg><span>1 204</span></button>';
  var likeBtn = rail.querySelector('button');
  likeBtn.addEventListener('click', function () {
    likeBtn.classList.toggle('is-liked');
    Snd.click();
  });

  function setActive(i) {
    $$('i', bars).forEach(function (b, k) { b.classList.toggle('is-on', k <= i); });
    $$('.tok__dot', dots).forEach(function (d, k) { d.classList.toggle('is-on', k === i); });
    $('#tokLikes').textContent = CASES[i].likes;
    sound.textContent = 'оригинальный звук · ' + CASES[i].tag + ' · БАЗА';
  }
  setActive(0);

  var cur = 0;
  feed.addEventListener('scroll', function () {
    var h = feed.clientHeight || 1;
    var i = clamp(Math.round(feed.scrollTop / h), 0, CASES.length - 1);
    if (i !== cur) { cur = i; setActive(i); }
  }, { passive: true });

  feed.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    var h = feed.clientHeight;
    feed.scrollTo({ top: (cur + (e.key === 'ArrowDown' ? 1 : -1)) * h, behavior: 'smooth' });
  });

  function repaint() { arts.forEach(function (a) { paintArt(a.cv, a.c, a.s); }); }
  var job = Clock.add(function () {}, { resize: repaint, onScroll: false });
  Clock.bind(sec, job);
  /* first paint once the phone actually has a size */
  requestAnimationFrame(function () { requestAnimationFrame(repaint); });
})();

/* ═════════════════════════════════════════════════════ 05 · ЦЕНА ═════════ */
(function tetris() {
  var sec = $('#pricing'); if (!sec) return;
  var cv = $('#ttC'), ctx = cv.getContext('2d');
  var flash = $('#ttFlash');
  var COLS = 10, ROWS = 17;

  /* Each scope item is a real tetromino. Adding it drops the piece; the height
     of the stack is the estimate, so the price is something you build rather
     than something a slider reports. */
  var SCOPE = [
    { id: 'design', n: 'Дизайн и прототип',   d: 'Экраны, состояния, адаптив',            p: 60,  w: 8,  c: '#f0d24a', sh: [[0,0],[1,0],[0,1],[1,1]] },
    { id: 'front',  n: 'Вёрстка и анимация',  d: 'Живые интерфейсы, не картинка',         p: 55,  w: 7,  c: '#5fb0f2', sh: [[0,0],[0,1],[0,2],[1,2]] },
    { id: 'cms',    n: 'Админка',             d: 'Чтобы править без нас',                 p: 35,  w: 5,  c: '#c96be8', sh: [[0,0],[1,0],[2,0],[1,1]] },
    { id: 'intg',   n: 'Интеграции и CRM',    d: 'Заявка уходит туда, где её видно',      p: 45,  w: 6,  c: '#4ad6c0', sh: [[0,0],[1,0],[1,1],[2,1]] },
    { id: 'bot',    n: 'ИИ-бот',              d: 'Отвечает, пока вы спите',               p: 70,  w: 8,  c: '#f28b3c', sh: [[0,0],[0,1],[0,2],[0,3]] },
    { id: 'copy',   n: 'Тексты и смыслы',     d: 'То, что читают, а не пролистывают',     p: 30,  w: 4,  c: '#e8e0cf', sh: [[0,0],[1,0],[2,0],[0,1]] },
    { id: 'seo',    n: 'Поиск и скорость',    d: 'Чтобы приходили без рекламы',           p: 40,  w: 5,  c: '#e05c6e', sh: [[1,0],[2,0],[0,1],[1,1]] },
    { id: 'data',   n: 'Аналитика',           d: 'Видно, что именно сработало',           p: 25,  w: 3,  c: '#8ac44a', sh: [[0,0],[1,0],[2,0]] }
  ];

  var grid = [], on = {};
  for (var r = 0; r < ROWS; r++) { grid.push(new Array(COLS).fill(null)); }

  function size() {
    var dpr = Math.min(W.devicePixelRatio || 1, 2);
    var b = cv.getBoundingClientRect();
    cv.width = Math.max(1, b.width * dpr | 0);
    cv.height = Math.max(1, b.height * dpr | 0);
    paint();
  }

  var falling = null;
  function paint() {
    var w = cv.width, h = cv.height;
    var u = Math.min(w / COLS, h / ROWS);
    var ox = (w - u * COLS) / 2, oy = (h - u * ROWS) / 2;
    ctx.clearRect(0, 0, w, h);

    /* the well's own faint lattice */
    ctx.strokeStyle = 'rgba(242,235,221,.055)'; ctx.lineWidth = 1;
    for (var x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(ox + x * u, oy); ctx.lineTo(ox + x * u, oy + ROWS * u); ctx.stroke(); }
    for (var y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(ox, oy + y * u); ctx.lineTo(ox + COLS * u, oy + y * u); ctx.stroke(); }

    function cellAt(cx, cy, col) {
      var px = ox + cx * u, py = oy + cy * u;
      ctx.fillStyle = col; ctx.fillRect(px, py, u, u);
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(px, py, u, u * .16);
      ctx.fillRect(px, py, u * .16, u);
      ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.fillRect(px, py + u * .84, u, u * .16);
      ctx.fillRect(px + u * .84, py, u * .16, u);
    }
    for (var yy = 0; yy < ROWS; yy++) for (var xx = 0; xx < COLS; xx++) {
      if (grid[yy][xx]) cellAt(xx, yy, grid[yy][xx]);
    }
    if (falling) {
      falling.cells.forEach(function (c) {
        var cy = c[1] + falling.y;
        if (cy >= 0 && cy < ROWS) cellAt(c[0] + falling.x, cy, falling.c);
      });
    }
  }

  /* place a shape at the lowest legal row in a chosen column */
  function place(item) {
    var sh = item.sh;
    var wdt = Math.max.apply(null, sh.map(function (c) { return c[0]; })) + 1;
    var best = null;
    for (var col = 0; col + wdt <= COLS; col++) {
      var top = fitRow(sh, col);
      if (top === null) continue;
      if (!best || top > best.top) best = { col: col, top: top };
    }
    if (!best) return null;
    return { x: best.col, y: best.top, cells: sh, c: item.c, id: item.id };
  }
  function fitRow(sh, col) {
    var lastOK = null;
    for (var row = 0; row < ROWS; row++) {
      var ok = true;
      for (var i = 0; i < sh.length; i++) {
        var cx = sh[i][0] + col, cy = sh[i][1] + row;
        if (cy >= ROWS || cx >= COLS || (cy >= 0 && grid[cy][cx])) { ok = false; break; }
      }
      if (ok) lastOK = row; else break;
    }
    return lastOK;
  }

  var score = 0, lines = 0;
  function drop(item, cb) {
    var p = place(item);
    if (!p) { cb && cb(); return; }
    var target = p.y;
    falling = { x: p.x, y: -4, cells: p.cells, c: p.c, id: p.id };
    var t0 = performance.now(), dur = RM ? 1 : 340;
    (function step(t) {
      var k = clamp((t - t0) / dur, 0, 1);
      falling.y = Math.round(lerp(-4, target, k * k));
      paint();
      if (k < 1) requestAnimationFrame(step);
      else {
        p.cells.forEach(function (c) {
          var cy = c[1] + target;
          if (cy >= 0) grid[cy][c[0] + p.x] = p.c;
        });
        falling = null;
        Snd.lock();
        clearLines();
        paint();
        cb && cb();
      }
    })(t0);
  }

  function clearLines() {
    var full = [];
    for (var y = 0; y < ROWS; y++) if (grid[y].every(function (c) { return !!c; })) full.push(y);
    if (!full.length) return;
    full.forEach(function (y) { grid.splice(y, 1); grid.unshift(new Array(COLS).fill(null)); });
    lines += full.length;
    score += full.length * 100;
    flash.classList.add('is-on');
    setTimeout(function () { flash.classList.remove('is-on'); }, 360);
    Snd.clear();
  }

  /* Adding a line of scope drops that one piece. Removing rebuilds the stack
     instantly and silently — re-animating every piece on every toggle turned
     the well into a slot machine and hid what the click actually did. */
  function settle(item) {
    var p = place(item);
    if (!p) return;
    p.cells.forEach(function (c) {
      var cy = c[1] + p.y;
      if (cy >= 0) grid[cy][c[0] + p.x] = p.c;
    });
  }
  function rebuild(added) {
    if (added) { drop(added); return; }
    grid = [];
    for (var r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(null));
    lines = 0;
    SCOPE.forEach(function (s) { if (on[s.id]) settle(s); });
    clearLines();
    paint();
  }

  /* ——— the scope rows ——— */
  var host = $('#ttScope');
  SCOPE.forEach(function (s) {
    var b = D.createElement('button');
    b.className = 'scope'; b.type = 'button'; b.setAttribute('aria-pressed', 'false');
    b.style.setProperty('--pc', s.c);
    b.innerHTML = '<span class="scope__box"></span>' +
      '<span><b>' + s.n + '</b><span>' + s.d + '</span></span>' +
      '<u>+' + s.p + ' тыс</u>';
    b.addEventListener('click', function () {
      on[s.id] = !on[s.id];
      b.setAttribute('aria-pressed', on[s.id] ? 'true' : 'false');
      Snd.click();
      rebuild(on[s.id] ? s : null);
      readout();
    });
    host.appendChild(b);
  });

  var priceEl = $('#ttPrice'), termEl = $('#ttTerm'), teamEl = $('#ttTeam'), sayEl = $('#ttSay');
  var scoreEl = $('#ttScore'), linesEl = $('#ttLines'), levelEl = $('#ttLevel');
  var shownPrice = 0;

  function readout() {
    var picked = SCOPE.filter(function (s) { return on[s.id]; });
    var base = picked.reduce(function (a, s) { return a + s.p; }, 0);
    var weeks = picked.reduce(function (a, s) { return a + s.w; }, 0);
    /* work overlaps: three tracks in parallel, not three tracks end to end */
    weeks = picked.length ? Math.max(2, Math.round(weeks * .45)) : 0;
    var lo = Math.round(base * .9), hi = Math.round(base * 1.28);

    animate(shownPrice, lo, function (v) {
      priceEl.textContent = picked.length ? v + '–' + Math.round(v * 1.42) : '0';
    });
    shownPrice = lo;

    termEl.textContent = picked.length ? '≈ ' + weeks + ' нед.' : '—';
    teamEl.textContent = picked.length ? Math.min(5, Math.max(2, Math.ceil(picked.length / 2) + 1)) + ' чел.' : '—';

    score = Math.max(score, base * 10);
    scoreEl.textContent = String(score).padStart(6, '0');
    linesEl.textContent = String(lines);
    levelEl.textContent = String(1 + Math.floor(picked.length / 3));

    if (!picked.length) sayEl.textContent = 'Ничего не выбрано. Включите хотя бы одну работу — стакан начнёт заполняться.';
    else if (base < 90) sayEl.textContent = 'Нижняя граница: проверенные решения и готовые механики. Работать будет. Запоминаться — не обязано.';
    else if (base < 220) sayEl.textContent = 'Рабочая середина — сюда мы и советуем ставить ручку. Хватает и на смысл, и на исполнение.';
    else sayEl.textContent = 'Верх вилки: уникальная механика, съёмка, сложные интеграции. Берём такое, когда есть за счёт чего окупить.';
    if (hi) sayEl.textContent += ' Вилка ' + lo + '–' + hi + ' тыс ₽; точную цифру называем после разбора, и дальше она не меняется.';
  }

  function animate(from, to, set) {
    var t0 = performance.now(), dur = RM ? 1 : 460;
    (function step(t) {
      var k = clamp((t - t0) / dur, 0, 1);
      set(Math.round(lerp(from, to, K.ease(k))));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  var job = Clock.add(function () {}, { resize: size, onScroll: false });
  Clock.bind(sec, job);
  size(); readout();

  /* Start with the two most-asked-for rows already in, so the well is never
     an empty box waiting to be understood. */
  var seeded = false;
  if ('IntersectionObserver' in W) {
    new IntersectionObserver(function (es, o) {
      if (!es[0].isIntersecting || seeded) return;
      seeded = true; o.disconnect();
      ['design', 'front'].forEach(function (id, i) {
        setTimeout(function () { $$('.scope', host)[SCOPE.findIndex(function (s) { return s.id === id; })].click(); }, 240 + i * 420);
      });
    }, { threshold: .3 }).observe(sec);
  }
})();

/* ═════════════════════════════════════════════════════ 06 · МАРШРУТ ══════ */
(function flux() {
  var sec = $('#route'); if (!sec) return;

  var MON = ['ЯНВ','ФЕВ','МАР','АПР','МАЙ','ИЮН','ИЮЛ','АВГ','СЕН','ОКТ','НОЯ','ДЕК'];

  /* The dates are real. "Three weeks" is a claim; a date you can put in a
     calendar is a commitment, and the panel is the place to show it. */
  var now = new Date();
  var dest = new Date(now.getTime() + 21 * 864e5);
  var last = new Date(now.getTime() - 96 * 864e5);

  function cells(host, d, withTime) {
    host.innerHTML = '';
    function group(label, text) {
      var g = D.createElement('div'); g.className = 'cellg';
      var c = D.createElement('div'); c.className = 'cell';
      String(text).split('').forEach(function (ch) {
        var b = D.createElement('b'); b.textContent = ch; c.appendChild(b);
      });
      var u = D.createElement('u'); u.textContent = label;
      g.appendChild(c); g.appendChild(u); host.appendChild(g);
    }
    group('месяц', MON[d.getMonth()]);
    group('день', String(d.getDate()).padStart(2, '0'));
    group('год', String(d.getFullYear()));
    if (withTime) group('время', String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
  }
  cells($('#circDest'), dest, false);
  cells($('#circNow'), now, true);
  cells($('#circLast'), last, false);

  setInterval(function () { cells($('#circNow'), new Date(), true); }, 30000);

  /* ——— the speedometer ——— */
  var sp = $('#speedo'), spv = $('#speedoV'), say = $('#fluxSay');
  var mph = 0, target = 0, hit88 = false;

  function drawSpeedo() {
    var c = sp.getContext('2d'), w = sp.width, h = sp.height;
    c.clearRect(0, 0, w, h);
    var cx = w / 2, cy = h * .86, R = Math.min(w * .44, h * .78);
    var A0 = Math.PI * 1.02, A1 = Math.PI * 1.98;

    c.lineWidth = 10; c.lineCap = 'round';
    c.strokeStyle = 'rgba(242,235,221,.13)';
    c.beginPath(); c.arc(cx, cy, R, A0, A1); c.stroke();

    var p = clamp(mph / 88, 0, 1);
    var grd = c.createLinearGradient(cx - R, 0, cx + R, 0);
    grd.addColorStop(0, '#ffb020'); grd.addColorStop(1, '#ff3b30');
    c.strokeStyle = grd;
    c.beginPath(); c.arc(cx, cy, R, A0, A0 + (A1 - A0) * p); c.stroke();

    /* ticks, with 88 called out because that is the only number that matters */
    for (var i = 0; i <= 8; i++) {
      var a = A0 + (A1 - A0) * (i / 8);
      var r0 = R - 16, r1 = R - 8;
      c.strokeStyle = i === 8 ? '#ff3b30' : 'rgba(242,235,221,.32)';
      c.lineWidth = i === 8 ? 3 : 2;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      c.stroke();
    }
    var na = A0 + (A1 - A0) * p;
    c.strokeStyle = '#f2ebdd'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(na) * (R - 22), cy + Math.sin(na) * (R - 22)); c.stroke();
    c.fillStyle = '#f2ebdd'; c.beginPath(); c.arc(cx, cy, 5, 0, 7); c.fill();
  }

  /* ——— the road behind ——— */
  var road = $('#fluxRoad'), rctx = road.getContext('2d'), roff = 0;
  function sizeRoad() {
    var dpr = Math.min(W.devicePixelRatio || 1, 1.5);
    var r = road.getBoundingClientRect();
    road.width = Math.max(1, r.width * dpr | 0); road.height = Math.max(1, r.height * dpr | 0);
  }
  function drawRoad() {
    var w = road.width, h = road.height;
    rctx.clearRect(0, 0, w, h);
    var hz = h * .34;
    var g = rctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,138,31,.10)'); g.addColorStop(.34, 'rgba(255,59,48,.05)'); g.addColorStop(1, 'rgba(7,8,13,0)');
    rctx.fillStyle = g; rctx.fillRect(0, 0, w, h);

    rctx.strokeStyle = 'rgba(255,138,31,' + (.08 + .16 * clamp(mph / 88, 0, 1)) + ')';
    rctx.lineWidth = Math.max(1, w / 900);
    var cx = w / 2;
    for (var i = -9; i <= 9; i++) {
      rctx.beginPath(); rctx.moveTo(cx + i * (w * .022), hz); rctx.lineTo(cx + i * (w * .34), h); rctx.stroke();
    }
    for (var j = 0; j < 16; j++) {
      var t = ((j / 16) + roff) % 1;
      var y = hz + (h - hz) * (t * t);
      rctx.beginPath(); rctx.moveTo(0, y); rctx.lineTo(w, y); rctx.stroke();
    }
  }
  sizeRoad();

  var stages = $('#stages');
  var STAGES = [
    { w: 'неделя 1', d: 0, h: 'Вы узнаёте, где теряете деньги',
      p: 'Не спрашиваем «какой сайт хотите». Считаем, сколько заявок не доходит, сколько часов уходит на ручную работу и во что это обходится в месяц. Цифру называем до старта.' },
    { w: 'недели 2–4', d: 7, h: 'Каждую пятницу видно, что изменилось',
      p: 'Не отчёт о процессе, а работающая версия, которую можно открыть и потыкать. Если что-то не то, вы говорите это на второй неделе, а не на сдаче.' },
    { w: 'дальше', d: 21, h: 'Вы перестаёте быть точкой отказа',
      p: 'Запускаем, обучаем вашу команду, месяц держим руку на пульсе. Если через месяц вы всё ещё разбираете заявки руками — мы плохо сделали работу.' }
  ];
  STAGES.forEach(function (s) {
    var d = new Date(now.getTime() + s.d * 864e5);
    var el = D.createElement('article');
    el.className = 'stage';
    el.innerHTML = '<p class="stage__when">' + s.w + '<b>' +
      String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '</b></p>' +
      '<h3>' + s.h + '</h3><p>' + s.p + '</p>';
    stages.appendChild(el);
  });

  var job = Clock.add(function (y) {
    var top = sec.offsetTop, run = sec.offsetHeight * .55;
    var p = clamp((y + W.innerHeight * .8 - top) / Math.max(1, run), 0, 1);
    target = p * 88;
    mph = lerp(mph, target, RM ? 1 : .09);
    if (mph > 87.4) mph = 88;
    spv.textContent = String(Math.round(mph));
    drawSpeedo();
    roff = (roff + .004 + .02 * (mph / 88)) % 1;
    drawRoad();

    if (!hit88 && mph >= 87.5) {
      hit88 = true;
      sec.classList.add('is-88');
      say.innerHTML = 'Скорость набрана. Вы прибыли в <b>' +
        String(dest.getDate()).padStart(2, '0') + ' ' + MON[dest.getMonth()].toLowerCase() + '</b> — маршрут ниже.';
      Snd.flux();
    }
  }, { resize: function () { sizeRoad(); drawRoad(); }, always: true, onScroll: false });
  Clock.bind(sec, job, '40% 0px');
  drawSpeedo(); drawRoad();
})();

})();
