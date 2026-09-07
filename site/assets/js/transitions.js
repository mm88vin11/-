/* ===== transitions.js ===== */
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
      update: function (p, r, s, dt) {
        var vh = w.innerHeight;
        var t, env;

        if (opts && opts.pin) {
          /* Pinned bands hold a sticky, full-viewport child. That child only
             owns the screen between the moment the band's top reaches 0 and
             the moment its bottom does — outside that window the child is
             parked at one end of the band with a hard edge across the
             viewport. Mapping the shot onto exactly that window is what
             keeps the set piece full-bleed from its first frame to its last. */
          var span = Math.max(1, r.height - vh);
          t = clamp(-r.top / span, 0, 1);
          // only the slimmest fade at the very ends, to hide the unpin
          env = Math.min(ss(clamp(t / 0.05, 0, 1)), ss(clamp((1 - t) / 0.05, 0, 1)));
        } else {
          // raw: 0 when the band's top reaches the viewport bottom, 1 when its
          // bottom leaves the top. The band only *owns* the screen through the
          // middle of that range, so the effect is mapped onto just that window
          // and is empty while the band is merely sliding past.
          var raw = clamp((vh - r.top) / (r.height + vh), 0, 1);
          t = clamp((raw - 0.22) / 0.56, 0, 1);
          // edge envelope: nothing is left painted in the slivers at either end
          env = Math.min(ss(clamp(raw / 0.24, 0, 1)), ss(clamp((1 - raw) / 0.24, 0, 1)));
        }
        /* A faded-out band still costs whatever its painter costs. The pipe
           alone was drawing twenty-six gradient rings per frame at opacity
           zero while the visitor was two screens into the Mario section,
           because the scene stays live inside its margin. One clearing pass
           at the moment it reaches zero, then nothing until it matters. */
        if (env <= 0.004) {
          if (s.__blank) return;
          s.__blank = 1;
          s.env = 0;
          fn(t, r, s, dt);
          return;
        }
        s.__blank = 0;
        s.env = env;
        fn(t, r, s, dt);
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
  /* ---------------------------------------------------------------------- */
  /*  The old version was three CSS gradients on a scaling div: a flat green
      rectangle that grew until it left the frame, which read as a zoom on a
      sticker rather than as going anywhere. This is one canvas shot in four
      beats — the world builds, the camera walks up to the mouth, we fall
      through a real tunnel with perspective, and the far end opens into
      world 1-1. Nothing is scaled up past its own resolution, so there is
      nothing to go soft.                                                    */
  /* ====================================================================== */

  (function () {
    var C = trCanvas('#pipeC');
    if (!C) return;
    var played = false;

    // how many wall bands live in the tunnel at once
    var RINGS = E.lite ? 16 : 26;

    /* ---- beat 1+2: the world, the pipe, the walk-up ---------------------- */

    function drawWorld(c, W, H, build, push) {
      // sky rises out of black
      var sky = c.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#5c94fc');
      sky.addColorStop(0.62, '#7fb2ff');
      sky.addColorStop(1, '#a8ceff');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      if (build < 1) {
        c.fillStyle = 'rgba(10,10,10,' + (1 - build).toFixed(3) + ')';
        c.fillRect(0, 0, W, H);
      }

      var gh = Math.max(58, H * 0.13);
      var gy = H - gh;

      // clouds drift in from the right as the world assembles
      c.save();
      c.globalAlpha = build;
      c.fillStyle = '#fff';
      for (var k = 0; k < 3; k++) {
        var cx = W * (0.18 + k * 0.31) + (1 - build) * W * 0.5;
        var cy = H * (0.16 + (k % 2) * 0.1);
        var r = (16 + k * 5) * (W / 1200 + 0.5);
        c.beginPath();
        c.arc(cx, cy, r, 0, 6.2832);
        c.arc(cx + r, cy - r * .35, r * .82, 0, 6.2832);
        c.arc(cx + r * 2, cy, r * .7, 0, 6.2832);
        c.fill();
      }
      c.restore();

      // ground slides up into place
      var slide = (1 - ss(clamp(build * 1.25, 0, 1))) * gh * 1.4;
      c.save();
      c.translate(0, slide);
      c.fillStyle = '#e39a48';
      c.fillRect(0, gy, W, gh + slide + 4);
      c.fillStyle = 'rgba(0,0,0,.13)';
      var bw = 42, bh = gh / 2;
      for (var yy = 0; yy < 2; yy++) {
        for (var xx = -1; xx * bw < W + bw; xx++) {
          c.fillRect(xx * bw + (yy % 2 ? bw / 2 : 0) + 1, gy + yy * bh + 1, bw - 2, bh - 2);
        }
      }
      c.restore();

      return { gy: gy + slide, gh: gh };
    }

    /* The pipe, drawn as a real cylinder: a vertical body with a banded
       gradient across it, a wider lip, and an elliptical mouth whose inside
       is genuinely dark and shaded, not a flat black blob. */
    function drawPipe(c, cx, gy, pw, ph, mouthOpen) {
      var lipW = pw * 1.16;
      var lipH = Math.max(26, pw * 0.28);
      var top = gy - ph;

      function bandFill(x0, x1) {
        var g = c.createLinearGradient(x0, 0, x1, 0);
        g.addColorStop(0.00, '#1d4a0a');
        g.addColorStop(0.16, '#4e9b1e');
        g.addColorStop(0.30, '#9ee855');
        g.addColorStop(0.46, '#6cc02f');
        g.addColorStop(0.72, '#3d7a17');
        g.addColorStop(1.00, '#173f07');
        return g;
      }

      // body
      c.fillStyle = bandFill(cx - pw / 2, cx + pw / 2);
      c.fillRect(cx - pw / 2, top + lipH * 0.6, pw, ph);

      // lip
      c.fillStyle = bandFill(cx - lipW / 2, cx + lipW / 2);
      c.beginPath();
      if (c.roundRect) c.roundRect(cx - lipW / 2, top, lipW, lipH, 7);
      else c.rect(cx - lipW / 2, top, lipW, lipH);
      c.fill();

      // lip underside shadow, so the lip sits proud of the body
      c.fillStyle = 'rgba(0,0,0,.30)';
      c.fillRect(cx - pw / 2, top + lipH, pw, Math.max(3, lipH * 0.14));

      // mouth: an ellipse with a shaded inner wall and a dark throat
      var mrx = lipW * 0.42, mry = Math.max(7, lipH * 0.40) * mouthOpen;
      var my = top + lipH * 0.30;
      var mg = c.createRadialGradient(cx, my, 1, cx, my, mrx);
      mg.addColorStop(0, '#000');
      mg.addColorStop(0.55, '#04140a');
      mg.addColorStop(1, '#0d2a10');
      c.fillStyle = mg;
      c.beginPath();
      c.ellipse(cx, my, mrx, mry, 0, 0, 6.2832);
      c.fill();
      // rim light along the top of the mouth
      c.strokeStyle = 'rgba(190,255,140,.45)';
      c.lineWidth = Math.max(1, mrx * 0.03);
      c.beginPath();
      c.ellipse(cx, my, mrx, mry, 0, Math.PI * 1.06, Math.PI * 1.94);
      c.stroke();
    }

    /* A small pixel figure that walks to the pipe and drops in — the beat
       that turns a zoom into an action. Eight-bit on purpose: it reads at a
       glance and costs a dozen rectangles. */
    function drawGuy(c, x, y, px, phase, sink) {
      if (sink >= 1) return;
      c.save();
      c.translate(x, y);
      c.globalAlpha = 1 - sink;
      // sinking into the pipe clips him from the feet up
      c.beginPath();
      c.rect(-px * 6, -px * 16, px * 12, px * 16 * (1 - sink));
      c.clip();
      var step = Math.sin(phase * 9) > 0 ? 1 : -1;
      c.fillStyle = '#d43b25';                      // cap + shirt
      c.fillRect(-px * 3, -px * 16, px * 6, px * 3);
      c.fillRect(-px * 4, -px * 10, px * 8, px * 5);
      c.fillStyle = '#f0b088';                      // face
      c.fillRect(-px * 3, -px * 13, px * 6, px * 3);
      c.fillStyle = '#2c4bd0';                      // dungarees
      c.fillRect(-px * 3, -px * 6, px * 6, px * 4);
      c.fillStyle = '#5a2f10';                      // boots, alternating
      c.fillRect(-px * 3 + step * px, -px * 2, px * 3, px * 2);
      c.fillRect(px * 0 - step * px, -px * 2, px * 3, px * 2);
      c.restore();
    }

    /* ---- beat 3: inside the pipe ---------------------------------------- */
    /* Rings are placed in depth and projected with a real 1/z, so the ones
       far away crowd together and the near ones sweep past the camera. That
       spacing is the whole reason it reads as falling rather than zooming. */

    function drawTunnel(c, W, H, dive, roll) {
      var cx = W / 2, cy = H / 2;
      var f = Math.min(W, H) * 0.86;                // focal length
      var R = Math.min(W, H) * 0.52;                // tunnel radius

      c.save();
      c.translate(cx, cy);
      c.rotate(roll);
      c.translate(-cx, -cy);

      c.fillStyle = '#04120a';
      c.fillRect(0, 0, W, H);

      // travelled distance: eased so the fall accelerates, then holds
      var travel = dive * RINGS;

      for (var i = RINGS; i >= 0; i--) {
        var z = i - (travel % 1) - Math.floor(0) + 0.001;
        z = i + 0.6 - (travel % 1);
        if (z <= 0.12) continue;
        var scale = f / (z * f * 0.12 + f * 0.14);
        var rad = R * scale;
        if (rad < 2) continue;

        /* Alternating bands give the wall something to read as it rushes
           past; without them a smooth green tube looks static no matter how
           fast it moves. Brightness falls off with depth but never all the
           way to black, or the far half of the tunnel disappears. */
        var band = ((i + Math.floor(travel)) % 2) === 0;
        var lum = clamp(1.12 - (z / RINGS) * 0.92, 0.16, 1);
        var r0 = band ? 138 : 58, g0 = band ? 236 : 150, b0 = band ? 96 : 42;
        var ring = 'rgba(' + Math.round(r0 * lum) + ',' + Math.round(g0 * lum) +
          ',' + Math.round(b0 * lum) + ',1)';
        var deep = 'rgba(' + Math.round(14 * lum) + ',' + Math.round(48 * lum) +
          ',' + Math.round(12 * lum) + ',1)';
        var g = c.createRadialGradient(cx, cy, rad * 0.62, cx, cy, rad * 1.5);
        g.addColorStop(0, deep);
        g.addColorStop(0.30, ring);
        g.addColorStop(1, deep);
        c.fillStyle = g;
        c.beginPath();
        c.arc(cx, cy, rad * 1.45, 0, 6.2832);
        c.arc(cx, cy, rad * 0.72, 0, 6.2832, true);
        c.fill();

        // a bright seam on the leading edge of each band — this is what the
        // eye actually tracks as it sweeps outward
        c.strokeStyle = 'rgba(' + Math.round(200 * lum) + ',255,' +
          Math.round(170 * lum) + ',' + (0.34 * lum).toFixed(3) + ')';
        c.lineWidth = Math.max(0.6, rad * 0.012);
        c.beginPath();
        c.arc(cx, cy, rad * 0.72, 0, 6.2832);
        c.stroke();
      }

      // speed streaks — only while actually moving fast
      var sp = ss(clamp((dive - 0.08) / 0.5, 0, 1)) * (1 - ss(clamp((dive - 0.82) / 0.18, 0, 1)));
      if (sp > 0.02 && !E.lite) {
        c.strokeStyle = 'rgba(200,255,170,' + (0.16 * sp).toFixed(3) + ')';
        c.lineWidth = 1.4;
        for (var k = 0; k < 22; k++) {
          var a = (k / 22) * 6.2832 + dive * 3.1;
          var r0 = R * (0.34 + ((k * 37) % 60) / 100) * (0.5 + sp);
          var r1 = r0 + R * 0.5 * sp;
          c.beginPath();
          c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
          c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          c.stroke();
        }
      }

      // the far end: a bright disc that grows into the next world
      var out = ss(clamp((dive - 0.62) / 0.38, 0, 1));
      if (out > 0) {
        var orad = Math.max(W, H) * (0.02 + out * out * 1.15);
        var og = c.createRadialGradient(cx, cy, 0, cx, cy, orad);
        og.addColorStop(0, '#dff0ff');
        og.addColorStop(0.42, '#8fc0ff');
        og.addColorStop(0.8, 'rgba(92,148,252,' + (0.85 * out).toFixed(3) + ')');
        og.addColorStop(1, 'rgba(92,148,252,0)');
        c.fillStyle = og;
        c.beginPath();
        c.arc(cx, cy, orad, 0, 6.2832);
        c.fill();
      }
      c.restore();
    }

    /* ---- the shot -------------------------------------------------------- */

    scrub('[data-tr="pipe"]', function (t, r, sc) {
      if (!C.w && !C.fit()) return;
      C.env(sc.env);

      var c = C.ctx, W = C.w, H = C.h;
      c.clearRect(0, 0, W, H);

      var build = ss(clamp(t / 0.18, 0, 1));         // world assembles
      var walk = ss(clamp((t - 0.14) / 0.26, 0, 1));  // he walks up and hops in
      var push = ss(clamp((t - 0.40) / 0.14, 0, 1));  // camera pushes at the mouth
      var dive = clamp((t - 0.50) / 0.50, 0, 1);      // inside the pipe

      if (dive < 0.999 && push < 1) {
        // ---- outside: world + pipe, camera dollying toward the mouth
        var g = drawWorld(c, W, H, build, push);

        // dolly: scale about the mouth so the mouth stays put while the
        // world grows around it
        var pw0 = Math.min(W * 0.19, 250);
        var ph0 = H * 0.30;
        var zoom = 1 + push * 3.4;
        var cx = W / 2;
        var mouthY = g.gy - ph0;

        c.save();
        c.translate(cx, mouthY);
        c.scale(zoom, zoom);
        c.translate(-cx, -mouthY);

        // pipe rises out of the ground with a soft overshoot
        var rise = ss(clamp((t - 0.06) / 0.16, 0, 1));
        var ph = ph0 * (rise + Math.sin(rise * Math.PI) * 0.06);
        drawPipe(c, cx, g.gy + 2, pw0, ph, 0.45 + 0.55 * ss(clamp((t - 0.16) / 0.2, 0, 1)));

        /* The walk-in, in the order the game does it: along the ground to
           the foot of the pipe, a hop onto the lip, then down the throat.
           Walking straight into the mouth in mid-air was the thing that made
           the old shot look like a floating sticker. */
        if (walk > 0 && push < 0.75) {
          var px = Math.max(1.6, pw0 / 26);
          var startX = cx - W * 0.34;
          var footX = cx - pw0 * 0.86;
          var walkP = ss(clamp(walk / 0.62, 0, 1));
          var hopP = ss(clamp((walk - 0.58) / 0.30, 0, 1));
          var gx = startX + (footX - startX) * walkP + (cx - footX) * hopP;
          // a real parabola for the hop, landing exactly on the lip
          var gyFloor = g.gy + 2;
          var gyTop = g.gy + 2 - ph;
          var gy = gyFloor + (gyTop - gyFloor) * hopP
            - Math.sin(hopP * Math.PI) * ph * 0.30;
          var sink = clamp((walk - 0.90) / 0.10, 0, 1);
          drawGuy(c, gx, gy, px, walkP * 2.6, sink);
        }
        c.restore();

        // the mouth swallows the frame: a dark disc growing from it
        if (push > 0) {
          var dr = Math.max(W, H) * push * push * 1.5;
          var dg = c.createRadialGradient(W / 2, mouthY, 0, W / 2, mouthY, Math.max(dr, 1));
          dg.addColorStop(0, '#04120a');
          dg.addColorStop(0.72, '#04120a');
          dg.addColorStop(1, 'rgba(4,18,10,0)');
          c.fillStyle = dg;
          c.beginPath();
          c.arc(W / 2, mouthY, Math.max(dr, 1), 0, 6.2832);
          c.fill();
        }
      }

      if (dive > 0) {
        // ---- inside: the tunnel takes over, cross-faded over the mouth
        var fade = ss(clamp(dive / 0.10, 0, 1));
        c.save();
        c.globalAlpha = fade;
        // a slow roll sells the fall without making anyone seasick
        drawTunnel(c, W, H, ss(dive), Math.sin(dive * 3.0) * 0.12);
        c.restore();
      }

      if (!played && t > 0.46 && t < 0.9) { played = true; B.audio.sfx('pipe'); }
      if (t < 0.2) played = false;
    }, { pin: true, margin: 0.3, resize: function () { C.w = 0; } });
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

