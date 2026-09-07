/* ===== hero.js ===== */
/* ==========================================================================
   БАЗА — hero: scroll-driven laptop reel.

   One continuous sequence, not two spliced ones. The old build cut the shot
   into an "open" reel and a "close" reel with a gap between them, which is
   what read as the jump in the middle; here the whole take is a single strip
   and the scroll just walks along it.

   Frames decode off the main thread through createImageBitmap, so scrubbing
   never competes with image decoding for the same frame budget.
   ========================================================================== */
(function (w, d) {
  'use strict';
  var B = w.BAZA;

  /* Two art sets, one per orientation. Counts come from the encoder:
     desktop = every 2nd source frame, portrait = every 3rd. */
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

  /* The reveal waits on a spread of frames across the whole reel rather than
     the first N. Fourteen consecutive frames only prove the opening beat is
     ready; a spread means every part of the scrub has something to show, so
     the first fast flick down does not land on an empty canvas. */
  var SEED = 16;
  var LANES = 8;

  var frames = new Array(TOTAL);   // ImageBitmap | HTMLImageElement
  var pending = new Array(TOTAL);  // in-flight guard
  var seeded = 0, decoded = 0, revealed = false;

  var boot = d.getElementById('boot');
  var bootFill = d.getElementById('bootFill');
  var bootPct = d.getElementById('bootPct');
  var bootLabel = d.getElementById('bootLabel');

  var cv = d.getElementById('heroC');
  var poster = d.getElementById('heroPoster');
  var aura = d.getElementById('heroAura');
  var ctx = cv ? cv.getContext('2d', { alpha: false, desynchronized: true }) : null;

  var box = { w: 0, h: 0 };
  var cur = 0, target = 0, lastDrawn = -1;

  function pad(n) { return ('000' + n).slice(-4); }
  function url(i) { return set.dir + pad(i + 1) + '.webp'; }

  /* ------------------------------------------------------------ decode -- */

  var useBitmap = typeof w.createImageBitmap === 'function';

  function store(i, bmp) {
    if (frames[i] && frames[i].close) frames[i].close();
    frames[i] = bmp;
    decoded++;
  }

  function fetchFrame(i) {
    if (i < 0 || i >= TOTAL || frames[i] || pending[i]) return Promise.resolve();
    pending[i] = 1;
    var mySet = set;

    if (useBitmap && w.fetch) {
      return fetch(url(i), { cache: 'force-cache' })
        .then(function (r) { return r.ok ? r.blob() : Promise.reject(r.status); })
        .then(function (b) { return createImageBitmap(b); })
        .then(function (bmp) {
          // an orientation flip mid-flight must not poison the new set
          if (mySet !== set) { if (bmp.close) bmp.close(); return; }
          store(i, bmp);
        })
        .catch(function () { return legacy(i, mySet); })
        .then(function () { pending[i] = 0; });
    }
    return legacy(i, mySet).then(function () { pending[i] = 0; });
  }

  function legacy(i, mySet) {
    return new Promise(function (res) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () { if (mySet === set) store(i, img); res(); };
      img.onerror = res;
      img.src = url(i);
    });
  }

  /* ------------------------------------------------------------- boot --- */

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

  /* Seed pass: SEED frames spread evenly across the reel, so the reveal is
     honest — wherever the visitor lands first, a frame is already there. */
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

  /* Fill pass: everything else, ordered outward from wherever the scrub is
     sitting right now, so the frames the visitor is about to need land first. */
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
      // grab a small run around the winner — one request at a time would
      // never saturate the connection
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

  // never hold the page hostage to the network
  setTimeout(function () { if (!revealed) { reveal(); fill(); } }, 7000);

  /* ------------------------------------------------------------- draw --- */

  function fit() {
    if (!cv || !ctx) return;
    var r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    // never render past the source art — extra device pixels buy nothing but
    // upscaling blur and fill cost
    var dpr = Math.min(w.devicePixelRatio || 1, 2, set.w / Math.max(1, r.width));
    dpr = Math.max(1, dpr);
    var cw = Math.round(r.width * dpr), ch = Math.round(r.height * dpr);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    box.w = cw; box.h = ch;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    lastDrawn = -1;
  }

  // nearest decoded neighbour, so a gap shows the closest real frame instead
  // of a hole
  function pick(i) {
    if (frames[i]) return frames[i];
    for (var k = 1; k < TOTAL; k++) {
      if (frames[i - k]) return frames[i - k];
      if (frames[i + k]) return frames[i + k];
    }
    return null;
  }

  /* Pointer parallax. The reel is a fixed camera, so the life has to come
     from the frame around it: the art drifts a few pixels against the pointer
     and the aura light follows it. Idle or touch, it breathes on its own. */
  var px = 0, py = 0, tx = 0, ty = 0, idle = 0, hasPointer = false;

  function onPointer(e) {
    var r = cv.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - .5) * 2;
    ty = ((e.clientY - r.top) / r.height - .5) * 2;
    hasPointer = true; idle = 0;
  }

  function draw(i, force) {
    if (!ctx || !box.w) return;
    i = Math.max(0, Math.min(TOTAL - 1, Math.round(i)));
    var key = i + ':' + (px * 60 | 0) + ':' + (py * 60 | 0);
    if (key === lastDrawn && !force) return;
    var img = pick(i);
    if (!img) return;
    lastDrawn = key;

    var iw = img.width, ih = img.height;
    if (!iw || !ih) return;

    // cover fit, with a little headroom so the parallax shift never exposes
    // an edge
    var over = 1.045;
    var s = Math.max(box.w / iw, box.h / ih) * over;
    var dw = iw * s, dh = ih * s;
    var mx = (dw - box.w) * .5, my = (dh - box.h) * .5;
    var dx = -mx - px * Math.min(mx, box.w * .012);
    var dy = -my - py * Math.min(my, box.h * .012);

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, box.w, box.h);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /* ------------------------------------------------------------ scene --- */

  var hero = d.getElementById('hero');
  var hint = d.getElementById('heroHint');

  if (hero && cv) {
    fit();

    if (!B.env.coarse) {
      w.addEventListener('pointermove', onPointer, { passive: true });
    }

    B.onResize(function () {
      var wasKey = setKey;
      setKey = pickSet();
      if (setKey !== wasKey) {
        // orientation crossed over: release the old bitmaps and refill
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

        // the reel owns the first 78% of the pin; the tail is the outro copy
        var ft = B.clamp(t / 0.78, 0, 1);
        target = ft * (TOTAL - 1);

        if (B.env.reduce) cur = target;
        else cur += (target - cur) * B.damp(0.26, dt || 1 / 60);

        /* Pointer easing, plus an idle drift so the shot still breathes when
           the mouse is parked. Touch devices get neither: there is no pointer
           to follow, and drifting for its own sake meant the redraw key
           changed on every single frame — which is what turned a static hero
           into a full canvas repaint sixty times a second on a phone. */
        if (!B.env.coarse) {
          if (!hasPointer) {
            var now = performance.now() / 1000;
            tx = Math.sin(now * 0.32) * 0.5;
            ty = Math.cos(now * 0.24) * 0.35;
          } else {
            idle += dt || 1 / 60;
            if (idle > 3) { tx *= 0.985; ty *= 0.985; }
          }
          var k = B.env.reduce ? 1 : B.damp(0.09, dt || 1 / 60);
          px += (tx - px) * k;
          py += (ty - py) * k;
        }

        if (aura && !B.env.coarse) {
          aura.style.setProperty('--ax', (50 + px * 26).toFixed(2) + '%');
          aura.style.setProperty('--ay', (46 + py * 22).toFixed(2) + '%');
        }
        if (aura) {
          // the light fades out as the laptop takes over the frame
          aura.style.opacity = (1 - B.clamp(t * 2.4, 0, 1)).toFixed(3);
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

  bumpBoot();
  seed();

  B.hero = {
    progress: function () { return TOTAL > 1 ? cur / (TOTAL - 1) : 0; },
    ready: function () { return decoded; },
    total: function () { return TOTAL; }
  };
})(window, document);
