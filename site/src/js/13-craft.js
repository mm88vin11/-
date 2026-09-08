/* ==========================================================================
   БАЗА — craft: курсор, магнетизм, живая шапка, буквы, бегущая строка.

   Всё, что отличает «работает» от «дорого». Ни одной новой библиотеки:
   физика взята из готовых пресетов (магнит с зажимом 0.3 и elastic-выходом,
   посимвольный вылет с rotateX и шагом 15 мс), но считается на том же
   единственном rAF, что уже крутит страницу. Вторая петля анимации стоила бы
   ровно те же кадры, которые мы только что отвоевали.

   Правило на весь файл: анимируются только transform и opacity. Любое
   свойство, которое трогает раскладку, выкидывает кадр на пересчёт — и на
   середине страницы это видно.
   ========================================================================== */
(function (w, d) {
  'use strict';
  var B = w.BAZA;
  if (!B) return;
  var E = B.env, $ = B.$, $$ = B.$$, on = B.on, clamp = B.clamp;

  var OFF = (w.__craftOff||'').split(',');
  var fine = !E.coarse && w.matchMedia && w.matchMedia('(hover:hover)').matches;

  /* ══════════════════════════════════════════════════ 1 · КУРСОР ═══════ */
  /* Две точки: ядро идёт за пальцем почти без задержки, кольцо отстаёт и
     догоняет. Именно разница скоростей читается как вес — одна точка,
     приклеенная к курсору, выглядит как баг отрисовки, а не как курсор. */

  var cursor = null;
  if (fine && !E.reduce && OFF.indexOf('cursor')<0) {
    cursor = d.createElement('div');
    cursor.className = 'cur';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = '<i class="cur__ring"></i><i class="cur__dot"></i>' +
      '<span class="cur__label"></span>';
    d.body.appendChild(cursor);
    d.documentElement.classList.add('has-cur');

    var ring = $('.cur__ring', cursor), dot = $('.cur__dot', cursor);
    var label = $('.cur__label', cursor);

    var mx = w.innerWidth / 2, my = w.innerHeight / 2;
    var rx = mx, ry = my, dx = mx, dy = my;
    var scale = 1, tScale = 1, shown = 0, tShown = 0;
    var lastO = '', labelled = false;

    on(w, 'pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY; tShown = 1;
    }, { passive: true });
    on(d, 'pointerleave', function () { tShown = 0; });
    on(w, 'blur', function () { tShown = 0; });

    /* Что под курсором, решается на pointerover, а не в кадре: спрашивать
       closest() шестьдесят раз в секунду — это шестьдесят обходов дерева
       ради ответа, который меняется пару раз за всё время. */
    var HOT = 'a,button,[role="button"],input,label,summary,.chip,.pill,.mblock,.nope,.socc,.udl';
    on(d, 'pointerover', function (e) {
      var t = e.target.closest ? e.target.closest(HOT) : null;
      var draw = e.target.closest && e.target.closest('#stC');
      cursor.classList.toggle('is-hot', !!t);
      cursor.classList.toggle('is-draw', !!draw);
      tScale = draw ? 2.1 : t ? 1.75 : 1;
      var hint = t && t.getAttribute('data-cur');
      if (label) label.textContent = hint || (draw ? 'ведите' : '');
      labelled = !!(hint || draw);
      cursor.classList.toggle('is-labelled', labelled);
    });
    on(d, 'pointerdown', function () { tScale *= 0.72; });
    on(d, 'pointerup', function () {
      tScale = cursor.classList.contains('is-draw') ? 2.1
        : cursor.classList.contains('is-hot') ? 1.75 : 1;
    });

    B.ticker.add(function (sy, dt) {
      dt = Math.min(dt || 1 / 60, 1 / 24);
      // ядро почти без инерции, кольцо заметно отстаёт — отсюда вес
      var kd = B.damp(0.62, dt), kr = B.damp(0.20, dt);
      dx += (mx - dx) * kd; dy += (my - dy) * kd;
      rx += (mx - rx) * kr; ry += (my - ry) * kr;
      scale += (tScale - scale) * B.damp(0.24, dt);
      shown += (tShown - shown) * B.damp(0.30, dt);

      dot.style.transform = 'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0) translate(-50%,-50%)';
      ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0) translate(-50%,-50%) scale(' + scale.toFixed(3) + ')';
      // прозрачность меняется двумя движениями за сеанс — писать её каждый
      // кадр значит просить пересчёт там, где ничего не поменялось
      var o = shown.toFixed(2);
      if (o !== lastO) { cursor.style.opacity = o; lastO = o; }
      // подпись почти всегда пуста; двигать пустой узел незачем
      if (label && labelled) {
        label.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + (ry + 30).toFixed(1) + 'px,0) translate(-50%,0)';
      }
    }, 95);
  }

  /* ═════════════════════════════════════════════════ 2 · МАГНЕТИЗМ ════ */
  /* Кнопка тянется к курсору. Сила зажата: элемент никогда не покидает свою
     зону нажатия, иначе клик промахивается мимо того, что видно. Вешается
     на считанные элементы — магнитится всё подряд, и страница дрожит. */

  function magnetise(el, strength, radius) {
    if (!fine || E.reduce) return;
    var tx = 0, ty = 0, cx = 0, cy = 0, live = false;
    var S = strength || 0.3, R = radius || 90;

    function move(e) {
      var r = el.getBoundingClientRect();
      var ox = e.clientX - (r.left + r.width / 2);
      var oy = e.clientY - (r.top + r.height / 2);
      var dist = Math.hypot(ox, oy);
      var reach = Math.max(r.width, r.height) / 2 + R;
      if (dist > reach) { tx = ty = 0; return; }
      var f = 1 - dist / reach;
      tx = ox * S * f; ty = oy * S * f;
    }
    on(w, 'pointermove', function (e) {
      if (!live) return;
      move(e);
    }, { passive: true });

    // тикает только пока курсор рядом: сотня спящих кнопок не должна
    // отнимать кадр у того, что действительно движется
    var step = function (sy, dt) {
      var k = B.damp(0.18, Math.min(dt || 1 / 60, 1 / 24));
      cx += (tx - cx) * k; cy += (ty - cy) * k;
      el.style.transform = 'translate3d(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px,0)';
      if (!live && Math.abs(cx) < 0.05 && Math.abs(cy) < 0.05) {
        el.style.transform = '';
        B.ticker.remove(step);
        step.__on = false;
      }
    };
    step.__on = false;

    on(el, 'pointerenter', function () {
      live = true;
      if (!step.__on) { step.__on = true; B.ticker.add(step, 92); }
    });
    on(el, 'pointerleave', function () { live = false; tx = ty = 0; });
  }
  B.magnetise = magnetise;

  /* ════════════════════════════════════════════ 3 · БУКВЫ ЗАГОЛОВКОВ ══ */
  /* Заголовок собирается из букв. Разбиваются только короткие строки:
     на абзаце это сотни узлов ради эффекта, которого никто не заметит.
     Оригинальный текст остаётся в aria-label, поэтому скринридер читает
     фразу, а не перечисляет буквы по одной. */

  function splitChars(el) {
    if (el.__split) return;
    el.__split = 1;
    var text = el.textContent.trim();
    if (!text || text.length > 90) return;
    el.setAttribute('aria-label', text);

    var frag = d.createDocumentFragment();
    var nodes = [];
    Array.prototype.forEach.call(el.childNodes, function (n) { nodes.push(n); });

    function walk(node, into) {
      if (node.nodeType === 3) {
        var s = node.nodeValue;
        for (var i = 0; i < s.length; i++) {
          var ch = s[i];
          if (ch === ' ') { into.appendChild(d.createTextNode(' ')); continue; }
          var sp = d.createElement('span');
          sp.className = 'ch';
          sp.textContent = ch;
          into.appendChild(sp);
        }
      } else if (node.nodeType === 1) {
        if (node.tagName === 'BR') { into.appendChild(node.cloneNode()); return; }
        var clone = node.cloneNode(false);
        Array.prototype.forEach.call(node.childNodes, function (c) { walk(c, clone); });
        into.appendChild(clone);
      }
    }
    nodes.forEach(function (n) { walk(n, frag); });

    el.textContent = '';
    el.appendChild(frag);
    el.setAttribute('aria-hidden', 'false');
    el.classList.add('split');

    var chars = $$('.ch', el);
    chars.forEach(function (c, i) { c.style.setProperty('--i', i); });
    el.style.setProperty('--n', chars.length);
  }

  /* Разбор — ленивый, и это не оптимизация «на всякий случай», а условие
     работоспособности. `perspective` на заголовке создаёт 3D-контекст, и
     каждая буква с rotateX внутри него становится слоем, который композитор
     пересобирает каждый кадр — даже когда заголовок далеко за экраном. Пока
     разбирались все заголовки сразу, страница честно держала 30 кадров вместо
     60. Поэтому: разбираем в момент подхода, а сразу после проигрыша
     схлопываем обратно в плоский текст и 3D-контекст убираем совсем. */

  var SPLIT_MS = 1500;

  function playSplit(el) {
    splitChars(el);
    if (!el.classList.contains('split')) return;   // слишком длинный — пропущен
    requestAnimationFrame(function () {
      el.classList.add('is-lit');
      var chars = $$('.ch', el).length;
      setTimeout(function () { el.classList.add('is-flat'); },
        SPLIT_MS + chars * 15);
    });
  }

  function initSplits() {
    if (E.reduce || OFF.indexOf('split') >= 0) return;
    var heads = $$('h1.h-xl:not([data-split]), h2.h-lg:not([data-split])');
    if (!heads.length) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        playSplit(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    heads.forEach(function (h) {
      h.setAttribute('data-split', '');
      io.observe(h);
    });
  }

  /* ═══════════════════════════════════════ 4 · БЕГУЩАЯ СТРОКА ═════════ */
  /* Лента жила своей жизнью с постоянной скоростью и не знала, что делает
     человек. Теперь она реагирует: стоишь — ползёт, летишь вниз — разгоняется,
     листаешь вверх — идёт назад. Это дешёвый, но очень заметный признак того,
     что страница живая. */

  function liveTicker() {
    if (OFF.indexOf('ticker')>=0) return;
    var run = $('#tickRun');
    if (!run || E.reduce) return;
    var pos = 0, vel = 0, lastY = w.scrollY || 0, width = 0;

    function measure() { width = run.scrollWidth / 2 || 1; }
    measure();
    B.onResize(measure);
    w.addEventListener('baza:ready', measure);

    B.ticker.add(function (sy, dt) {
      dt = Math.min(dt || 1 / 60, 1 / 24);
      var dy = sy - lastY;
      lastY = sy;
      // скорость скролла подмешивается к базовому ходу и затухает
      vel += (dy * 2.6 - vel) * B.damp(0.14, dt);
      var base = 46;                       // px/сек в покое
      pos -= (base * dt + vel * dt * 3.2);
      if (!width) measure();
      if (width) {
        // модуль по длине одной копии: лента бесшовная в обе стороны
        pos = pos % width;
        if (pos > 0) pos -= width;
      }
      run.style.transform = 'translate3d(' + pos.toFixed(2) + 'px,0,0)';
    }, 88);
    run.classList.add('is-driven');
  }

  /* ════════════════════════════════════════════════ 5 · ШАПКА ════════ */
  /* Шапка ужимается на пути вниз и раскрывается, когда человек пошёл вверх:
     вверх идут за навигацией. Плюс нить, которая переезжает под наведённый
     пункт, — она и связывает пункты в одну панель, а не в шесть ссылок. */

  function liveHead() {
    if (OFF.indexOf('head')>=0) return;
    var head = $('#head'), pod = $('.head__pod');
    if (!head) return;

    var lastY = w.scrollY || 0, dir = 0, acc = 0;
    B.ticker.add(function (sy) {
      var dy = sy - lastY;
      lastY = sy;
      if (Math.abs(dy) < 0.5) return;
      // накопитель, иначе шапка дёргается на каждом микродвижении тачпада
      acc = clamp(acc + dy, -90, 90);
      var want = sy < 90 ? 0 : acc > 60 ? 1 : acc < -60 ? 0 : dir;
      if (want !== dir) {
        dir = want;
        head.classList.toggle('is-tight', !!dir);
      }
    }, 87);

    if (!pod || !fine) return;
    // нить под пунктами
    var thread = d.createElement('i');
    thread.className = 'head__thread';
    thread.setAttribute('aria-hidden', 'true');
    pod.appendChild(thread);

    var links = $$('.head__link', pod);
    links.forEach(function (a) {
      on(a, 'pointerenter', function () {
        var pr = pod.getBoundingClientRect(), ar = a.getBoundingClientRect();
        thread.style.transform = 'translate3d(' + (ar.left - pr.left) + 'px,0,0)';
        thread.style.width = ar.width + 'px';
        pod.classList.add('is-threaded');
      });
    });
    on(pod, 'pointerleave', function () { pod.classList.remove('is-threaded'); });
  }

  /* ═══════════════════════════════════════════════ 6 · СБОРКА ════════ */

  function boot() {
    initSplits();
    liveTicker();
    liveHead();

    // магнитятся только по-настоящему главные цели
    $$('.head__cta .btn, .br__send, .tt__cta, .sw__cta .btn').forEach(function (b) {
      magnetise(b, 0.28, 70);
    });
    $$('.nope').forEach(function (b) { magnetise(b, 0.55, 120); });
  }

  B.ready(boot);
  w.addEventListener('baza:ready', function () {
    // после раскрытия ленты часть разметки уже создана скриптами секций
    initSplits();
  });
})(window, document);
