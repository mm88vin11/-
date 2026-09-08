/* ==========================================================================
   БАЗА — hero: scroll-driven laptop reel.

   Три вещи, из-за которых прошлая версия дёргалась, и что сделано:

   1. Кадры из data: URI оседали как HTMLImageElement — каждый drawImage мог
      тянуть повторный декод. Теперь всё, включая data:, проходит через
      createImageBitmap: декод один раз, дальше готовый к GPU битмап.

   2. draw() округлял индекс — 182 дискретные ступеньки, между ними ничего.
      Теперь рисуются два соседних кадра, верхний с alpha = дробной части.
      Движение непрерывное независимо от того, сколько кадров в исходнике.

   3. Рантайм был короче, чем нужно кадрам: ~10 px скролла на кадр, один
      щелчок колеса перепрыгивал десяток. Полоса длиннее, плюс ведение с
      учётом скорости — быстрый флик догоняется цепко, медленный тянется.

   И отдельно про резкость: исходник 1600×901. Растягивать его на 2560
   значит гарантированно получить мыло. Кадр рисуется не крупнее натуральной
   величины, а поле вокруг заливается той же плашкой, что и фон самого кадра,
   так что границы не видно, а пиксель остаётся пикселем.
   ========================================================================== */
(function (w, d) {
  'use strict';
  var B = w.BAZA;

  var SETS = {
    land: { dir: 'assets/seq/d/', n: 182, w: 1600, h: 901 },
    port: { dir: 'assets/seq/m/', n: 104, w: 810, h: 1438 }
  };

  function pickSet() {
    return (w.innerHeight > w.innerWidth * 1.06 || w.innerWidth < 700) ? 'port' : 'land';
  }

  var setKey = pickSet();
  var set = SETS[setKey];
  var TOTAL = set.n;

  /* Ждём не первые N кадров, а разброс по всей ленте: тогда обещание честное
     — куда бы человек ни бросил скролл первым движением, там уже что-то есть. */
  var SEED = 16;
  var LANES = 8;

  var frames = new Array(TOTAL);
  var pending = new Array(TOTAL);
  var seeded = 0, decoded = 0, revealed = false;

  var boot = d.getElementById('boot');
  var bootFill = d.getElementById('bootFill');
  var bootPct = d.getElementById('bootPct');
  var bootLabel = d.getElementById('bootLabel');

  var cv = d.getElementById('heroC');
  var poster = d.getElementById('heroPoster');
  var ctx = cv ? cv.getContext('2d', { alpha: false, desynchronized: true }) : null;

  var box = { w: 0, h: 0, dpr: 1 };
  var cur = 0, target = 0, vel = 0, lastKey = '';

  function pad(n) { return ('000' + n).slice(-4); }

  function url(i) {
    var path = set.dir + pad(i + 1) + '.webp';
    var cat = w.__res;
    return (cat && cat[path]) || path;
  }

  /* ─────────────────────────────────────────────────────────────── декод ── */

  var useBitmap = typeof w.createImageBitmap === 'function';

  function store(i, bmp, mySet) {
    if (mySet !== set) { if (bmp && bmp.close) bmp.close(); return; }
    if (frames[i] && frames[i].close) frames[i].close();
    frames[i] = bmp;
    decoded++;
  }

  /* Один путь для всех источников. Для data: URI фетч бессмысленен — это
     копирование мегабайтов base64 ради блоба, который уже есть в памяти, —
     поэтому там сначала <img>, но результат всё равно уходит в битмап. */
  function fetchFrame(i) {
    if (i < 0 || i >= TOTAL || frames[i] || pending[i]) return Promise.resolve();
    pending[i] = 1;
    var mySet = set;
    var src = url(i);
    var done = function () { pending[i] = 0; };

    if (src.slice(0, 5) === 'data:') {
      return viaImage(src, mySet).then(function (bmp) { store(i, bmp, mySet); }, function () { })
        .then(done);
    }

    if (useBitmap && w.fetch) {
      return fetch(src, { cache: 'force-cache' })
        .then(function (r) { return r.ok ? r.blob() : Promise.reject(r.status); })
        .then(function (b) { return createImageBitmap(b); })
        .then(function (bmp) { store(i, bmp, mySet); })
        .catch(function () {
          return viaImage(src, mySet).then(function (bmp) { store(i, bmp, mySet); }, function () { });
        })
        .then(done);
    }
    return viaImage(src, mySet).then(function (bmp) { store(i, bmp, mySet); }, function () { })
      .then(done);
  }

  /* <img> → ImageBitmap. Даже когда битмапов нет, вернём декодированный img —
     рисовать его всё ещё можно, просто чуть дороже. */
  function viaImage(src, mySet) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () {
        if (mySet !== set) return rej();
        if (!useBitmap) return res(img);
        createImageBitmap(img).then(res, function () { res(img); });
      };
      img.onerror = rej;
      img.src = src;
    });
  }

  /* ──────────────────────────────────────────────────────────── прелоадер ── */

  function bumpBoot() {
    var p = Math.min(seeded / SEED, 1);
    if (bootFill) bootFill.style.transform = 'scaleX(' + p.toFixed(3) + ')';
    if (bootPct) bootPct.textContent = Math.round(p * 100) + '%';
    if (bootLabel) {
      bootLabel.textContent = p < .35 ? 'собираем сцену'
        : p < .75 ? 'раскладываем кадры'
          : 'почти на месте';
    }
  }

  function seed() {
    var idx = [];
    for (var k = 0; k < SEED; k++) idx.push(Math.round(k * (TOTAL - 1) / (SEED - 1)));
    idx[0] = 0;

    var at = 0;
    function nextOne() {
      if (at >= idx.length) return Promise.resolve();
      var i = idx[at++];
      return fetchFrame(i).then(function () {
        seeded++;
        if (!revealed) { bumpBoot(); if (seeded >= SEED) reveal(); }
        return nextOne();
      });
    }
    var lanes = [];
    for (var l = 0; l < Math.min(LANES, idx.length); l++) lanes.push(nextOne());
    return Promise.all(lanes);
  }

  /* Добор: всё остальное, по расходящейся от того места, где сейчас стоит
     скраб, — кадры, которые вот-вот понадобятся, приезжают первыми. */
  var filling = false;
  function fill() {
    if (filling) return;
    filling = true;
    (function step() {
      var here = Math.round(cur);
      var best = -1, bestD = 1e9;
      for (var i = 0; i < TOTAL; i++) {
        if (frames[i] || pending[i]) continue;
        var dist = Math.abs(i - here);
        if (dist < bestD) { bestD = dist; best = i; }
      }
      if (best < 0) { filling = false; return; }
      var batch = [];
      for (var k = 0; k < LANES; k++) {
        var j = best + k;
        if (j < TOTAL && !frames[j] && !pending[j]) batch.push(fetchFrame(j));
      }
      if (!batch.length) batch.push(fetchFrame(best));
      Promise.all(batch).then(function () {
        if (w.requestIdleCallback) w.requestIdleCallback(step, { timeout: 200 });
        else setTimeout(step, 0);
      });
    })();
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    if (bootFill) bootFill.style.transform = 'scaleX(1)';
    if (bootPct) bootPct.textContent = '100%';
    fit();
    draw(0, true);

    setTimeout(function () {
      if (boot) boot.classList.add('is-gone');
      d.documentElement.classList.add('booted');
      if (poster) poster.classList.add('is-off');
      setTimeout(function () { if (boot) boot.hidden = true; }, 900);
      w.dispatchEvent(new CustomEvent('baza:ready'));
      fill();
    }, 220);
  }

  setTimeout(function () { if (!revealed) { reveal(); fill(); } }, 7000);

  /* ───────────────────────────────────────────────────────────── отрисовка ── */

  /* Плашка, которой заливается поле вокруг кадра. Кадры сняты на почти
     однородном тёмном с мягким пятном сверху; повторяем его градиентом, и
     стык между «картинкой» и «полем» не читается. */
  var plate = null, plateKey = '';
  function makePlate(W, H) {
    var key = W + 'x' + H;
    if (plate && plateKey === key) return plate;
    var g = ctx.createRadialGradient(W * 0.5, H * 0.34, 0, W * 0.5, H * 0.34, Math.max(W, H) * 0.78);
    g.addColorStop(0, '#171719');
    g.addColorStop(0.55, '#0e0e10');
    g.addColorStop(1, '#08080a');
    plate = g; plateKey = key;
    return g;
  }

  function fit() {
    if (!cv || !ctx) return;
    var r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var dpr = Math.min(w.devicePixelRatio || 1, 2);
    var cw = Math.round(r.width * dpr), ch = Math.round(r.height * dpr);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    box.w = cw; box.h = ch; box.dpr = dpr;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    plate = null;
    lastKey = '';
  }

  function pick(i) {
    if (frames[i]) return frames[i];
    for (var k = 1; k < TOTAL; k++) {
      if (frames[i - k]) return frames[i - k];
      if (frames[i + k]) return frames[i + k];
    }
    return null;
  }

  /* Раскладка кадра. Ключевая строка — верхняя граница масштаба: кадр никогда
     не рисуется крупнее собственного разрешения, поэтому апскейла нет вообще.
     На узком экране кадр честно кроется по ширине; на широком — упирается в
     натуральную величину и стоит по центру плашки. */
  function layout(iw, ih) {
    var cover = Math.max(box.w / iw, box.h / ih);
    var s = Math.min(cover, box.dpr);      // не крупнее 1:1 в device-пикселях
    var dw = iw * s, dh = ih * s;
    return { dw: dw, dh: dh, dx: (box.w - dw) * 0.5, dy: (box.h - dh) * 0.5 };
  }

  function paint(img, alpha) {
    var iw = img.width, ih = img.height;
    if (!iw || !ih) return;
    var L = layout(iw, ih);
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(img, L.dx, L.dy, L.dw, L.dh);
    if (alpha < 1) ctx.globalAlpha = 1;
  }

  /* Два соседних кадра, верхний с alpha = дробной части. Это и есть то, из-за
     чего пропадают ступеньки: между кадрами 41 и 42 существует всё, что между. */
  function draw(f, force) {
    if (!ctx || !box.w) return;
    f = Math.max(0, Math.min(TOTAL - 1, f));
    var i0 = Math.floor(f), frac = f - i0, i1 = Math.min(TOTAL - 1, i0 + 1);

    // перерисовываем только когда картинка реально изменилась
    var key = i0 + ':' + (frac * 24 | 0);
    if (key === lastKey && !force) return;
    lastKey = key;

    var a = pick(i0);
    if (!a) return;

    ctx.fillStyle = makePlate(box.w, box.h);
    ctx.fillRect(0, 0, box.w, box.h);

    paint(a, 1);
    if (frac > 0.004 && i1 !== i0) {
      var b = frames[i1];                 // только реальный сосед, не подмена
      if (b) paint(b, frac);
    }
  }

  /* ────────────────────────────────────────────────────────────── сцена ──── */

  var hero = d.getElementById('hero');
  var hint = d.getElementById('heroHint');

  if (hero && cv) {
    fit();

    B.onResize(function () {
      var wasKey = setKey;
      setKey = pickSet();
      if (setKey !== wasKey) {
        for (var i = 0; i < frames.length; i++) {
          if (frames[i] && frames[i].close) frames[i].close();
        }
        set = SETS[setKey];
        TOTAL = set.n;
        frames = new Array(TOTAL);
        pending = new Array(TOTAL);
        decoded = 0; filling = false;
        fit();
        seed().then(fill);
        return;
      }
      fit();
      draw(cur, true);
    });

    B.scene({
      el: hero,
      name: 'hero',
      bg: '[data-bg="hero"]',
      margin: 0.2,
      exit: function () { if (hint) hint.classList.add('is-off'); },
      enter: function () { if (hint) hint.classList.remove('is-off'); },
      update: function (p, r, s, dt) {
        var vh = w.innerHeight;
        var span = Math.max(1, r.height - vh);
        var t = B.clamp(-r.top / span, 0, 1);

        // лента занимает первые 80% пина, хвост — выездной текст
        var ft = B.clamp(t / 0.80, 0, 1);
        target = ft * (TOTAL - 1);

        if (B.env.reduce) {
          cur = target;
        } else {
          /* Ведение с учётом скорости. Медленный скролл тянется мягко, резкий
             флик догоняется цепко — иначе лента отстаёт и «плывёт» за жестом,
             что читается как лаг, а не как плавность. */
          var gap = Math.abs(target - cur);
          var k = 0.20 + B.clamp(gap / (TOTAL * 0.10), 0, 1) * 0.42;
          cur += (target - cur) * B.damp(k, dt || 1 / 60);
          vel = target - cur;
        }

        draw(cur);

        if (hint) {
          var o = 1 - B.clamp(t * 14, 0, 1);
          hint.style.opacity = o;
          hint.style.visibility = o < 0.02 ? 'hidden' : 'visible';
        }
      }
    });
  }

  /* Сборка держит свои мегабайты base64 в самом конце body — в head это
     означало бы, что до конца чтения документа не рисуется вообще ничего, —
     поэтому там ждём документ. Папочной сборке ждать нечего. */
  bumpBoot();
  if (w.__bundled && d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', seed);
  } else {
    seed();
  }

  B.hero = {
    progress: function () { return TOTAL > 1 ? cur / (TOTAL - 1) : 0; },
    ready: function () { return decoded; },
    total: function () { return TOTAL; }
  };
})(window, document);

