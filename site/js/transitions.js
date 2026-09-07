/* ==========================================================================
   БАЗА — transitions between universes.
   Each .tr band is a scroll-scrubbed set piece. The *backgrounds* already
   cross-blend underneath (see the stage director in app.js); these add the
   drama on top, so a boundary reads as one continuous move, not a cut.
   ========================================================================== */
(function (w, d) {
  'use strict';
  var B = w.BAZA, E = B.env;
  var $ = B.$, $$ = B.$$, clamp = B.clamp, ss = B.ease.ss, eout = B.ease.out;

  // Scrub helper: gives a 0..1 progress across a .tr band.
  function scrub(sel, fn, opts) {
    var band = $(sel);
    if (!band) return null;
    return B.scene({
      el: band, name: 'tr' + sel, margin: (opts && opts.margin) || 0.15,
      enter: function (s, r) {
        band.classList.add('is-live');
        if (opts && opts.enter) opts.enter(s, r);
      },
      exit: function (s, r) {
        // a .tr holds position:fixed children; leaving them visible after the
        // band has passed would paste them over the rest of the page
        band.classList.remove('is-live');
        if (opts && opts.exit) opts.exit(s, r);
      },
      resize: opts && opts.resize,
      update: function (p, r, s) {
        var vh = w.innerHeight;
        // raw: 0 when the band's top reaches the viewport bottom, 1 when its
        // bottom leaves the top. The band only *owns* the screen through the
        // middle of that range, so the effect is mapped onto just that window
        // and is empty while the band is merely sliding past.
        var raw = clamp((vh - r.top) / (r.height + vh), 0, 1);
        var t = clamp((raw - 0.22) / 0.56, 0, 1);
        // edge envelope: nothing is left painted in the slivers at either end
        s.env = Math.min(ss(clamp(raw / 0.24, 0, 1)), ss(clamp((1 - raw) / 0.24, 0, 1)));
        fn(t, r, s);
      }
    });
  }

  // Canvas transition helper — fits lazily, paints only while on screen.
  function trCanvas(sel) {
    var cv = $(sel);
    if (!cv) return null;
    var ctx = cv.getContext('2d');
    var o = { cv: cv, ctx: ctx, w: 0, h: 0, _o: -1 };
    o.env = function (v) {
      v = Math.round(clamp(v, 0, 1) * 100) / 100;
      if (v !== o._o) { o._o = v; cv.style.opacity = v; }
    };
    o.fit = function () {
      var r = cv.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      var dpr = Math.min(w.devicePixelRatio || 1, E.lite ? 1.1 : 1.5);
      var cw = Math.round(r.width * dpr), ch = Math.round(r.height * dpr);
      if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      o.w = r.width; o.h = r.height;
      return true;
    };
    B.onResize(function () { o.w = 0; });
    return o;
  }

  /* ====================================================================== */
  /*  1 · HERO → MARIO — dive down the pipe                                 */
  /* ====================================================================== */

  (function () {
    var band = $('[data-tr="pipe"]');
    if (!band) return;
    var pipe = band.querySelector('.tr__pipe');
    var dark = band.querySelector('.tr__pipeDark');
    var played = false;

    scrub('[data-tr="pipe"]', function (t) {
      // 0 → .42 : ground and pipe rise out of the dark
      var rise = ss(clamp(t / 0.42, 0, 1));
      // .42 → 1 : the camera falls into the mouth
      var dive = ss(clamp((t - 0.42) / 0.58, 0, 1));

      if (pipe) {
        var sc = 1 + dive * 7;
        pipe.style.transform =
          'translate3d(-50%,' + ((1 - rise) * 100).toFixed(2) + '%,0) scale(' + sc.toFixed(3) + ')';
        pipe.style.opacity = (1 - clamp((t - 0.72) / 0.18, 0, 1)).toFixed(3);
      }
      if (dark) {
        // the hole opens out of the mouth, swallows the frame, then clears to
        // leave Mario's world behind it — fading out rather than being clipped
        // by the pinned box as the band exits
        var ds = dive * dive * 1.35;
        dark.style.transform = 'translate3d(-50%,-50%,0) scale(' + ds.toFixed(3) + ')';
        dark.style.opacity = (1 - clamp((t - 0.8) / 0.2, 0, 1)).toFixed(3);
      }

      if (!played && t > 0.4 && t < 0.9) { played = true; B.audio.sfx('pipe'); }
      if (t < 0.15) played = false;
    });
  })();

  /* ====================================================================== */
  /*  2 · MARIO → MATRIX — the pixels come loose and fall as code           */
  /* ====================================================================== */

  (function () {
    var C = trCanvas('#dissolveC');
    if (!C) return;
    var cells = null, cols = 0, rows = 0;

    function build() {
      cols = Math.max(10, Math.round(C.w / (E.lite ? 34 : 24)));
      rows = Math.max(8, Math.round(C.h / (E.lite ? 34 : 24)));
      cells = [];
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          cells.push({
            x: x, y: y,
            d: Math.random() * .45 + (y / rows) * .35,   // when it lets go
            sp: .6 + Math.random() * .9,
            rot: (Math.random() - .5) * 4
          });
        }
      }
    }

    scrub('[data-tr="dissolve"]', function (t, r, sc) {
      C.env(sc.env);
      if (sc.env <= 0.005) return;
      if (!C.w && !C.fit()) return;
      if (!cells) build();
      var ctx = C.ctx, W = C.w, H = C.h;
      ctx.clearRect(0, 0, W, H);
      var cw = W / cols, ch = H / rows;
      var e = ss(t);

      ctx.font = Math.max(9, cw * .6) + 'px "JetBrains Mono",monospace';
      ctx.textAlign = 'center';

      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        var lp = clamp((e - c.d) / .5, 0, 1);        // this cell's own progress
        if (lp <= 0 || lp >= 1) continue;
        var fall = lp * lp * H * 1.25 * c.sp;
        var a = 1 - lp;
        var px = c.x * cw + cw / 2;
        var py = c.y * ch + fall;
        if (py > H + ch) continue;
        // colour drains from sky-blue to matrix green as it falls
        var g = Math.round(92 + (0 - 92) * lp);
        var gg = Math.round(148 + (255 - 148) * lp);
        var bb = Math.round(252 + (65 - 252) * lp);
        if (lp < .5) {
          ctx.fillStyle = 'rgba(' + g + ',' + gg + ',' + bb + ',' + a + ')';
          ctx.fillRect(px - cw / 2, py, cw + 1, ch + 1);
        } else {
          ctx.fillStyle = 'rgba(0,255,65,' + a + ')';
          ctx.fillText('01ア#$'[(i + (fall | 0)) % 5], px, py + ch * .8);
        }
      }
    }, { resize: function () { cells = null; } });
  })();

  /* ====================================================================== */
  /*  3 · MATRIX → TIKTOK — signal lock                                     */
  /* ====================================================================== */

  (function () {
    var band = $('[data-tr="lock"]');
    if (!band) return;
    var scan = band.querySelector('.tr__scan');
    var frame = band.querySelector('.tr__lockFrame');
    var txt = band.querySelector('.tr__lockTxt');

    scrub('[data-tr="lock"]', function (t) {
      var e = ss(t);
      if (scan) {
        scan.style.transform = 'translate3d(0,' + (-100 + e * 200) + '%,0)';
        scan.style.opacity = String(Math.sin(e * Math.PI));
      }
      if (frame) {
        // the frame closes in from the full viewport to a phone
        var k = ss(clamp((t - .2) / .6, 0, 1));
        frame.style.transform = 'scale(' + (1.6 - k * 0.6) + ')';
        frame.style.opacity = String(Math.sin(clamp(t, 0, 1) * Math.PI) * .9);
      }
      if (txt) txt.style.opacity = String(Math.sin(clamp((t - .15) / .7, 0, 1) * Math.PI));
    });
  })();

  /* ====================================================================== */
  /*  4 · TIKTOK → TETRIS — the interface breaks into blocks and stacks     */
  /* ====================================================================== */

  (function () {
    var C = trCanvas('#shatterC');
    if (!C) return;
    var bits = null;
    var COL = ['#00e5ff', '#ffd400', '#b14cff', '#00e07a', '#ff4d6d', '#ff8a1f', '#3d7bff'];

    function build() {
      bits = [];
      var n = E.lite ? 26 : 54;
      for (var i = 0; i < n; i++) {
        var lane = i % 8;
        bits.push({
          x0: .06 + (lane / 8) * .88 + Math.random() * .04,
          y0: -.1 + Math.random() * .35,
          rest: .96 - Math.floor(i / 8) * .07,      // where it comes to rest
          d: Math.random() * .3,
          w: .07 + Math.random() * .05,
          h: .045,
          col: COL[i % COL.length],
          rot: (Math.random() - .5) * 1.6
        });
      }
    }

    scrub('[data-tr="shatter"]', function (t, r, sc) {
      C.env(sc.env);
      if (sc.env <= 0.005) return;
      if (!C.w && !C.fit()) return;
      if (!bits) build();
      var ctx = C.ctx, W = C.w, H = C.h;
      ctx.clearRect(0, 0, W, H);
      var e = ss(t);

      for (var i = 0; i < bits.length; i++) {
        var b = bits[i];
        var lp = clamp((e - b.d) / .62, 0, 1);
        if (lp <= 0) continue;
        var y = b.y0 + (b.rest - b.y0) * eout(lp);
        var rot = b.rot * (1 - eout(lp));
        var a = clamp(lp * 3, 0, 1) * (1 - clamp((t - .82) / .18, 0, 1));
        if (a <= 0) continue;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(b.x0 * W, y * H);
        ctx.rotate(rot);
        ctx.fillStyle = b.col;
        ctx.fillRect(-b.w * W / 2, -b.h * H / 2, b.w * W, b.h * H);
        ctx.fillStyle = 'rgba(255,255,255,.28)';
        ctx.fillRect(-b.w * W / 2, -b.h * H / 2, b.w * W, b.h * H * .22);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }, { resize: function () { bits = null; } });
  })();

  /* ====================================================================== */
  /*  5 · TETRIS → FLAPPY — line clear, then open sky                       */
  /* ====================================================================== */

  (function () {
    var band = $('[data-tr="clear"]');
    if (!band) return;
    var flash = band.querySelector('.tr__clearFlash');
    var rows = $$('.tr__clearRows i', band);
    var rang = false;

    scrub('[data-tr="clear"]', function (t) {
      var e = ss(t);
      rows.forEach(function (r, i) {
        var lp = clamp((e - i * .07) / .5, 0, 1);
        r.style.transform = 'scaleX(' + (1 - eout(lp)) + ')';
        r.style.opacity = String(clamp(e * 4, 0, 1) * (1 - lp * .3));
      });
      if (flash) {
        var f = Math.sin(clamp((t - .28) / .34, 0, 1) * Math.PI);
        flash.style.opacity = String(f * .85);
      }
      if (!rang && t > .3 && t < .8) { rang = true; B.audio.sfx('clear'); }
      if (t < .15) rang = false;
    });
  })();

  /* ====================================================================== */
  /*  6 · FLAPPY → SHREK — the swamp splashes up                            */
  /* ====================================================================== */

  (function () {
    var C = trCanvas('#splashC');
    if (!C) return;
    var blobs = null, rang = false;

    function build() {
      blobs = [];
      var n = E.lite ? 9 : 16;
      for (var i = 0; i < n; i++) {
        blobs.push({
          x: (i + .5) / n + (Math.random() - .5) * .05,
          r: .1 + Math.random() * .16,
          d: Math.random() * .26,
          up: .55 + Math.random() * .5
        });
      }
    }

    scrub('[data-tr="splash"]', function (t, r, sc) {
      C.env(sc.env);
      if (sc.env <= 0.005) return;
      if (!C.w && !C.fit()) return;
      if (!blobs) build();
      var ctx = C.ctx, W = C.w, H = C.h;
      ctx.clearRect(0, 0, W, H);
      var e = ss(t);

      // the rising mud floor
      var floor = H * (1.15 - e * 1.35);
      ctx.fillStyle = '#2d4a12';
      ctx.beginPath();
      ctx.moveTo(0, H + 10);
      ctx.lineTo(0, floor);
      for (var x = 0; x <= W; x += 40) {
        ctx.quadraticCurveTo(x + 20, floor + Math.sin(x * .02 + e * 6) * 16, x + 40, floor);
      }
      ctx.lineTo(W, H + 10);
      ctx.closePath();
      ctx.fill();

      // thrown droplets
      for (var i = 0; i < blobs.length; i++) {
        var b = blobs[i];
        var lp = clamp((e - b.d) / .6, 0, 1);
        if (lp <= 0 || lp >= 1) continue;
        var arc = Math.sin(lp * Math.PI);
        var by = floor - arc * H * b.up * .6;
        var r = b.r * Math.min(W, H) * .34 * (1 - lp * .35);
        ctx.fillStyle = 'rgba(58,90,26,' + (1 - lp * .5) + ')';
        ctx.beginPath();
        ctx.ellipse(b.x * W, by, r, r * (1 + lp * .3), 0, 0, 6.2832);
        ctx.fill();
      }

      if (!rang && t > .34 && t < .8) { rang = true; B.audio.sfx('splat'); }
      if (t < .18) rang = false;
    }, { resize: function () { blobs = null; } });
  })();

  /* ====================================================================== */
  /*  7 · SHREK → STRANGE — sparks spiral into the ring                     */
  /* ====================================================================== */

  (function () {
    var C = trCanvas('#sparksC');
    if (!C) return;
    var ps = null;

    function build() {
      ps = [];
      var n = E.lite ? 70 : 170;
      for (var i = 0; i < n; i++) {
        ps.push({
          a0: Math.random() * 6.2832,
          r0: .6 + Math.random() * .9,
          turns: 1.2 + Math.random() * 1.6,
          d: Math.random() * .4,
          sz: .8 + Math.random() * 2
        });
      }
    }

    scrub('[data-tr="sparks"]', function (t, r, sc) {
      C.env(sc.env);
      if (sc.env <= 0.005) return;
      if (!C.w && !C.fit()) return;
      if (!ps) build();
      var ctx = C.ctx, W = C.w, H = C.h;
      ctx.clearRect(0, 0, W, H);
      var e = ss(t);
      var cx = W / 2, cy = H / 2;
      var R = Math.min(W, H) * .42;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        var lp = clamp((e - p.d) / .62, 0, 1);
        if (lp <= 0) continue;
        var k = eout(lp);
        var r = R * (p.r0 - (p.r0 - .92) * k);
        var a = p.a0 + p.turns * k * 6.2832;
        var x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .8;
        var al = Math.sin(lp * Math.PI) * .9;
        ctx.fillStyle = 'rgba(255,' + (140 + 80 * (1 - lp) | 0) + ',50,' + al + ')';
        ctx.fillRect(x, y, p.sz, p.sz);
      }
      // the ring they land on
      var ring = clamp((e - .55) / .45, 0, 1);
      if (ring > 0) {
        ctx.strokeStyle = 'rgba(255,150,45,' + (ring * .55) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, R * .92, R * .74, 0, 0, 6.2832);
        ctx.stroke();
      }
      ctx.restore();
    }, { resize: function () { ps = null; } });
  })();

  /* ====================================================================== */
  /*  8 · STRANGE → BRIEF — the portal contracts to a clean sheet           */
  /* ====================================================================== */

  (function () {
    var band = $('[data-tr="iris"]');
    if (!band) return;
    var disc = band.querySelector('.tr__irisDisc');
    scrub('[data-tr="iris"]', function (t) {
      if (!disc) return;
      var e = ss(t);
      // a cream disc grows until it owns the screen — the brief arrives lit
      var s = e * 2.6;
      disc.style.transform = 'translate3d(-50%,-50%,0) scale(' + s + ')';
      // it hands the screen to the brief, then gets out of the way entirely
      disc.style.opacity = String(clamp(e * 5, 0, 1) * (1 - clamp((t - 0.78) / 0.22, 0, 1)));
    });
  })();

  /* ====================================================================== */
  /*  9 · BRIEF → UPSIDE DOWN — gravity gives up                            */
  /* ====================================================================== */

  (function () {
    var C = trCanvas('#flipC');
    if (!C) return;
    var band = $('[data-tr="flip"]');
    var txt = band ? band.querySelector('.tr__flipTxt') : null;
    var mots = null, rang = false;

    function build() {
      mots = [];
      var n = E.lite ? 26 : 64;
      for (var i = 0; i < n; i++) {
        mots.push({
          x: Math.random(), y: Math.random(),
          d: Math.random() * .4, sp: .5 + Math.random(),
          sz: .8 + Math.random() * 2.4
        });
      }
    }

    scrub('[data-tr="flip"]', function (t, r, sc) {
      C.env(sc.env);
      if (sc.env <= 0.005) return;
      if (!C.w && !C.fit()) return;
      if (!mots) build();
      var ctx = C.ctx, W = C.w, H = C.h;
      ctx.clearRect(0, 0, W, H);
      var e = ss(t);

      // the cream sheet peels away downward, dark bleeds in from the top
      ctx.fillStyle = 'rgba(5,7,12,' + clamp(e * 1.4, 0, 1) + ')';
      ctx.fillRect(0, 0, W, H * e * 1.25);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < mots.length; i++) {
        var m = mots[i];
        var lp = clamp((e - m.d) / .6, 0, 1);
        if (lp <= 0) continue;
        // everything drifts up: down here that is the normal direction
        var y = (m.y - lp * m.sp * .9) * H;
        if (y < -20) continue;
        var a = Math.sin(lp * Math.PI) * .5;
        var x = (m.x + Math.sin(lp * 6 + i) * .02) * W;
        B.blitGlow(ctx, '200,216,228', x, y, m.sz * 8, a);
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      if (txt) txt.style.opacity = String(Math.sin(clamp((t - .2) / .6, 0, 1) * Math.PI) * .8);
      if (!rang && t > .4 && t < .85) { rang = true; B.audio.sfx('upside'); }
      if (t < .2) rang = false;
    }, { resize: function () { mots = null; } });
  })();

  /* ====================================================================== */
  /*  10 · UPSIDE DOWN → STAR WARS — the floor drops, stars stretch         */
  /* ====================================================================== */

  (function () {
    var C = trCanvas('#warpC');
    if (!C) return;
    var st = null;

    function build() {
      st = [];
      var n = E.lite ? 80 : 190;
      for (var i = 0; i < n; i++) {
        st.push({ a: Math.random() * 6.2832, r: Math.random(), z: .3 + Math.random() * .7 });
      }
    }

    scrub('[data-tr="warp"]', function (t, r, sc) {
      C.env(sc.env);
      if (sc.env <= 0.005) return;
      if (!C.w && !C.fit()) return;
      if (!st) build();
      var ctx = C.ctx, W = C.w, H = C.h;
      ctx.clearRect(0, 0, W, H);
      var e = ss(t);
      ctx.fillStyle = 'rgba(0,0,0,' + clamp(e * 1.6, 0, 1) + ')';
      ctx.fillRect(0, 0, W, H);

      var cx = W / 2, cy = H / 2;
      var maxR = Math.hypot(cx, cy);
      ctx.strokeStyle = 'rgba(255,255,255,.75)';
      ctx.lineCap = 'round';
      for (var i = 0; i < st.length; i++) {
        var s = st[i];
        var r = (s.r + e * 1.3 * s.z) % 1;
        var len = e * e * 90 * s.z;
        var x0 = cx + Math.cos(s.a) * r * maxR;
        var y0 = cy + Math.sin(s.a) * r * maxR;
        var x1 = cx + Math.cos(s.a) * (r * maxR + len);
        var y1 = cy + Math.sin(s.a) * (r * maxR + len);
        ctx.globalAlpha = clamp(e * 1.4, 0, 1) * (.25 + s.z * .6);
        ctx.lineWidth = s.z * 1.6;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }, { resize: function () { st = null; } });
  })();

})(window, document);
