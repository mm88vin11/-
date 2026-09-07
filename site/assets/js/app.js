/* ===== app.js ===== */
/* ==========================================================================
   БАЗА — app: stage director, chrome, and the small stuff.

   The director is the reason the boundaries read as continuous. Instead of
   switching backdrops on or off, every universe gets a weight from how close
   it is to the middle of the viewport; the weights are normalised so they
   always sum to 1. Two neighbours therefore cross-blend by themselves, and
   the .tr set pieces play on top of an already-seamless handover.
   ========================================================================== */
(function (w, d) {
  'use strict';
  var B = w.BAZA, E = B.env;
  var $ = B.$, $$ = B.$$, clamp = B.clamp, on = B.on;

  /* ==================================================== stage director === */

  var THEME = {
    hero:    { fg: '#f2ebdd', pod: 'rgba(10,10,10,.42)', dark: 0 },
    mario:   { fg: '#0d1b3d', pod: 'rgba(255,255,255,.5)', dark: 1 },
    matrix:  { fg: '#a8ffc4', pod: 'rgba(2,10,4,.55)', dark: 0 },
    tiktok:  { fg: '#f2ebdd', pod: 'rgba(10,10,10,.5)', dark: 0 },
    tetris:  { fg: '#dfe6ff', pod: 'rgba(7,10,28,.55)', dark: 0 },
    flappy:  { fg: '#123', pod: 'rgba(255,255,255,.52)', dark: 1 },
    shrek:   { fg: '#e8ffc0', pod: 'rgba(14,26,8,.5)', dark: 0 },
    strange: { fg: '#ffd6a3', pod: 'rgba(12,7,4,.5)', dark: 0 },
    brief:   { fg: '#0a0a0a', pod: 'rgba(242,235,221,.6)', dark: 1 },
    upside:  { fg: '#cfdce8', pod: 'rgba(5,7,12,.55)', dark: 0 },
    stars:   { fg: '#ffe81f', pod: 'rgba(0,0,0,.55)', dark: 0 }
  };

  var uniSections = $$('[data-uni]');
  uniSections.forEach(function (n) { B.measure(n); });
  var bgs = {};
  $$('#stage .bg').forEach(function (n) { bgs[n.dataset.bg] = n; });

  // group sections by universe
  var groups = {};
  uniSections.forEach(function (s) {
    var k = s.dataset.uni;
    (groups[k] = groups[k] || []).push(s);
  });
  var keys = Object.keys(groups);

  var headEl = $('#head');
  var curTheme = '';
  var shownW = {};                       // smoothed weights, avoids flicker
  keys.forEach(function (k) { shownW[k] = 0; });

  function direct(sy, dt) {
    var vh = w.innerHeight;
    var mid = vh * 0.5;
    var raw = {}, sum = 0, best = '', bestW = -1;

    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], secs = groups[k], wgt = 0;
      for (var j = 0; j < secs.length; j++) {
        var r = secs[j].__r || secs[j].getBoundingClientRect();
        // distance from the viewport centre to this band's span
        var dist = r.top > mid ? r.top - mid : (r.bottom < mid ? mid - r.bottom : 0);
        var f = clamp(1 - dist / (vh * 1.15), 0, 1);
        wgt = Math.max(wgt, f * f);
      }
      raw[k] = wgt;
      sum += wgt;
      if (wgt > bestW) { bestW = wgt; best = k; }
    }

    if (sum <= 0.0001) { raw[best] = 1; sum = 1; }

    var damp = B.damp(0.18, dt);
    for (i = 0; i < keys.length; i++) {
      var key = keys[i];
      var target = raw[key] / sum;
      shownW[key] += (target - shownW[key]) * damp;
      var o = shownW[key];
      var node = bgs[key];
      if (!node) continue;
      var live = o > 0.004;
      // painting is gated harder than visibility: a backdrop fading through
      // the last few percent of a crossfade costs a full canvas pass for
      // something nobody can see
      var paint = o > 0.05;
      if (live !== node.__live) {
        node.__live = live;
        node.classList.toggle('is-live', live);
      }
      if (paint !== node.__paint) {
        node.__paint = paint;
        if (B.backdrops[key]) B.backdrops[key].set(paint);
      }
      if (live) node.style.opacity = o.toFixed(3);
    }

    // header + progress theming follows whichever universe is dominant
    if (best && best !== curTheme) {
      curTheme = best;
      var t = THEME[best] || THEME.hero;
      d.documentElement.style.setProperty('--head-fg', t.fg);
      d.documentElement.style.setProperty('--head-pod-bg', t.pod);
      d.documentElement.style.setProperty('--head-logo-filter', t.dark ? 'brightness(0)' : 'none');
      d.documentElement.setAttribute('data-uni-now', best);
      var meta = d.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', t.dark ? '#f2ebdd' : '#0a0a0a');
    }
  }
  B.ticker.add(direct, -5);

  /* ============================================================= chrome === */

  /* progress hairline */
  var prog = $('#prog');
  B.ticker.add(function (sy) {
    if (!prog) return;
    var max = d.documentElement.scrollHeight - w.innerHeight;
    prog.style.transform = 'scaleX(' + (max > 0 ? clamp(sy / max, 0, 1) : 0) + ')';
  }, 20);

  /* header auto-hide */
  var lastY = 0, hidden = false;
  B.ticker.add(function (sy) {
    if (!headEl) return;
    var down = sy > lastY + 4, up = sy < lastY - 4;
    if (down && sy > 260 && !hidden && !d.body.classList.contains('menu-open')) {
      hidden = true; headEl.classList.add('is-hidden');
    } else if ((up || sy < 200) && hidden) {
      hidden = false; headEl.classList.remove('is-hidden');
    }
    if (Math.abs(sy - lastY) > 3) lastY = sy;
  }, 21);

  /* active nav link */
  var navLinks = $$('.head__link');
  var navTargets = navLinks.map(function (a) {
    var n = d.getElementById(a.getAttribute('href').slice(1));
    if (n) B.measure(n);
    return n;
  });
  B.ticker.add(function () {
    var vh = w.innerHeight, mid = vh * .42, bestI = -1, bestD = 1e9;
    for (var i = 0; i < navTargets.length; i++) {
      var t = navTargets[i];
      if (!t) continue;
      var r = t.__r || t.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) continue;
      var dd = Math.abs(r.top - mid);
      if (dd < bestD) { bestD = dd; bestI = i; }
    }
    for (i = 0; i < navLinks.length; i++) navLinks[i].classList.toggle('is-on', i === bestI);
  }, 22);

  /* menu */
  var burger = $('#burger'), menu = $('#menu');
  function setMenu(open) {
    d.body.classList.toggle('menu-open', open);
    if (burger) burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (menu) menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    B.lockScroll(open);
    if (open && headEl) headEl.classList.remove('is-hidden');
  }
  on(burger, 'click', function () { setMenu(!d.body.classList.contains('menu-open')); });
  on(menu, 'click', function (ev) { if (ev.target.closest('a')) setMenu(false); });
  on(d, 'keydown', function (ev) {
    if (ev.key === 'Escape' && d.body.classList.contains('menu-open')) setMenu(false);
  });

  /* anchors, offset for the fixed header */
  on(d, 'click', function (ev) {
    var a = ev.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (!id || id === '#') return;
    var t = d.querySelector(id);
    if (!t) return;
    ev.preventDefault();
    if (d.body.classList.contains('menu-open')) setMenu(false);
    var pad = id === '#top' ? 0 : (parseFloat(getComputedStyle(d.documentElement)
      .getPropertyValue('--head-h')) || 66) + 18;
    setTimeout(function () { B.scrollToEl(t, pad); }, d.body.classList.contains('menu-open') ? 240 : 0);
  });

  /* sound */
  var snd = $('#snd');
  on(snd, 'click', function () {
    var isOn = B.audio.toggle();
    snd.setAttribute('aria-pressed', isOn ? 'true' : 'false');
    snd.setAttribute('aria-label', isOn ? 'Выключить звук' : 'Включить звук');
    snd.classList.toggle('is-on', isOn);
    if (isOn) B.audio.sfx('powerup');
  });

  /* cookie bar */
  var cook = $('#cook');
  function cookDone() {
    if (cook) cook.classList.remove('is-on');
    setTimeout(function () { if (cook) cook.hidden = true; }, 500);
    try { localStorage.setItem('baza-cookie', '1'); } catch (e) { }
  }
  var seen = false;
  try { seen = localStorage.getItem('baza-cookie') === '1'; } catch (e) { }
  if (!seen && cook) {
    setTimeout(function () {
      cook.hidden = false;
      requestAnimationFrame(function () { cook.classList.add('is-on'); });
    }, 2600);
  }
  on($('#cookYes'), 'click', cookDone);
  on($('#cookNo'), 'click', cookDone);

  /* reveal + first paint */
  function boot() {
    B.initReveal();
    // one forced director pass so nothing is black on the first frame
    direct(w.scrollY || 0, 1);
  }
  B.ready(boot);
  w.addEventListener('baza:ready', boot);

  /* konami — because of course */
  var seq = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65], at = 0;
  on(d, 'keydown', function (ev) {
    if (ev.keyCode === seq[at]) {
      at++;
      if (at === seq.length) {
        at = 0;
        d.documentElement.classList.toggle('konami');
        B.audio.toggle(true);
        B.audio.sfx('powerup');
        B.toast('30 жизней выдано. Тратьте с умом.', 3600);
      }
    } else at = (ev.keyCode === seq[0]) ? 1 : 0;
  });
})(window, document);