/* ==========================================================================
   БАЗА — hero: поле под курсором.

   Свет, который таскался за мышкой, убран: он лежал поверх кадра плёнкой и
   читался как наклейка на стекле. Вместо него — сетка коротких штрихов,
   которая ведёт себя как металлическая стружка в магнитном поле: курсор
   расталкивает штрихи и разворачивает их от себя, рядом с ним они длиннее и
   ярче, вдали успокаиваются в ровный строй. Никакого свечения — только
   геометрия, поэтому кадр под ней остаётся кадром.

   Считается дёшево: сетка строится один раз на ресайз, в кадре только
   поворот и длина, канвас живёт на своём слое и не трогает вёрстку.
   ========================================================================== */
(function (w, d) {
  'use strict';
  var B = w.BAZA;
  if (!B) return;

  var cv = d.getElementById('heroField');
  if (!cv) return;
  var ctx = cv.getContext('2d', { alpha: true });

  var W = 0, H = 0, dpr = 1;
  var pts = [], STEP = 0;

  // курсор: цель и сглаженная позиция, чтобы штрихи не дёргались за рывками
  var mx = -1e4, my = -1e4, tx = -1e4, ty = -1e4, has = false, idle = 999;

  function build() {
    var r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    dpr = Math.min(w.devicePixelRatio || 1, 2);
    var cw = Math.round(r.width * dpr), ch = Math.round(r.height * dpr);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    W = r.width; H = r.height;

    // на слабых машинах и телефонах сетка реже — рисунок тот же, счёт дешевле
    STEP = B.env.lite ? 46 : 34;
    pts.length = 0;
    var ox = (W % STEP) / 2, oy = (H % STEP) / 2;
    for (var y = oy; y <= H; y += STEP) {
      for (var x = ox; x <= W; x += STEP) {
        // лёгкий джиттер: идеальная решётка читается как таблица, а не как поле
        pts.push({
          x: x + (Math.random() - .5) * STEP * .32,
          y: y + (Math.random() - .5) * STEP * .32,
          a: Math.random() * 6.283,       // текущий угол
          s: 0                            // текущая «возбуждённость» 0..1
        });
      }
    }
    return true;
  }

  function onMove(e) {
    var r = cv.getBoundingClientRect();
    tx = e.clientX - r.left;
    ty = e.clientY - r.top;
    has = true; idle = 0;
  }
  function onLeave() { has = false; }

  if (!B.env.coarse) {
    w.addEventListener('pointermove', onMove, { passive: true });
    w.addEventListener('pointerleave', onLeave, { passive: true });
  }
  B.onResize(build);

  var live = false;
  B.scene({
    el: '#hero',
    name: 'heroField',
    margin: 0.1,
    enter: function () { live = true; if (!pts.length) build(); },
    exit: function () { live = false; ctx.clearRect(0, 0, W, H); }
  });

  var R = 190;                 // радиус влияния курсора
  var time = 0;

  /* Штрихи рисуются не по одному. Тысяча отдельных beginPath/stroke — это
     тысяча вызовов отрисовки за кадр, и именно они роняли частоту вдвое.
     Вместо этого «возбуждённость» квантуется в несколько ступеней, штрихи
     одной ступени собираются в один путь и обводятся разом: восемь вызовов
     на кадр вместо тысячи, картинка та же. */
  var LV = 8;
  var lvX = [], lvY = [];      // накопители координат по ступеням
  for (var q = 0; q < LV; q++) { lvX.push([]); lvY.push([]); }

  /* Поле — фон, а не действие. Штрихи ползут медленно, и на 30 кадрах это
     неотличимо от 60, зато полная перерисовка вьюпорта случается вдвое реже.
     Кадры, которые здесь экономятся, забирает лента ноутбука, где разница
     между 30 и 60 видна сразу. */
  var acc = 0, STEP = 1 / 30;

  B.ticker.add(function (sy, dt) {
    if (!live || !W || B.env.reduce) return;
    dt = Math.min(dt || 1 / 60, 1 / 24);
    acc += dt;
    if (acc < STEP) return;
    dt = acc; acc = 0;
    time += dt;

    /* Без курсора (или на тач-устройстве) поле не замирает: по нему медленно
       проходит волна, поэтому экран дышит сам, ничего не требуя от человека. */
    if (!has || (idle += dt) > 2.6) {
      var wob = time * 0.42;
      tx = W * (0.5 + Math.cos(wob) * 0.30);
      ty = H * (0.5 + Math.sin(wob * 0.83) * 0.26);
    }
    var k = B.damp(0.12, dt);
    mx += (tx - mx) * k;
    my += (ty - my) * k;

    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';

    for (var q2 = 0; q2 < LV; q2++) { lvX[q2].length = 0; lvY[q2].length = 0; }

    var R2 = R * R;
    var kNear = B.damp(0.30, dt), kFar = B.damp(0.06, dt), kS = B.damp(0.22, dt);

    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var dx = p.x - mx, dy = p.y - my;
      var d2 = dx * dx + dy * dy;

      // цель по углу: от курсора наружу вблизи, ровный строй вдали
      var near = 0;
      if (d2 < R2) { near = 1 - Math.sqrt(d2) / R; near *= near; }
      var want = near > 0.001
        ? Math.atan2(dy, dx)
        : -0.42 + Math.sin((p.x + p.y) * 0.004 + time * 0.5) * 0.30;

      // кратчайший поворот, иначе штрих крутится через полный оборот
      var diff = ((want - p.a + Math.PI) % 6.28318) - Math.PI;
      if (diff < -Math.PI) diff += 6.28318;
      p.a += diff * (near > 0 ? kNear : kFar);
      p.s += (near - p.s) * kS;

      var lv = p.s * (LV - 1) | 0;
      if (lv < 0) lv = 0; else if (lv > LV - 1) lv = LV - 1;

      var len = 5 + p.s * 15;
      var ca = Math.cos(p.a) * len * .5, sa = Math.sin(p.a) * len * .5;
      var ax = lvX[lv], ay = lvY[lv];
      ax.push(p.x - ca, p.x + ca);
      ay.push(p.y - sa, p.y + sa);
    }

    for (var l = 0; l < LV; l++) {
      var xs = lvX[l];
      if (!xs.length) continue;
      var f = l / (LV - 1);
      ctx.strokeStyle = 'rgba(242,235,221,' + (0.055 + f * 0.50).toFixed(3) + ')';
      ctx.lineWidth = 0.9 + f * 1.05;
      ctx.beginPath();
      var ys = lvY[l];
      for (var m = 0; m < xs.length; m += 2) {
        ctx.moveTo(xs[m], ys[m]);
        ctx.lineTo(xs[m + 1], ys[m + 1]);
      }
      ctx.stroke();
    }
  }, 40);

  build();
})(window, document);
