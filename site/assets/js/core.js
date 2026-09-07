/* ===== core.js ===== */
/* ==========================================================================
   БАЗА — core runtime
   One scroll listener. One rAF. Scenes subscribe; only visible scenes tick.
   Classic script (no modules) so the page also runs from file://.
   ========================================================================== */
(function (w, d) {
  'use strict';

  var B = (w.BAZA = w.BAZA || {});

  /* ---------------------------------------------------------------- env -- */

  var mqReduce = w.matchMedia ? w.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var mqCoarse = w.matchMedia ? w.matchMedia('(pointer: coarse)') : null;

  var env = (B.env = {
    reduce: !!(mqReduce && mqReduce.matches),
    coarse: !!(mqCoarse && mqCoarse.matches),
    w: w.innerWidth,
    h: w.innerHeight,
    dpr: Math.min(w.devicePixelRatio || 1, 2),
    mobile: w.innerWidth < 760,
    // rough capability probe: low-core devices get thinner particle budgets
    lite: (navigator.hardwareConcurrency || 8) <= 4 || w.innerWidth < 760
  });
  if (mqReduce && mqReduce.addEventListener) {
    mqReduce.addEventListener('change', function (e) {
      env.reduce = e.matches;
      d.documentElement.classList.toggle('reduce', e.matches);
    });
  }
  d.documentElement.classList.toggle('reduce', env.reduce);

  /* -------------------------------------------------------------- maths -- */

  var clamp = (B.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; });
  var lerp = (B.lerp = function (a, b, t) { return a + (b - a) * t; });
  // normalised progress of v across [a,b]
  var norm = (B.norm = function (v, a, b) { return b === a ? 0 : clamp((v - a) / (b - a), 0, 1); });
  B.ease = {
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    in: function (t) { return t * t * t; },
    io: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    // smoothstep — the workhorse for crossfades
    ss: function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  };
  // frame-rate independent lerp factor
  B.damp = function (t, dt) { return 1 - Math.pow(1 - t, dt * 60); };

  /* ------------------------------------------------------------- ticker -- */

  var subs = [];
  var running = false;
  var last = 0;
  var scrollY = 0;
  var scrollDir = 1;
  var prevY = 0;

  var Ticker = (B.ticker = {
    add: function (fn, priority) {
      fn.__p = priority || 0;
      subs.push(fn);
      subs.sort(function (a, b) { return a.__p - b.__p; });
      start();
      return fn;
    },
    remove: function (fn) {
      var i = subs.indexOf(fn);
      if (i > -1) subs.splice(i, 1);
    }
  });

  function frame(now) {
    if (!running) return;
    var dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;

    // ---- READ phase: one place where layout is measured -------------------
    scrollY = w.scrollY || w.pageYOffset || 0;
    scrollDir = scrollY > prevY ? 1 : scrollY < prevY ? -1 : scrollDir;
    prevY = scrollY;
    B.scrollY = scrollY;
    B.dt = dt;
    B.scrollDir = scrollDir;

    // ---- WRITE phase ------------------------------------------------------
    for (var i = 0; i < subs.length; i++) {
      try { subs[i](scrollY, dt, now); }
      catch (err) { /* one bad scene must never stop the loop */
        if (w.console && console.warn) console.warn('[scene]', err);
      }
    }
    requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    last = 0;
    requestAnimationFrame(frame);
  }
  B.startTicker = start;

  /* ------------------------------------------------------------ resize -- */

  var resizeSubs = [];
  B.onResize = function (fn) { resizeSubs.push(fn); return fn; };

  var rzT = 0, lastW = w.innerWidth, lastH = w.innerHeight;

  function onResize(force) {
    var nw = w.innerWidth, nh = w.innerHeight;

    /* On a phone, showing or hiding the URL bar fires `resize` with the width
       unchanged and the height moved by up to ~15%. Treating that as a real
       resize is what made the page lurch while scrolling: every canvas was
       re-fitted, every cached rect invalidated, and every 100vh box changed
       size mid-gesture. A pure height change on a touch device is therefore
       ignored — the layout already uses svh, which does not move either. */
    if (force !== true && nw === lastW && Math.abs(nh - lastH) < lastH * 0.22 && env.coarse) {
      lastH = nh;
      return;
    }

    clearTimeout(rzT);
    rzT = setTimeout(function () {
      lastW = env.w = w.innerWidth;
      lastH = env.h = w.innerHeight;
      env.dpr = Math.min(w.devicePixelRatio || 1, 2);
      env.mobile = env.w < 760;
      setVH();
      for (var i = 0; i < resizeSubs.length; i++) {
        try { resizeSubs[i](env); } catch (e) { }
      }
    }, 140);
  }
  w.addEventListener('resize', onResize, { passive: true });
  w.addEventListener('orientationchange', function () { onResize(true); }, { passive: true });

  // stable viewport unit — the CSS uses svh where it can, and this covers the
  // handful of places that still need a number
  function setVH() {
    d.documentElement.style.setProperty('--vh', (w.innerHeight * 0.01) + 'px');
  }
  setVH();

  /* -------------------------------------------------------------- scene -- */
  /* A scene = a DOM band + optional backdrop + an update(p, rect) callback.
     Scenes only tick while their band is within `margin` px of the viewport. */

  var scenes = [];

  B.scene = function (opts) {
    var el = typeof opts.el === 'string' ? d.querySelector(opts.el) : opts.el;
    if (!el) return null;
    var s = {
      el: el,
      bg: opts.bg ? (typeof opts.bg === 'string' ? d.querySelector(opts.bg) : opts.bg) : null,
      margin: opts.margin == null ? 0.35 : opts.margin,
      live: false,
      p: 0,
      enter: opts.enter || null,
      exit: opts.exit || null,
      update: opts.update || null,
      resize: opts.resize || null,
      name: opts.name || '',
      // when true the scene keeps ticking even offscreen (rare)
      always: !!opts.always
    };
    scenes.push(s);
    B.measure(s.el);
    if (s.resize) B.onResize(function () { if (s.live || s.always) s.resize(s); });
    return s;
  };

  /* Every scene update writes styles. If the next scene then measured its own
     box, the browser would be forced to re-lay-out mid-loop, once per scene.
     So the frame is split: measure everything first, then write everything.
     Other consumers (the stage director) read the same cached rects. */

  var measured = [];
  B.measure = function (el) {
    if (measured.indexOf(el) < 0) measured.push(el);
    return el.__r || el.getBoundingClientRect();
  };

  function readPhase() {
    for (var i = 0; i < measured.length; i++) {
      measured[i].__r = measured[i].getBoundingClientRect();
    }
  }
  Ticker.add(readPhase, -100);

  function tickScenes(y, dt) {
    var vh = w.innerHeight;
    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i];
      var r = s.el.__r || (s.el.__r = s.el.getBoundingClientRect());
      var pad = vh * s.margin;
      var near = r.bottom > -pad && r.top < vh + pad;

      if (near !== s.live) {
        s.live = near;
        if (s.bg) s.bg.classList.toggle('is-live', near);
        if (near && s.enter) s.enter(s, r);
        if (!near && s.exit) s.exit(s, r);
      }
      if (!s.live && !s.always) continue;

      // p: 0 when the band's top hits the viewport bottom,
      //    1 when the band's bottom hits the viewport top.
      var span = r.height + vh;
      s.p = span > 0 ? clamp((vh - r.top) / span, 0, 1) : 0;
      // pIn: 0..1 across just the band being on screen (nicer for pinned art)
      s.pIn = r.height > vh ? clamp(-r.top / (r.height - vh), 0, 1) : s.p;
      s.rect = r;
      if (s.update) s.update(s.p, r, s, dt);
    }
  }
  Ticker.add(tickScenes, -10);

  /* -------------------------------------------------------------- canvas -- */
  /* Sizes a canvas to its box at capped DPR and hands back a ready ctx. */

  B.fitCanvas = function (cv, ctx, maxDpr) {
    var r = cv.getBoundingClientRect();
    var dpr = Math.min(w.devicePixelRatio || 1, maxDpr || (env.lite ? 1.5 : 2));
    var cw = Math.max(1, Math.round(r.width * dpr));
    var ch = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== cw || cv.height !== ch) {
      cv.width = cw;
      cv.height = ch;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: r.width, h: r.height, dpr: dpr };
  };

  /* ------------------------------------------------------------- reveal -- */

  var revealIO = null;
  B.initReveal = function (root) {
    var nodes = (root || d).querySelectorAll('[data-rise]:not(.is-in)');
    if (!nodes.length) return;
    if (env.reduce) {
      for (var i = 0; i < nodes.length; i++) nodes[i].classList.add('is-in', 'is-done');
      return;
    }
    if (!revealIO) {
      revealIO = new IntersectionObserver(function (entries) {
        for (var j = 0; j < entries.length; j++) {
          var e = entries[j];
          if (!e.isIntersecting) continue;
          var t = e.target;
          t.classList.add('is-in');
          revealIO.unobserve(t);
          // drop will-change once the transition has played out
          setTimeout(function (n) { return function () { n.classList.add('is-done'); }; }(t), 1100);
        }
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    }
    for (var k = 0; k < nodes.length; k++) {
      // stagger siblings automatically unless an explicit delay is set
      var n = nodes[k];
      if (!n.style.getPropertyValue('--rd') && n.hasAttribute('data-rise')) {
        var v = n.getAttribute('data-rise');
        if (v) n.style.setProperty('--rd', (parseInt(v, 10) || 0) + 'ms');
      }
      revealIO.observe(n);
    }
  };

  /* --------------------------------------------------------------- misc -- */

  // Russian plural agreement: 1 канал, 2 канала, 5 каналов
  B.plural = function (n, forms) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  };

  B.$ = function (sel, root) { return (root || d).querySelector(sel); };
  B.$$ = function (sel, root) {
    return Array.prototype.slice.call((root || d).querySelectorAll(sel));
  };

  B.on = function (el, ev, fn, opt) {
    if (!el) return;
    ev.split(' ').forEach(function (e) { el.addEventListener(e, fn, opt || false); });
  };

  // Lock scroll without the iOS jump — used by the menu.
  var lockY = 0, locked = false;
  B.lockScroll = function (on) {
    if (on === locked) return;
    locked = on;
    if (on) {
      lockY = w.scrollY;
      d.body.style.position = 'fixed';
      d.body.style.top = -lockY + 'px';
      d.body.style.left = '0';
      d.body.style.right = '0';
    } else {
      d.body.style.position = '';
      d.body.style.top = '';
      d.body.style.left = '';
      d.body.style.right = '';
      w.scrollTo(0, lockY);
    }
  };

  // Smooth anchor scroll that respects the fixed header.
  B.scrollToEl = function (el, extra) {
    if (!el) return;
    var top = el.getBoundingClientRect().top + w.scrollY - (extra || 0);
    try {
      w.scrollTo({ top: top, behavior: env.reduce ? 'auto' : 'smooth' });
    } catch (e) { w.scrollTo(0, top); }
  };

  /* ------------------------------------------------------------ haptics -- */
  B.buzz = function (ms) {
    if (env.coarse && navigator.vibrate) { try { navigator.vibrate(ms || 8); } catch (e) { } }
  };

  /* --------------------------------------------------------------- boot -- */
  B.ready = function (fn) {
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', fn);
    else fn();
  };

  start();
})(window, document);

