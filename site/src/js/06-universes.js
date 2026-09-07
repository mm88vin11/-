
/* ==========================================================================
   БАЗА — the nine universes.
   Every backdrop is a canvas that only paints while its band is near the
   viewport, at a capped frame rate, at capped DPR.
   ========================================================================== */
(function (w, d) {
  'use strict';
  var B = w.BAZA, E = B.env, D = B.data;
  var $ = B.$, $$ = B.$$, clamp = B.clamp, lerp = B.lerp, ss = B.ease.ss;

  /* ====================================================================== */
  /*  Painter — canvas lifecycle shared by every backdrop                   */
  /* ====================================================================== */

  function Painter(sel, opts) {
    var cv = $(sel);
    if (!cv) return null;
    var ctx = cv.getContext('2d', { alpha: opts && opts.alpha !== false });
    var self = {
      cv: cv, ctx: ctx, w: 0, h: 0, dpr: 1,
      live: false, t: 0, acc: 0,
      fps: (opts && opts.fps) || (E.lite ? 30 : 60)
    };
    self.fit = function () {
      var r = cv.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      var dpr = Math.min(w.devicePixelRatio || 1, E.lite ? 1.1 : 1.5);
      var cw = Math.max(1, Math.round(r.width * dpr));
      var ch = Math.max(1, Math.round(r.height * dpr));
      if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      self.w = r.width; self.h = r.height; self.dpr = dpr;
      return true;
    };
    self.clear = function () { ctx.clearRect(0, 0, self.w, self.h); };
    return self;
  }

  // Registers a backdrop: fits on demand, ticks only while live.
  function backdrop(name, sel, api) {
    var P = Painter(sel, api.opts || {});
    if (!P) return;
    var bgEl = $('[data-bg="' + name + '"]');
    var inited = false;
    var minStep = 1 / P.fps;

    B.onResize(function () { if (P.live) { P.fit(); if (api.resize) api.resize(P); } });

    B.ticker.add(function (sy, dt) {
      if (!P.live) return;
      P.acc += dt;
      if (P.acc < minStep) return;
      var step = P.acc; P.acc = 0;
      P.t += step;
      api.draw(P, step, P.t);
    }, 5);

    return {
      set: function (on) {
        if (on === P.live) return;
        P.live = on;
        if (on) {
          if (!P.fit()) return;
          if (!inited) { if (api.init) api.init(P); inited = true; }
          if (api.resize) api.resize(P);
        }
      },
      el: bgEl, P: P
    };
  }

  var backdrops = (B.backdrops = {});

  /* A radial gradient built per particle per frame is the single most
     expensive thing these scenes could do. Build each falloff once into a
     small offscreen canvas and blit it instead. */
  var glowCache = {};
  var glow = (B.glow = function (rgb) {
    if (glowCache[rgb]) return glowCache[rgb];
    var S = 64;
    var cv = d.createElement('canvas');
    cv.width = cv.height = S;
    var c = cv.getContext('2d');
    var g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(' + rgb + ',1)');
    g.addColorStop(0.45, 'rgba(' + rgb + ',0.38)');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
    return (glowCache[rgb] = cv);
  });
  var blitGlow = (B.blitGlow = function (c, rgb, x, y, r, a) {
    if (a <= 0.004) return;
    var sp = glow(rgb);
    c.globalAlpha = a;
    c.drawImage(sp, x - r, y - r, r * 2, r * 2);
  });

  /* ====================================================================== */
  /*  01 · MARIO — sky, clouds, hills, brick ground                         */
  /* ====================================================================== */

  // the runner lives on the backdrop canvas so he stands on the real ground
  B.marioRun = { p: 0, live: false, dir: 1 };

  backdrops.mario = backdrop('mario', '[data-c="mario"]', {
    opts: { alpha: false, fps: E.lite ? 30 : 50 },
    init: function (P) {
      P.clouds = [];
      var n = E.lite ? 5 : 9;
      for (var i = 0; i < n; i++) {
        P.clouds.push({
          x: Math.random(), y: 0.08 + Math.random() * 0.34,
          s: 0.5 + Math.random() * 0.9, v: 0.004 + Math.random() * 0.008
        });
      }
      P.sky = null; P.tile = null; P.pat = null;
      P.hills = [];
      for (var j = 0; j < 6; j++) {
        P.hills.push({ x: j / 6 + Math.random() * .08, s: .6 + Math.random() * .7 });
      }
    },
    draw: function (P, dt) {
      var c = P.ctx, W = P.w, H = P.h;
      var sy = B.scrollY;

      /* Sky and ground are the two full-width fills in this scene and neither
         changes shape between frames. Building the gradient and re-laying the
         brick grid every frame was most of the cost of this backdrop on a
         phone; both are baked into offscreen strips instead and blitted. */
      if (!P.sky || P.skyW !== W || P.skyH !== H) {
        P.sky = P.sky || d.createElement('canvas');
        P.sky.width = 8; P.sky.height = Math.max(2, Math.round(H));
        var sc = P.sky.getContext('2d');
        var sg = sc.createLinearGradient(0, 0, 0, P.sky.height);
        sg.addColorStop(0, '#5c94fc');
        sg.addColorStop(0.62, '#7fb2ff');
        sg.addColorStop(1, '#a8ceff');
        sc.fillStyle = sg; sc.fillRect(0, 0, 8, P.sky.height);
        P.skyW = W; P.skyH = H;
        P.tile = null;
      }
      c.drawImage(P.sky, 0, 0, 8, P.sky.height, 0, 0, W, H);

      // clouds — drift + gentle scroll parallax
      c.fillStyle = 'rgba(255,255,255,.92)';
      for (var i = 0; i < P.clouds.length; i++) {
        var cl = P.clouds[i];
        cl.x += cl.v * dt;
        if (cl.x > 1.25) cl.x = -0.25;
        var cx = cl.x * W;
        var cy = cl.y * H - (sy * 0.02 * cl.s) % (H * 1.5);
        cy = ((cy % (H * 1.4)) + H * 1.4) % (H * 1.4) - H * 0.2;
        puff(c, cx, cy, 24 * cl.s * (W / 900 + .5));
      }

      // ground band
      var gh = Math.max(58, H * 0.13);

      // hills sit on the ground line, not in the middle of the copy
      var hy = H - gh + 2;
      for (var j = 0; j < P.hills.length; j++) {
        var hl = P.hills[j];
        var hx = ((hl.x * W - sy * 0.05 * hl.s) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2;
        var hr = (34 + 30 * hl.s) * (W / 1400 + .55);
        c.fillStyle = j % 2 ? 'rgba(0,150,0,.5)' : 'rgba(0,170,20,.42)';
        c.beginPath();
        c.arc(hx, hy, hr, Math.PI, 0);
        c.fill();
      }

      var bw = 42, bh = gh / 2;
      if (!P.tile) {
        // one two-row brick period, drawn once and then repeated as a pattern
        P.tile = d.createElement('canvas');
        P.tile.width = bw; P.tile.height = Math.max(2, Math.round(gh));
        var tc = P.tile.getContext('2d');
        tc.fillStyle = '#e39a48';
        tc.fillRect(0, 0, bw, P.tile.height);
        tc.fillStyle = 'rgba(0,0,0,.13)';
        tc.fillRect(1, 1, bw - 2, bh - 2);
        tc.fillRect(1 - bw / 2, bh + 1, bw - 2, bh - 2);
        tc.fillRect(1 + bw / 2, bh + 1, bw - 2, bh - 2);
        tc.fillStyle = 'rgba(0,0,0,.2)';
        tc.fillRect(0, 0, bw, 3);
        P.pat = c.createPattern(P.tile, 'repeat-x');
      }
      var off = (sy * 0.16) % bw;
      c.save();
      c.translate(-off, H - gh);
      c.fillStyle = P.pat;
      c.fillRect(0, 0, W + bw * 2, gh);
      c.restore();

      if (B.marioRun.live) {
        var rx = 40 + B.marioRun.p * Math.max(0, W - 120);
        plumber(c, rx, H - gh, P.t, B.marioRun.dir);
      }
    }
  });

  // A small canvas character: cap, moustache, overalls, and a two-frame run.
  function plumber(c, x, groundY, t, dir) {
    var u = 3.2;                                   // one "pixel"
    var step = Math.sin(t * 9) > 0 ? 1 : 0;
    var bob = Math.abs(Math.sin(t * 9)) * u * 0.9;
    c.save();
    c.translate(x, groundY - bob);
    c.scale(dir, 1);
    c.translate(-6 * u, -15 * u);

    function px(cx, cy, cw, ch, col) {
      c.fillStyle = col;
      c.fillRect(cx * u, cy * u, cw * u, ch * u);
    }
    var RED = '#e52521', SKIN = '#f7c88c', BLUE = '#2f5fd0',
        BROWN = '#7a3b0e', SHOE = '#5a2c08', WHITE = '#fff';

    // shadow on the ground
    c.globalAlpha = .22; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(6 * u, 15.4 * u, 5.4 * u, 1.2 * u, 0, 0, 6.2832); c.fill();
    c.globalAlpha = 1;

    px(3, 0, 7, 2, RED);          // cap crown
    px(2, 2, 9, 1, RED);          // cap brim
    px(3, 3, 7, 3, SKIN);         // face
    px(8, 4, 1, 1, BROWN);        // eye
    px(3, 5, 5, 1, BROWN);        // moustache
    px(3, 6, 7, 1, BROWN);        // hair line
    px(3, 7, 7, 4, RED);          // shirt
    px(4, 8, 5, 3, BLUE);         // overalls
    px(5, 8, 1, 1, WHITE);        // buttons
    px(8, 8, 1, 1, WHITE);
    if (step) {                   // arms + legs, frame A
      px(1, 8, 2, 2, SKIN);
      px(10, 7, 2, 2, SKIN);
      px(4, 11, 2, 3, BLUE); px(7, 11, 2, 3, BLUE);
      px(3, 14, 3, 1, SHOE); px(7, 14, 3, 1, SHOE);
    } else {                      // frame B
      px(1, 7, 2, 2, SKIN);
      px(10, 8, 2, 2, SKIN);
      px(3, 11, 2, 3, BLUE); px(8, 11, 2, 3, BLUE);
      px(2, 14, 3, 1, SHOE); px(8, 14, 3, 1, SHOE);
    }
    c.restore();
  }

  function puff(c, x, y, r) {
    c.beginPath();
    c.arc(x, y, r, 0, 6.2832);
    c.arc(x + r * .85, y + r * .12, r * .78, 0, 6.2832);
    c.arc(x - r * .85, y + r * .14, r * .7, 0, 6.2832);
    c.arc(x + r * .3, y - r * .5, r * .66, 0, 6.2832);
    c.fill();
  }

  /* ====================================================================== */
  /*  02 · MATRIX — digital rain                                            */
  /* ====================================================================== */

  var GLYPH = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789БАЗАZ<>=/\\{}[]$#*+-';

  backdrops.matrix = backdrop('matrix', '[data-c="matrix"]', {
    opts: { alpha: false, fps: E.lite ? 24 : 32 },
    resize: function (P) {
      P.col = Math.max(14, Math.round(P.w / (E.lite ? 20 : 16)));
      P.cw = P.w / P.col;
      P.drop = new Float32Array(P.col);
      P.spd = new Float32Array(P.col);
      for (var i = 0; i < P.col; i++) {
        P.drop[i] = Math.random() * -60;
        P.spd[i] = 0.5 + Math.random() * 1.1;
      }
      P.ctx.textAlign = 'center';
    },
    draw: function (P, dt) {
      var c = P.ctx, W = P.w, H = P.h;
      if (!P.drop) return;
      // trail fade instead of a full clear
      c.fillStyle = 'rgba(4,8,5,.16)';
      c.fillRect(0, 0, W, H);

      var fs = Math.max(11, P.cw * 0.92);
      c.font = fs + 'px ' + '"JetBrains Mono",monospace';

      for (var i = 0; i < P.col; i++) {
        P.drop[i] += P.spd[i] * dt * 26;
        var y = P.drop[i] * fs;
        if (y > H + fs * 2) { P.drop[i] = Math.random() * -30; continue; }
        if (y < -fs) continue;
        var x = i * P.cw + P.cw / 2;
        var ch = GLYPH[(Math.random() * GLYPH.length) | 0];
        // leading glyph is bright, the tail behind it is dim
        c.fillStyle = 'rgba(190,255,210,.95)';
        c.fillText(ch, x, y);
        c.fillStyle = 'rgba(0,255,65,.45)';
        c.fillText(GLYPH[(Math.random() * GLYPH.length) | 0], x, y - fs);
        c.fillStyle = 'rgba(0,255,65,.18)';
        c.fillText(GLYPH[(Math.random() * GLYPH.length) | 0], x, y - fs * 2.2);
      }
    }
  });

  /* ====================================================================== */
  /*  04 · TETRIS — slow drifting tetromino silhouettes                     */
  /* ====================================================================== */

  var TET_C = ['#00e5ff', '#ffd400', '#b14cff', '#00e07a', '#ff4d6d', '#ff8a1f', '#3d7bff'];
  var TET_S = [
    [[1, 1, 1, 1]],
    [[1, 1], [1, 1]],
    [[0, 1, 0], [1, 1, 1]],
    [[1, 0, 0], [1, 1, 1]],
    [[0, 0, 1], [1, 1, 1]],
    [[1, 1, 0], [0, 1, 1]],
    [[0, 1, 1], [1, 1, 0]]
  ];

  backdrops.tetris = backdrop('tetris', '[data-c="tetris"]', {
    opts: { alpha: false, fps: E.lite ? 30 : 48 },
    init: function (P) {
      P.pieces = [];
      var n = E.lite ? 7 : 14;
      for (var i = 0; i < n; i++) P.pieces.push(newPiece(true));
    },
    draw: function (P, dt) {
      var c = P.ctx, W = P.w, H = P.h;
      var g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#070a1c');
      g.addColorStop(1, '#101635');
      c.fillStyle = g; c.fillRect(0, 0, W, H);

      // faint grid
      c.strokeStyle = 'rgba(255,255,255,.032)';
      c.lineWidth = 1;
      var cell = 44;
      c.beginPath();
      for (var x = 0; x < W; x += cell) { c.moveTo(x + .5, 0); c.lineTo(x + .5, H); }
      for (var y = 0; y < H; y += cell) { c.moveTo(0, y + .5); c.lineTo(W, y + .5); }
      c.stroke();

      for (var i = 0; i < P.pieces.length; i++) {
        var p = P.pieces[i];
        p.y += p.v * dt;
        p.rot += p.rv * dt;
        if (p.y > 1.3) { P.pieces[i] = newPiece(false); continue; }
        drawPiece(c, p, W, H);
      }
    }
  });

  function newPiece(spread) {
    var k = (Math.random() * TET_S.length) | 0;
    return {
      s: TET_S[k], col: TET_C[k],
      x: Math.random(), y: spread ? Math.random() * 1.2 - .2 : -0.25,
      v: 0.03 + Math.random() * 0.07,
      rot: Math.random() * 6.28, rv: (Math.random() - .5) * 0.5,
      sz: 12 + Math.random() * 20,
      a: 0.14 + Math.random() * 0.24
    };
  }

  function drawPiece(c, p, W, H) {
    var u = p.sz;
    c.save();
    c.translate(p.x * W, p.y * H);
    c.rotate(p.rot);
    c.globalAlpha = p.a;
    c.fillStyle = p.col;
    var rows = p.s.length, cols = p.s[0].length;
    for (var r = 0; r < rows; r++) {
      for (var q = 0; q < cols; q++) {
        if (!p.s[r][q]) continue;
        var bx = (q - cols / 2) * u, by = (r - rows / 2) * u;
        c.fillRect(bx + 1, by + 1, u - 2, u - 2);
      }
    }
    c.restore();
    c.globalAlpha = 1;
  }

  /* ====================================================================== */
  /*  05 · FLAPPY — flat sky + scrolling ground                             */
  /* ====================================================================== */

  backdrops.flappy = backdrop('flappy', '[data-c="flappy"]', {
    opts: { alpha: false, fps: E.lite ? 30 : 50 },
    init: function (P) {
      P.cl = [];
      for (var i = 0; i < (E.lite ? 4 : 7); i++)
        P.cl.push({ x: Math.random(), y: .1 + Math.random() * .4, s: .5 + Math.random(), v: .01 + Math.random() * .02 });
    },
    draw: function (P, dt) {
      var c = P.ctx, W = P.w, H = P.h;
      var g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#4ec0ca');
      g.addColorStop(.7, '#7ad4dc');
      g.addColorStop(1, '#cfeef1');
      c.fillStyle = g; c.fillRect(0, 0, W, H);

      c.fillStyle = 'rgba(255,255,255,.75)';
      for (var i = 0; i < P.cl.length; i++) {
        var cl = P.cl[i];
        cl.x += cl.v * dt;
        if (cl.x > 1.2) cl.x = -.2;
        puff(c, cl.x * W, cl.y * H, 20 * cl.s * (W / 900 + .5));
      }

      var gh = Math.max(52, H * .12);

      /* Distant skyline. Flappy Bird has one, and without it this band was a
         flat wall of cyan with a pipe in the middle — three quarters of the
         frame doing nothing. It parallaxes slower than the bushes, which is
         what gives the flight any sense of speed at all. */
      var sk = H - gh;
      var so2 = (B.scrollY * .09) % 260;
      c.fillStyle = 'rgba(122,196,196,.55)';
      for (var bx2 = -260; bx2 < W + 260; bx2 += 260) {
        var o = bx2 - so2;
        // one repeating block of towers, drawn from a fixed silhouette so it
        // tiles seamlessly
        var towers = [[0, 54], [34, 92], [72, 40], [98, 118], [136, 66],
                      [170, 100], [206, 48], [232, 78]];
        for (var ti = 0; ti < towers.length; ti++) {
          var tw = towers[ti];
          var hgt = tw[1] * (H / 900 + .45);
          c.fillRect(o + tw[0], sk - hgt, 26, hgt);
        }
      }
      // a haze band so the skyline sits behind the play area rather than in it
      var hz = c.createLinearGradient(0, sk - H * .22, 0, sk);
      hz.addColorStop(0, 'rgba(122,212,220,0)');
      hz.addColorStop(1, 'rgba(160,226,232,.55)');
      c.fillStyle = hz;
      c.fillRect(0, sk - H * .22, W, H * .22);

      // bushes
      c.fillStyle = '#73bf2e';
      var off = (B.scrollY * .3) % 120;
      c.beginPath();
      for (var x = -120; x < W + 120; x += 120) {
        var bx = x - off;
        c.moveTo(bx, H - gh);
        c.arc(bx + 30, H - gh, 30, Math.PI, 0);
        c.arc(bx + 78, H - gh, 42, Math.PI, 0);
      }
      c.fill();
      c.fillRect(0, H - gh, W, gh);

      // dirt
      c.fillStyle = '#ded895';
      c.fillRect(0, H - gh * .55, W, gh * .55);
      c.fillStyle = 'rgba(150,130,70,.5)';
      var so = (B.scrollY * .55) % 26;
      for (var s = -26; s < W + 26; s += 26) c.fillRect(s - so, H - gh * .55, 13, 5);
    }
  });

  /* ====================================================================== */
  /*  06 · SHREK — swamp layers + fireflies                                 */
  /* ====================================================================== */

  backdrops.shrek = backdrop('shrek', '[data-c="shrek"]', {
    opts: { alpha: false, fps: E.lite ? 28 : 46 },
    init: function (P) {
      P.fly = [];
      for (var i = 0; i < (E.lite ? 12 : 26); i++)
        P.fly.push({
          x: Math.random(), y: Math.random(), ph: Math.random() * 6.28,
          sp: .12 + Math.random() * .3, r: 1 + Math.random() * 2.2
        });
    },
    draw: function (P, dt, T) {
      var c = P.ctx, W = P.w, H = P.h;
      var g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#14260c');
      g.addColorStop(.45, '#244013');
      g.addColorStop(1, '#0f1d08');
      c.fillStyle = g; c.fillRect(0, 0, W, H);

      // shafts of light
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (var s = 0; s < 3; s++) {
        var sx = W * (.2 + s * .3) + Math.sin(T * .2 + s) * 30;
        var lg = c.createLinearGradient(sx, 0, sx + 120, H);
        lg.addColorStop(0, 'rgba(190,230,110,.10)');
        lg.addColorStop(1, 'rgba(190,230,110,0)');
        c.fillStyle = lg;
        c.beginPath();
        c.moveTo(sx - 60, 0); c.lineTo(sx + 60, 0);
        c.lineTo(sx + 200, H); c.lineTo(sx + 20, H);
        c.closePath(); c.fill();
      }
      c.restore();

      // reeds, back then front, swaying
      reeds(c, W, H, T, .55, 'rgba(10,26,6,.75)', 46, .5);
      reeds(c, W, H, T, .8, 'rgba(6,16,4,.92)', 30, .9);

      // fireflies
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (var i = 0; i < P.fly.length; i++) {
        var f = P.fly[i];
        f.ph += dt * f.sp;
        var fx = (f.x + Math.sin(f.ph) * .04) * W;
        var fy = (f.y + Math.cos(f.ph * .7) * .03) * H;
        var a = .35 + Math.sin(f.ph * 2.3) * .35;
        blitGlow(c, '214,255,120', fx, fy, f.r * 8, a * .9);
      }
      c.globalAlpha = 1;
      c.restore();
    }
  });

  function reeds(c, W, H, T, base, col, step, amp) {
    c.fillStyle = col;
    for (var x = -step; x < W + step; x += step) {
      var sw = Math.sin(T * .5 + x * .02) * 12 * amp;
      var top = H * base + Math.sin(x * .1) * 18;
      c.beginPath();
      c.moveTo(x - 7, H);
      c.quadraticCurveTo(x + sw * .4, (top + H) / 2, x + sw, top);
      c.quadraticCurveTo(x + sw * .4 + 8, (top + H) / 2, x + 9, H);
      c.closePath(); c.fill();
    }
  }

  /* ====================================================================== */
  /*  07 · STRANGE — mandala rings + embers                                 */
  /* ====================================================================== */

  backdrops.strange = backdrop('strange', '[data-c="strange"]', {
    opts: { alpha: false, fps: E.lite ? 26 : 44 },
    init: function (P) {
      P.em = [];
      for (var i = 0; i < (E.lite ? 16 : 40); i++)
        P.em.push({ x: Math.random(), y: Math.random(), v: .01 + Math.random() * .05, r: .6 + Math.random() * 1.6, ph: Math.random() * 6.28 });
    },
    draw: function (P, dt, T) {
      var c = P.ctx, W = P.w, H = P.h;
      c.fillStyle = '#08060a'; c.fillRect(0, 0, W, H);

      var cx = W * .5, cy = H * .46;
      var R = Math.min(W, H) * .42;

      c.save();
      c.globalCompositeOperation = 'lighter';
      // three counter-rotating rune rings — every segment of a ring goes into
      // one path so each ring costs a single stroke instead of ~30
      for (var r = 0; r < 3; r++) {
        var rr = R * (.5 + r * .26);
        var dir = r % 2 ? -1 : 1;
        var seg = 18 + r * 10;
        c.strokeStyle = 'rgba(255,150,50,' + (.16 - r * .035) + ')';
        c.lineWidth = 1.4;
        c.beginPath();
        for (var s = 0; s < seg; s++) {
          var a0 = (s / seg) * 6.2832 + T * .13 * dir;
          var a1 = a0 + (6.2832 / seg) * .58;
          c.moveTo(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr);
          c.arc(cx, cy, rr, a0, a1);
        }
        c.stroke();
      }
      // core glow
      var rg = c.createRadialGradient(cx, cy, 0, cx, cy, R * 1.1);
      rg.addColorStop(0, 'rgba(255,140,40,.10)');
      rg.addColorStop(.5, 'rgba(255,90,20,.045)');
      rg.addColorStop(1, 'rgba(255,90,20,0)');
      c.fillStyle = rg;
      c.beginPath(); c.arc(cx, cy, R * 1.1, 0, 6.2832); c.fill();

      for (var i = 0; i < P.em.length; i++) {
        var e = P.em[i];
        e.y -= e.v * dt;
        e.ph += dt;
        if (e.y < -.05) { e.y = 1.05; e.x = Math.random(); }
        var ex = (e.x + Math.sin(e.ph * .6) * .012) * W, ey = e.y * H;
        var a = .3 + Math.sin(e.ph * 2) * .25;
        blitGlow(c, '255,160,60', ex, ey, e.r * 7, a);
      }
      c.globalAlpha = 1;
      c.restore();
    }
  });

  /* ====================================================================== */
  /*  08 · UPSIDE DOWN — spores, murk, red flicker                          */
  /* ====================================================================== */

  backdrops.upside = backdrop('upside', '[data-c="upside"]', {
    opts: { alpha: false, fps: E.lite ? 26 : 42 },
    init: function (P) {
      P.sp = [];
      for (var i = 0; i < (E.lite ? 22 : 55); i++)
        P.sp.push({
          x: Math.random(), y: Math.random(), r: .5 + Math.random() * 2.4,
          v: .008 + Math.random() * .03, ph: Math.random() * 6.28
        });
      P.flick = 0; P.next = 2;
    },
    draw: function (P, dt, T) {
      var c = P.ctx, W = P.w, H = P.h;
      var g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#05070c');
      g.addColorStop(.55, '#0b1119');
      g.addColorStop(1, '#04060a');
      c.fillStyle = g; c.fillRect(0, 0, W, H);

      // red storm flicker
      P.next -= dt;
      if (P.next < 0) { P.flick = 1; P.next = 1.8 + Math.random() * 4; }
      P.flick = Math.max(0, P.flick - dt * 3.2);
      if (P.flick > 0) {
        var fa = P.flick * P.flick * .16;
        var fg = c.createRadialGradient(W * .5, H * .3, 0, W * .5, H * .3, Math.max(W, H) * .8);
        fg.addColorStop(0, 'rgba(216,31,38,' + fa + ')');
        fg.addColorStop(1, 'rgba(216,31,38,0)');
        c.fillStyle = fg; c.fillRect(0, 0, W, H);
      }

      // vines from the top
      c.strokeStyle = 'rgba(20,34,30,.85)';
      c.lineCap = 'round';
      for (var v = 0; v < 6; v++) {
        var vx = W * (v + .5) / 6 + Math.sin(T * .16 + v) * 22;
        c.lineWidth = 3 + (v % 3);
        c.beginPath();
        c.moveTo(vx, -10);
        c.bezierCurveTo(vx + 50, H * .3, vx - 60, H * .55, vx + 20, H * .9);
        c.stroke();
      }

      // spores drift upward — gravity is wrong down here
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (var i = 0; i < P.sp.length; i++) {
        var s = P.sp[i];
        s.y -= s.v * dt;
        s.ph += dt * .7;
        if (s.y < -.04) { s.y = 1.04; s.x = Math.random(); }
        var sx = (s.x + Math.sin(s.ph) * .016) * W, sy2 = s.y * H;
        var a = .18 + Math.sin(s.ph * 1.6) * .12;
        blitGlow(c, '198,214,226', sx, sy2, s.r * 9, a);
      }
      c.globalAlpha = 1;
      c.restore();
    }
  });

  /* ====================================================================== */
  /*  09 · STARS — starfield with slow drift                                */
  /* ====================================================================== */

  backdrops.stars = backdrop('stars', '[data-c="stars"]', {
    opts: { alpha: false, fps: E.lite ? 30 : 48 },
    init: function (P) {
      P.st = [];
      var n = E.lite ? 90 : 220;
      for (var i = 0; i < n; i++)
        P.st.push({
          x: Math.random(), y: Math.random(),
          z: .2 + Math.random() * .8, ph: Math.random() * 6.28
        });
    },
    draw: function (P, dt, T) {
      var c = P.ctx, W = P.w, H = P.h;
      c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
      for (var i = 0; i < P.st.length; i++) {
        var s = P.st[i];
        s.y += s.z * dt * .008;
        if (s.y > 1.02) { s.y = -.02; s.x = Math.random(); }
        s.ph += dt * (1 + s.z);
        var a = (.35 + s.z * .5) * (.72 + Math.sin(s.ph) * .28);
        c.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
        var r = s.z * 1.5;
        c.fillRect(s.x * W, s.y * H, r, r);
      }
    }
  });

  B.Painter = Painter;
})(window, document);


