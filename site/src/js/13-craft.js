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

  /* ═════════════════════════════════════ 1 · ЧЕРНИЛЬНАЯ ПИЛЮЛЯ ════════ */

  var nav = $('#headNav'), ink = $('#headInk');
  var items = nav ? $$('.head__link', nav) : [];
  var inkS = null, hover = null, active = 'pain';

  /* Тёмный дубль текста у каждого пункта. Строится один раз: он и есть тот
     слой, который подрезается по кромке пилюли. */
  items.forEach(function (el) {
    if ($('.lb-dark', el)) return;
    var dk = d.createElement('span');
    dk.className = 'lb-dark';
    dk.setAttribute('aria-hidden', 'true');
    dk.innerHTML = '<span>' + (el.textContent || '').trim() + '</span>';
    el.appendChild(dk);
    el.__dk = dk;
  });

  function inkPaint() {
    if (!inkS || !ink) return;
    var wv = inkS.w.toFixed(1) + 'px';
    if (ink.__wv !== wv) { ink.__wv = wv; ink.style.width = wv; }
    var tv = 'translate3d(' + inkS.x.toFixed(1) + 'px,0,0)';
    if (ink.__tv !== tv) { ink.__tv = tv; ink.style.transform = tv; }

    /* Подрезка тёмной копии по пересечению с пилюлей. Именно из-за неё буква
       может быть тёмной наполовину — эффект, ради которого всё и затевалось. */
    var a0 = inkS.x, a1 = inkS.x + inkS.w;
    for (var i = 0; i < items.length; i++) {
      var el = items[i], dk = el.__dk;
      if (!dk) continue;
      var b0 = el.offsetLeft, b1 = b0 + el.offsetWidth;
      var l = Math.max(0, Math.min(b1 - b0, a0 - b0));
      var r = Math.max(0, Math.min(b1 - b0, b1 - a1));
      var cv = 'inset(0px ' + r.toFixed(1) + 'px 0px ' + l.toFixed(1) + 'px)';
      if (dk.__cv !== cv) {
        dk.__cv = cv;
        dk.style.clipPath = cv;
        dk.style.webkitClipPath = cv;
      }
    }
  }

  function paintNav() {
    if (!items.length || !ink) return;
    var key = hover || active, hit = null;
    for (var i = 0; i < items.length; i++) {
      var el = items[i];
      if (el.getAttribute('data-k') === key) hit = el;
      el.classList.toggle('is-here', el.getAttribute('data-k') === active);
    }
    if (!hit || !hit.offsetWidth) return;
    var x = hit.offsetLeft, wd = hit.offsetWidth;
    if (!inkS) { inkS = { x: x, w: wd, tx: x, tw: wd }; inkPaint(); }
    else { inkS.tx = x; inkS.tw = wd; }
    if (nav) nav.classList.add('is-inked');
  }

  if (nav && ink) {
    items.forEach(function (el) {
      on(el, 'pointerenter', function () { hover = el.getAttribute('data-k'); paintNav(); });
    });
    on(nav, 'pointerleave', function () { hover = null; paintNav(); });

    /* Догоняющее движение — экспоненциальное сглаживание, независимое от
       частоты кадров: на 120 Гц пилюля едет ровно столько же, сколько на 60. */
    B.ticker.add(function (sy, dt) {
      if (!inkS) return;
      if (inkS.x === inkS.tx && inkS.w === inkS.tw) return;
      var a = 1 - Math.exp(-clamp(dt || 1 / 60, 0.008, 0.06) / 0.105);
      inkS.x += (inkS.tx - inkS.x) * a;
      inkS.w += (inkS.tw - inkS.w) * a;
      if (Math.abs(inkS.tx - inkS.x) + Math.abs(inkS.tw - inkS.w) < 0.2) {
        inkS.x = inkS.tx; inkS.w = inkS.tw;
      }
      inkPaint();
    }, 86);

    /* Активный раздел ведём по тем же секциям, что и остальная страница. */
    var SPY = [
      { k: 'pain', sel: '#pain' }, { k: 'services', sel: '#services' },
      { k: 'cases', sel: '#cases' }, { k: 'pricing', sel: '#pricing' },
      { k: 'atlas', sel: '#atlas' }, { k: 'brief', sel: '#brief' }
    ];
    B.ticker.add(function (sy) {
      var line = sy + w.innerHeight * 0.34, act = SPY[0].k;
      for (var i = 0; i < SPY.length; i++) {
        var el = SPY[i].el || (SPY[i].el = $(SPY[i].sel));
        if (!el) continue;
        if (sy + el.getBoundingClientRect().top <= line) act = SPY[i].k;
      }
      if (act !== active) { active = act; paintNav(); }
    }, 85);

    B.onResize(function () { inkS = null; paintNav(); });
    w.addEventListener('baza:ready', paintNav);
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

  B.ready(function () {
    sweepGeo();
    paintNav();
  });
  w.addEventListener('baza:ready', function () {
    sweepGeo();
    paintNav();
  });
  // шрифты меняют ширину подписей — геометрию надо пересчитать после загрузки
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { sweepGeo(); paintNav(); });
})(window, document);
