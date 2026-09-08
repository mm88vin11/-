/* ==========================================================================
   БАЗА — хром, перенесённый из боевой сборки.

   Четыре механизма, ради которых это делалось:
     1. чернильная пилюля под навигацией, темнящая слово ровно по своей кромке;
     2. геометрия заливки кнопок (--swa/--swl);
     3. искры от нажатия;
     4. прелоадер, который улетает в шапку и становится её логотипом.

   Старый билд был на React и держал это в состоянии компонента. Здесь всё
   на том же единственном rAF, что крутит остальную страницу.
   ========================================================================== */
(function (w, d) {
  'use strict';
  var B = w.BAZA;
  if (!B) return;
  var E = B.env, $ = B.$, $$ = B.$$, on = B.on, clamp = B.clamp;

  var root = d.documentElement;

  /* ═════════════════════════════════════════════════════ 1 · ШАПКА ═══ */
  /* Разметка шапки — отрендеренный DOM боевой сборки. Здесь только динамика,
     формулы перенесены оттуда же.

     Главное, что она делает: наверху страницы три капсулы СЛИПАЮТСЯ в одну —
     лого с соцсетями едет вправо, кнопка влево, их собственные подложки
     гаснут, а вместо них проявляется одна общая; навигации при этом нет.
     Стоит отлистать на ~140 px — капсулы расходятся, и навигация проступает.
     Раньше я это состояние принял за наложение и «чинил», разводя капсулы по
     краям, — то есть ломал ровно то, что задумано. */

  var head = $('#head'), row = $('#headRow'), shell = $('#headShell');
  var pod = $('#headPod'), podSkin = $('#headPodSkin'), soc = $('#headSoc');
  var navPod = $('#headNav'), navSkin = $('#headNavSkin'), ink = $('#headInk');
  var ctaPod = $('#headCtaPod'), ctaSkin = $('#headCtaSkin'), logo = $('#headLogo');
  var items = navPod ? $$('a[data-k]', navPod) : [];

  var hm = null, hIn = 0, mg = null, inkS = null, hover = null, active = 'pain';
  var spyY = null, spyH = -1, spyN = 0;

  function measure() {
    if (!row || !pod || !ctaPod) return;
    hm = {
      row: Math.round(row.clientWidth),
      left: Math.round(pod.offsetWidth),
      right: Math.round(ctaPod.offsetWidth)
    };
  }

  /* Тёмный дубль слова у каждого пункта уже есть в перенесённой разметке —
     второй span. Именно его подрезает пилюля. */
  items.forEach(function (el) {
    var sp = el.children;
    el.__dk = sp.length > 1 ? sp[1] : null;
  });

  function inkPaint() {
    if (!inkS || !ink) return;
    var wv = inkS.w.toFixed(1) + 'px';
    if (ink.__wv !== wv) { ink.__wv = wv; ink.style.width = wv; }
    var tv = 'translate3d(' + inkS.x.toFixed(1) + 'px,0,0)';
    if (ink.__tv !== tv) { ink.__tv = tv; ink.style.transform = tv; }
    var a0 = inkS.x, a1 = inkS.x + inkS.w;
    for (var i = 0; i < items.length; i++) {
      var el = items[i], dk = el.__dk;
      if (!dk) continue;
      var b0 = el.offsetLeft, b1 = b0 + el.offsetWidth;
      var l = Math.max(0, Math.min(b1 - b0, a0 - b0));
      var r = Math.max(0, Math.min(b1 - b0, b1 - a1));
      var cv = 'inset(0px ' + r.toFixed(1) + 'px 0px ' + l.toFixed(1) + 'px)';
      if (dk.__cv !== cv) { dk.__cv = cv; dk.style.clipPath = cv; dk.style.webkitClipPath = cv; }
    }
  }

  function paintNav() {
    if (!items.length || !ink) return;
    var key = hover || active, hit = null;
    for (var i = 0; i < items.length; i++) {
      var el = items[i];
      if (el.getAttribute('data-k') === key) hit = el;
      var c = el.getAttribute('data-k') === active
        ? 'rgba(242,235,221,0.92)' : 'rgba(242,235,221,0.58)';
      if (el.__c !== c) { el.__c = c; el.style.color = c; }
    }
    if (!hit || !hit.offsetWidth) return;
    var x = hit.offsetLeft, wd = hit.offsetWidth;
    if (!inkS) { inkS = { x: x, w: wd, tx: x, tw: wd }; inkPaint(); }
    else { inkS.tx = x; inkS.tw = wd; }
  }

  items.forEach(function (el) {
    on(el, 'pointerenter', function () { hover = el.getAttribute('data-k'); paintNav(); });
  });
  if (navPod) on(navPod, 'pointerleave', function () { hover = null; paintNav(); });

  /* Пунктов в меню шесть, а разделов на странице двенадцать. Следить только
     за шестью нельзя: попав в «Маршрут» или «Болото», указатель застревал на
     «Ценах» и показывал неправду. Поэтому каждому пункту отдан весь его
     участок страницы, а не одна секция. */
  var SPY = [
    { k: 'pain', sel: '#pain' },
    { k: 'pain', sel: '#truth' },
    { k: 'services', sel: '#services' },
    { k: 'cases', sel: '#cases' },
    { k: 'pricing', sel: '#pricing' },
    { k: 'pricing', sel: '#route' },
    { k: 'pricing', sel: '#gains' },
    { k: 'atlas', sel: '#atlas' },
    { k: 'brief', sel: '#brief' },
    { k: 'brief', sel: '#basement' },
    { k: 'brief', sel: '#credits' }
  ];

  var noTr = false;
  function setT(el, v) { if (el && el.__t !== v) { el.__t = v; el.style.transform = v; } }
  function setO(el, v) {
    if (!el) return;
    var q = v.toFixed(3);
    if (el.__o !== q) { el.__o = q; el.style.opacity = q; }
  }

  var landedAt = null;

  function headerTick(sy, dt) {
    if (!row) return;
    dt = Math.max(0.008, Math.min(0.064, dt || 0.016));
    var landed = root.classList.contains('landed');
    var menuOn = d.body.classList.contains('menu-open');
    var narrow = w.innerWidth < 900;

    // проявление шапки после посадки
    var kIn = 1 - Math.exp(-dt / 0.2);
    if (landed) {
      hIn += (1 - hIn) * kIn;
      if (hIn > 0.9985) hIn = 1;
      if (landedAt == null) landedAt = performance.now();
      // на слабом кадре разгон считался бы по числу кадров, а не по времени
      if (performance.now() - landedAt > 700) hIn = 1;
    } else { hIn = 0; landedAt = null; }

    setO(logo, menuOn ? 1 : hIn);
    setO(soc, menuOn ? 0 : hIn);

    var a = (landed ? 1 : 0) * (menuOn ? 0 : 1) * hIn;
    if (!hm) measure();
    var canMerge = !!(landed && !narrow && !menuOn && hm && hm.row > 0);
    var mT = canMerge ? Math.max(0, Math.min(1, 1 - (sy - 6) / 132)) : 0;
    if (mg == null) mg = mT;
    mg += (mT - mg) * (1 - Math.exp(-dt / 0.26));
    if (Math.abs(mT - mg) < 0.0012) mg = mT;
    var m = mg;
    var em = m * m * m * (m * (m * 6 - 15) + 10);     // smootherstep

    var total = hm ? hm.left + hm.right + 2 : 0;
    var slack = hm ? Math.max(0, Math.round((hm.row - total) / 2)) : 0;
    var sh = slack * em;

    // перенесённый DOM приезжает со своими transition — их надо снять один раз,
    // иначе каждый кадр борется с доводкой браузера
    if (!noTr) {
      noTr = true;
      [pod, ctaPod, podSkin, ctaSkin, shell, navPod, navSkin, ink]
        .concat(items).forEach(function (el) { if (el) el.style.transition = 'none'; });
    }

    var rise = (1 - hIn) * -7;
    setT(pod, 'translate3d(' + sh.toFixed(2) + 'px,' + rise.toFixed(2) + 'px,0)');
    setT(ctaPod, 'translate3d(' + (-sh).toFixed(2) + 'px,' + rise.toFixed(2) + 'px,0)');
    setO(ctaPod, a);
    setO(podSkin, a * (1 - em));
    setO(ctaSkin, a * (1 - em));

    if (shell) {
      if (shell.style.visibility !== 'visible') shell.style.visibility = 'visible';
      var wv = (canMerge ? (total + (hm.row - total) * (1 - em)) : 0).toFixed(1) + 'px';
      if (shell.style.width !== wv) shell.style.width = wv;
      setO(shell, a * em);
    }

    var navA = narrow ? 0 : a * (1 - em);
    setO(navPod, navA);
    if (navPod) {
      var pe = navA > 0.9 ? 'auto' : 'none';
      if (navPod.style.pointerEvents !== pe) navPod.style.pointerEvents = pe;
      setT(navPod, 'translate3d(-50%,0,0) translateX(' +
        (hm ? (hm.left - hm.right) / 2 * em : 0).toFixed(2) + 'px)');
    }
    setO(navSkin, navA);
    setO(ink, navA);

    var off = narrow || !landed || menuOn;
    for (var i = 0; i < items.length; i++) {
      var pI = Math.max(0, Math.min(1, ((1 - em) - i * 0.03) / 0.88));
      var e2 = pI * pI * (3 - 2 * pI);
      setO(items[i], off ? 0 : e2);
      setT(items[i], 'translate3d(0,' + (-2.4 * (1 - e2)).toFixed(2) + 'px,0)');
    }

    // чернильная пилюля догоняет цель
    if (inkS && (inkS.x !== inkS.tx || inkS.w !== inkS.tw)) {
      var ai = 1 - Math.exp(-dt / 0.105);
      inkS.x += (inkS.tx - inkS.x) * ai;
      inkS.w += (inkS.tw - inkS.w) * ai;
      if (Math.abs(inkS.tx - inkS.x) + Math.abs(inkS.tw - inkS.w) < 0.2) {
        inkS.x = inkS.tx; inkS.w = inkS.tw;
      }
      inkPaint();
    }

    /* Активный раздел. Смещения секций кэшируются: getBoundingClientRect на
       одиннадцати узлах каждый кадр заставляет браузер пересчитывать раскладку
       шестьдесят раз в секунду — на этом список слежения и уронил частоту
       вчетверо, когда из шести секций стал одиннадцатью. Пересчёт — только на
       ресайзе и когда высота документа изменилась (секции раскрываются). */
    /* scrollHeight сам по себе тоже принудительный пересчёт раскладки, и в
       кадре ему делать нечего. Высота проверяется раз в полсекунды — секции
       раскрываются от нажатий, не по кадрам. */
    spyN++;
    if (spyY == null || (spyN % 30 === 0 && d.body.scrollHeight !== spyH)) {
      spyH = d.body.scrollHeight;
      spyY = [];
      for (var j0 = 0; j0 < SPY.length; j0++) {
        var e0 = SPY[j0].el || (SPY[j0].el = $(SPY[j0].sel));
        spyY.push(e0 ? e0.getBoundingClientRect().top + sy : Infinity);
      }
    }
    var line = sy + w.innerHeight * 0.34, act = SPY[0].k;
    for (var j = 0; j < SPY.length; j++) {
      if (spyY[j] <= line) act = SPY[j].k;
    }
    if (act !== active) { active = act; paintNav(); }
  }

  if (head) {
    measure();
    B.ticker.add(headerTick, 86);
    B.onResize(function () { hm = null; inkS = null; spyY = null; measure(); paintNav(); });
    w.addEventListener('baza:ready', function () { measure(); paintNav(); });
  }

  /* ═══════════════════════════════════════ 2 · ГЕОМЕТРИЯ ЗАЛИВКИ ══════ */
  /* Пока кнопка в покое, кружок со стрелкой стоит справа, подпись слева. При
     наведении они меняются местами: кружок уезжает к левому краю, подпись
     встаёт справа от него. Обе дистанции считаются от реальных
     прямоугольников — svg не знает offsetWidth. */

  function sweepGeo() {
    $$('[data-sw]').forEach(function (el) {
      var ar = $('[data-ar="1"]', el);
      if (!ar) return;
      var disc = ar;
      while (disc && disc.parentElement !== el) disc = disc.parentElement;
      if (!disc) return;

      var er = el.getBoundingClientRect();
      var lab = null;
      for (var i = 0; i < el.children.length; i++) {
        var ch = el.children[i];
        if (ch === disc) continue;
        if (ch.getBoundingClientRect().width > 6) { lab = ch; break; }
      }
      var cs = getComputedStyle(el);
      var pl = parseFloat(cs.paddingLeft) || 0;
      var pr = parseFloat(cs.paddingRight) || 0;
      var dr = disc.getBoundingClientRect();
      var room = er.width - pl - pr - dr.width;
      // на узкой кнопке меняться местами негде — пусть просто заливается
      if (!lab || !er.width || !dr.width || room < 40) {
        el.style.removeProperty('--swa');
        el.style.removeProperty('--swl');
        return;
      }
      var gp = Math.max(10, Math.min(18, Math.round(er.width * 0.035)));
      var dtx = Math.max(-room, Math.min(0, pl - (dr.left - er.left)));
      var ltx = Math.max(0, Math.min(room,
        (pl + dr.width + gp) - (lab.getBoundingClientRect().left - er.left)));
      disc.setAttribute('data-swa', '1');
      lab.setAttribute('data-swl', '1');
      el.style.setProperty('--swa', dtx.toFixed(1) + 'px');
      el.style.setProperty('--swl', ltx.toFixed(1) + 'px');
    });
  }
  B.sweepGeo = sweepGeo;

  /* data-on ставится на наведение и на фокус с клавиатуры: заливка — это
     основной отклик кнопки, и человек без мыши не должен его лишаться. */
  on(d, 'pointerover', function (e) {
    var t = e.target.closest && e.target.closest('[data-sw]');
    if (t) t.setAttribute('data-on', '');
  });
  on(d, 'pointerout', function (e) {
    var t = e.target.closest && e.target.closest('[data-sw]');
    if (t && !t.contains(e.relatedTarget)) t.removeAttribute('data-on');
  });
  on(d, 'focusin', function (e) {
    var t = e.target.closest && e.target.closest('[data-sw]');
    if (t) t.setAttribute('data-on', '');
  });
  on(d, 'focusout', function (e) {
    var t = e.target.closest && e.target.closest('[data-sw]');
    if (t) t.removeAttribute('data-on');
  });

  var geoRaf = 0;
  B.onResize(function () {
    if (geoRaf) return;
    geoRaf = requestAnimationFrame(function () { geoRaf = 0; sweepGeo(); });
  });

  /* ══════════════════════════════════════════════ 3 · ИСКРЫ КЛИКА ═════ */
  /* Семь тонких планок разлетаются от точки нажатия. Живут на своём узле
     поверх всего, ничего не измеряют и удаляются по таймеру — поэтому не
     стоят ни кадра после того, как отыграли. */

  function sparks(x, y) {
    if (E.reduce || E.lite) return;
    var host = d.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y +
      'px;width:0;height:0;z-index:9998;pointer-events:none';
    for (var i = 0; i < 7; i++) {
      var a = (i / 7) * 360 + (Math.random() * 16 - 8);
      var sp = d.createElement('span');
      sp.style.cssText = 'position:absolute;left:0;top:0;width:' +
        (8 + Math.random() * 6).toFixed(1) +
        'px;height:1.4px;border-radius:2px;background:rgba(242,235,221,.8);' +
        'transform-origin:0 50%;opacity:0;animation:lb-spark ' +
        (520 + Math.random() * 160).toFixed(0) +
        'ms cubic-bezier(.16,.84,.24,1) forwards';
      sp.style.setProperty('--a', a.toFixed(1) + 'deg');
      host.appendChild(sp);
    }
    d.body.appendChild(host);
    setTimeout(function () { if (host.parentNode) host.parentNode.removeChild(host); }, 760);
  }
  B.sparks = sparks;

  on(w, 'pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest && e.target.closest('input,textarea,[data-sel]')) return;
    if (!root.classList.contains('landed')) return;
    sparks(e.clientX, e.clientY);
  }, { passive: true });

  /* ════════════════════════════════════════════════ 4 · ПРЕЛОАДЕР ════ */
  /* Знак не гаснет и не сменяется — он физически уезжает в шапку. Смещение
     и масштаб считаются от реальных прямоугольников обоих логотипов, чтобы
     перелёт заканчивался ровно там, где стоит логотип шапки. */

  var intro = $('#intro'), introLogo = $('#introLogo'), bar = $('#introBar');
  var headLogo = $('#headLogo');

  function flyToHeader() {
    if (!introLogo || !headLogo) return;
    var a = introLogo.getBoundingClientRect();
    var b = headLogo.getBoundingClientRect();
    if (!a.width || !b.width) return;
    root.style.setProperty('--fx', ((b.left + b.width / 2) - (a.left + a.width / 2)).toFixed(1) + 'px');
    root.style.setProperty('--fy', ((b.top + b.height / 2) - (a.top + a.height / 2)).toFixed(1) + 'px');
    root.style.setProperty('--fs', (b.width / a.width).toFixed(4));
    root.classList.add('flying');
  }

  B.introFill = function (p) {
    if (bar) bar.style.transform = 'scaleX(' + clamp(p, 0, 1).toFixed(3) + ')';
  };

  /* Порядок посадки: полоса дошла до конца → знак летит в шапку → занавес
     гаснет → капсулы шапки проявляются. Пауза между перелётом и снятием
     занавеса нужна, иначе знак исчезает на полпути. */
  B.introLand = function () {
    if (root.classList.contains('landed')) return;
    root.classList.add('ready');
    flyToHeader();
    setTimeout(function () {
      root.classList.add('landed');
      measure();
      sweepGeo();
      paintNav();
      if (intro) setTimeout(function () { intro.hidden = true; }, 1000);
    }, 620);
  };

  // страховка: если что-то пойдёт не так, занавес всё равно уйдёт
  setTimeout(function () { B.introLand(); }, 9000);

  /* Человек начал листать, не дожидаясь — это тоже согласие идти дальше. */
  on(w, 'scroll', function () {
    if (!root.classList.contains('landed') && w.scrollY > 80) B.introLand();
  }, { passive: true });

  /* ═════════════════════════════════════════════════════ сборка ══════ */

  B.ready(function () { measure(); sweepGeo(); paintNav(); });
  w.addEventListener('baza:ready', function () { sweepGeo(); });
  // шрифты меняют ширину подписей — геометрию надо пересчитать после загрузки
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { measure(); sweepGeo(); paintNav(); });
})(window, document);
