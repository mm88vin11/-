
/* ==========================================================================
   БАЗА — interactive sections, part 2:
   Flappy · Shrek · Doctor Strange · Upside Down · Star Wars
   ========================================================================== */
(function (w, d) {
  'use strict';
  var B = w.BAZA, E = B.env, D = B.data;
  var $ = B.$, $$ = B.$$, clamp = B.clamp, on = B.on, el = B.el, toast = B.toast;

  /* ====================================================================== */
  /*  05 · FLAPPY — three pipes, three stages                               */
  /* ====================================================================== */

  (function flappy() {
    var track = $('#flTrack'), cv = $('#flC');
    if (!track || !cv) return;
    var ctx = cv.getContext('2d');
    var steps = $$('.fl__step'), scoreEl = $('#flScore');

    var W = 0, H = 0, dpr = 1;
    function fit() {
      var r = cv.getBoundingClientRect();
      if (!r.width) return false;
      dpr = Math.min(w.devicePixelRatio || 1, 2);
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      W = r.width; H = r.height;
      return true;
    }
    B.onResize(fit);

    var PIPES = 3;
    var birdY = 0.5, birdVY = 0, lastP = 0, wingT = 0, passed = -1;

    function draw(p) {
      if (!W && !fit()) return;
      ctx.clearRect(0, 0, W, H);

      var groundH = Math.max(52, H * .12);
      var playH = H - groundH;

      // pipes are laid out along the run; p slides the world leftwards
      var gapH = Math.max(150, playH * .38);
      var pipeW = Math.max(64, W * .085);
      var travel = p * (PIPES + 0.6);

      for (var i = 0; i < PIPES; i++) {
        var px = W * (0.62 + i * 0.9) - travel * W * 0.9;
        if (px < -pipeW * 2 || px > W + pipeW) continue;
        var gapC = playH * (0.42 + Math.sin(i * 2.1) * 0.16);
        pipe(ctx, px, pipeW, 0, gapC - gapH / 2, true);
        pipe(ctx, px, pipeW, gapC + gapH / 2, playH - (gapC + gapH / 2), false);
      }

      // bird target: follow the gap of the pipe it is currently crossing
      var idx = clamp(Math.floor(travel / 0.9 - 0.62 / 0.9 + 0.5), 0, PIPES - 1);
      var gapCur = playH * (0.42 + Math.sin(idx * 2.1) * 0.16);
      var targetY = gapCur / playH;
      var dy = targetY - birdY;
      birdVY += dy * 0.14;
      birdVY *= 0.82;
      birdY += birdVY;
      birdY = clamp(birdY, 0.06, 0.94);

      wingT += 0.35 + Math.abs(birdVY) * 12;
      var bx = W * 0.26, by = birdY * playH;
      var bsc = clamp(W / 820, 0.95, 2.4);
      var brot = Math.max(-0.5, Math.min(0.7, birdVY * 7));
      // motion ghosts, strongest when the bird is actually moving
      var speed = Math.min(Math.abs(birdVY) * 26, 1);
      if (speed > 0.05) {
        for (var gi = 1; gi <= 2; gi++) {
          ctx.save();
          ctx.globalAlpha = 0.20 * speed / gi;
          bird(ctx, bx - gi * 16 * bsc, by - birdVY * playH * gi * 0.5, brot, wingT, bsc);
          ctx.restore();
        }
      }
      bird(ctx, bx, by, brot, wingT, bsc);

      // score when a pipe crosses the bird
      var scored = 0;
      for (var k = 0; k < PIPES; k++) {
        if (W * (0.62 + k * 0.9) - travel * W * 0.9 < bx) scored++;
      }
      if (scored !== passed) {
        if (scored > passed && passed >= 0) { B.audio.sfx('flap'); B.buzz(6); }
        passed = scored;
        if (scoreEl) scoreEl.textContent = Math.min(scored, PIPES);
        for (var s = 0; s < steps.length; s++) {
          steps[s].classList.toggle('is-on', s === clamp(scored - 1, 0, PIPES - 1) && scored > 0);
        }
        if (scored === 0 && steps[0]) steps[0].classList.add('is-on');
      }
      lastP = p;
    }

    function pipe(c, x, pw, y, h, top) {
      if (h <= 0) return;
      var lipH = 26, lipOver = 7;
      var g = c.createLinearGradient(x, 0, x + pw, 0);
      g.addColorStop(0, '#5aa028'); g.addColorStop(.28, '#8fd43f');
      g.addColorStop(.62, '#73bf2e'); g.addColorStop(1, '#3f7a19');
      c.fillStyle = g;
      c.fillRect(x, y, pw, h);
      c.strokeStyle = 'rgba(20,50,10,.6)'; c.lineWidth = 2;
      c.strokeRect(x + 1, y + 1, pw - 2, h - 2);
      var ly = top ? y + h - lipH : y;
      c.fillStyle = g;
      c.fillRect(x - lipOver, ly, pw + lipOver * 2, lipH);
      c.strokeRect(x - lipOver + 1, ly + 1, pw + lipOver * 2 - 2, lipH - 2);
    }

    /* The bird was drawn at fixed pixel sizes, so on a 1440-wide stage it was
       a 34px speck in an empty sky. It scales with the stage now, and trails
       a couple of ghosts so a fast passage reads as movement. */
    function bird(c, x, y, rot, t, sc) {
      c.save();
      c.translate(x, y);
      c.rotate(rot);
      c.scale(sc, sc);
      // body
      c.fillStyle = '#f5c242';
      c.beginPath(); c.ellipse(0, 0, 17, 14, 0, 0, 6.2832); c.fill();
      c.strokeStyle = '#3a2a08'; c.lineWidth = 2; c.stroke();
      // wing
      var f = Math.sin(t) * 7;
      c.fillStyle = '#fff3c4';
      c.beginPath(); c.ellipse(-3, 2 + f * .3, 9, 6 + f * .3, -0.3, 0, 6.2832); c.fill();
      c.stroke();
      // eye
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(7, -5, 5.4, 0, 6.2832); c.fill(); c.stroke();
      c.fillStyle = '#211';
      c.beginPath(); c.arc(8.6, -5, 2.4, 0, 6.2832); c.fill();
      // beak
      c.fillStyle = '#f07f2b';
      c.beginPath();
      c.moveTo(14, -1); c.lineTo(24, 2); c.lineTo(14, 6); c.closePath();
      c.fill(); c.stroke();
      c.restore();
    }

    B.scene({
      el: track, name: 'flappy', bg: '[data-bg="flappy"]', margin: 0.4,
      enter: function () { fit(); B.backdrops.flappy && B.backdrops.flappy.set(true); },
      exit: function () { B.backdrops.flappy && B.backdrops.flappy.set(false); },
      resize: fit,
      update: function (p, r) {
        var span = Math.max(1, r.height - w.innerHeight);
        draw(clamp(-r.top / span, 0, 1));
      }
    });
  })();

  /* ====================================================================== */
  /*  06 · SHREK — the outhouse                                             */
  /* ====================================================================== */

  (function shrek() {
    var band = $('#gains');
    if (!band) return;
    var door = $('#skDoor'), ogre = $('#skOgre'), lyric = $('#skLyric'), house = $('#skOuthouse');
    var opened = false;

    function open() {
      if (opened) return;
      opened = true;
      house && house.classList.add('is-open');
      ogre && ogre.classList.add('is-out');
      B.audio.sfx('swamp');
      B.buzz(20);
      if (lyric) {
        lyric.classList.add('is-on');
        setTimeout(function () { lyric.classList.remove('is-on'); }, 7000);
      }
      if (door) door.setAttribute('aria-label', 'Дверь открыта');
    }
    on(door, 'click', open);

    // gains grid
    var grid = $('#skGrid');
    if (grid) {
      D.gains.forEach(function (g, i) {
        var c = el('article', 'sk__card');
        c.setAttribute('data-rise', 60 + i * 70);
        c.innerHTML =
          '<span class="sk__ico" aria-hidden="true">' + g.ico + '</span>' +
          '<h3>' + g.t + '</h3><p>' + g.d + '</p>';
        grid.appendChild(c);
      });
    }

    B.scene({
      el: band, name: 'shrek', bg: '[data-bg="shrek"]', margin: 0.4,
      enter: function () { B.backdrops.shrek && B.backdrops.shrek.set(true); },
      exit: function () { B.backdrops.shrek && B.backdrops.shrek.set(false); },
      update: function (p) {
        // he comes out on his own if you scroll far enough without knocking
        if (!opened && p > 0.52) open();
      }
    });
  })();

  /* ====================================================================== */
  /*  07 · DOCTOR STRANGE — cut a hole into the other world                 */
  /* ---------------------------------------------------------------------- */
  /*  Круг должен открывать другой мир. Прошлая версия открывала карту: за
      кольцом висели названия городов и счётчики проектов — то есть слайд
      «география клиентов», которому пририсовали портал.

      Здесь за кольцом настоящее место. Зеркальное измерение рендерится всё
      время на своём канвасе, а обведённое кольцо — реальная дыра в него:
      мир за ней продолжает вращаться, дыру можно таскать и заглядывать в
      разные стороны, а можно шагнуть внутрь — тогда в зеркало уходит вся
      страница целиком.

      География никуда не делась, она просто перестала притворяться миром:
      строка городов живёт под порталом обычным текстом.                     */
  /* ====================================================================== */

  (function strange() {
    var band = $('#atlas'), cv = $('#stC'), wv = $('#stWorld');
    if (!band || !cv || !wv) return;
    var ctx = cv.getContext('2d');
    var wctx = wv.getContext('2d');
    var prompt = $('#stPrompt'), joke = $('#stJoke'), skip = $('#stSkip'), ring = $('#stRing');
    var hud = $('#stHud'), hudCity = $('#stHudCity'), hudMeta = $('#stHudMeta');

    var W = 0, H = 0, live = false;

    /* Инструкция зависит от устройства: мышью круг ведут сразу, пальцем —
       после удержания, иначе жест забрал бы прокрутку. Обещать одно и то же
       обоим нельзя: половина людей выполнит не то действие. */
    if (prompt && E.coarse) {
      prompt.innerHTML = '<span class="st__promptIco" aria-hidden="true">◯</span>' +
        'задержите палец — и обведите круг';
    }

    function fit() {
      var r = cv.getBoundingClientRect();
      if (!r.width) return false;
      var dpr = Math.min(w.devicePixelRatio || 1, E.lite ? 1.4 : 2);
      [cv, wv].forEach(function (n) {
        n.width = Math.round(r.width * dpr);
        n.height = Math.round(r.height * dpr);
      });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      W = r.width; H = r.height;
      return true;
    }
    B.onResize(function () { fit(); });

    /* ---------------------------------------------------------- state -- */

    var pts = [], drawing = false, sparks = [], done = false;
    var portal = null;                 // {x,y,r,t}
    var dragging = false, dragOff = { x: 0, y: 0 };
    var spin = 0, panX = 0, panY = 0, panTX = 0, panTY = 0, worldDirty = false;

    /* Обломки, висящие в зеркальном измерении. Раньше здесь лежал список
       городов с подписями — из-за него портал и читался как карта. Теперь
       это просто вещество мира: плиты, которые дрейфуют и ловят свет. */
    var SHARDS = (function () {
      var a = [];
      for (var i = 0; i < (E.lite ? 9 : 16); i++) {
        a.push({
          wx: (Math.random() * 2 - 1) * 0.86,
          wy: (Math.random() * 2 - 1) * 0.86,
          sz: 0.03 + Math.random() * 0.085,
          rot: Math.random() * 6.2832,
          spin: (Math.random() - 0.5) * 0.24,
          seed: Math.random() * 10,
          depth: 0.35 + Math.random() * 0.65
        });
      }
      return a;
    })();

    function pos(ev) {
      var r = cv.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    }

    /* ------------------------------------------------------- the world -- */
    /* A mirror dimension: one sector of a folding city, kaleidoscoped around
       the centre. The symmetry is the whole look — it is what makes a few
       dozen rectangles read as an impossible place instead of as a skyline. */

    var SEG = E.lite ? 6 : 8;
    var DEPTH = E.lite ? 8 : 15;

    /* One wedge of the fold: a street running radially out from the centre,
       buildings flanking it, lit windows and a gold light line down the
       middle. Radius is depth — the centre is the far end of the street, the
       rim is right in front of the camera — so squaring the radius gives the
       perspective compression for free. */
    function sector(c, R, time, depth) {
      var drift = (time * 0.055) % 1;

      for (var i = depth; i >= 0; i--) {
        var t = (i + drift) / depth;              // 0 far … 1 near
        if (t <= 0.02) continue;
        var d = R * t * t;                        // perspective placement
        var hw = R * 0.055 + R * 0.13 * t;        // half-width of the street
        var bw = R * (0.05 + 0.20 * t);           // building depth
        var bh = R * (0.06 + 0.42 * t);           // building height
        var lum = 0.14 + t * 0.80;

        // the two facades
        var face = 'rgba(' + Math.round(26 + 74 * lum) + ',' +
          Math.round(16 + 40 * lum) + ',' + Math.round(30 + 30 * lum) + ',' +
          (0.60 + 0.38 * lum).toFixed(3) + ')';
        c.fillStyle = face;
        c.fillRect(-hw - bw, -d - bh, bw, bh);
        c.fillRect(hw, -d - bh, bw, bh);

        // roofs catch the gold, which is what separates the blocks from each
        // other once several depths overlap
        c.fillStyle = 'rgba(255,' + Math.round(150 + 50 * lum) + ',90,' +
          (0.10 + 0.30 * lum).toFixed(3) + ')';
        c.fillRect(-hw - bw, -d - bh, bw, Math.max(1, bh * 0.035));
        c.fillRect(hw, -d - bh, bw, Math.max(1, bh * 0.035));

        // windows
        if (bh > 8) {
          var rows = Math.max(2, Math.round(bh / (R * 0.055)));
          var cell = bh / rows;
          for (var rI = 0; rI < rows; rI++) {
            var lit = ((i * 5 + rI * 3 + Math.floor(time * 1.1)) % 4) !== 0;
            if (!lit) continue;
            c.fillStyle = 'rgba(255,' + Math.round(184 + 40 * lum) + ',120,' +
              (0.22 + 0.52 * lum).toFixed(3) + ')';
            var wy = -d - bh + rI * cell + cell * 0.22;
            var wh = Math.max(1, cell * 0.34);
            c.fillRect(-hw - bw * 0.72, wy, bw * 0.44, wh);
            c.fillRect(hw + bw * 0.28, wy, bw * 0.44, wh);
          }
        }

        // the strip of light down the street
        c.fillStyle = 'rgba(255,176,84,' + (0.05 + 0.18 * lum).toFixed(3) + ')';
        c.fillRect(-hw * 0.12, -d - R * 0.02 * t, hw * 0.24, R * 0.03 * t + 1);
      }
    }

    function paintWorld(dt, time) {
      var c = wctx;

      /* Before the hole exists there is nothing to see through: the whole
         world was being painted and then erased by the destination-in pass
         on every frame. Bail out early instead — this was the single most
         expensive idle frame on the page. */
      if (!portal && pts.length < 2) {
        if (worldDirty) { c.clearRect(0, 0, W, H); worldDirty = false; }
        return;
      }
      worldDirty = true;
      var cx = W / 2 + panX, cy = H / 2 + panY;
      var R = Math.max(W, H) * 0.92;

      // void
      var bg = c.createRadialGradient(cx, cy, 0, cx, cy, R);
      bg.addColorStop(0, '#2a1233');
      bg.addColorStop(0.30, '#160b1f');
      bg.addColorStop(0.68, '#0a0512');
      bg.addColorStop(1, '#04020a');
      c.fillStyle = bg;
      c.fillRect(0, 0, W, H);

      // the fold
      spin += dt * 0.09;
      c.save();
      c.translate(cx, cy);
      for (var k = 0; k < SEG; k++) {
        c.save();
        c.rotate(spin + (k / SEG) * 6.2832);
        if (k % 2) c.scale(-1, 1);              // mirrored every other sector
        sector(c, R * 0.54, time, DEPTH);
        c.restore();
      }
      c.restore();

      /* The eye of the fold. Kept deliberately small and low: at full
         strength it flooded the whole hole and the city behind it was gone. */
      var core = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.13);
      core.addColorStop(0, 'rgba(255,222,170,.34)');
      core.addColorStop(0.34, 'rgba(255,150,58,.14)');
      core.addColorStop(1, 'rgba(255,110,20,0)');
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = core;
      c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'source-over';

      /* Плиты. Они не подписаны и ничего не считают — это просто то, из чего
         сделан мир: куски улицы, оторванные от своей улицы. Ближние крупнее и
         светлее, дальние почти растворены, поэтому в дыре читается глубина. */
      c.save();
      for (var i = 0; i < SHARDS.length; i++) {
        var sh = SHARDS[i];
        var wob = Math.sin(time * 0.34 + sh.seed) * 10 * sh.depth;
        var sx = cx + sh.wx * W * 0.46;
        var sy = cy + sh.wy * H * 0.46 + wob;
        var size = Math.min(W, H) * sh.sz * sh.depth;

        c.save();
        c.translate(sx, sy);
        c.rotate(sh.rot + time * sh.spin * 0.2);
        c.globalAlpha = 0.16 + sh.depth * 0.42;

        // тело плиты
        c.fillStyle = 'rgba(58,32,64,.92)';
        c.fillRect(-size, -size * 0.30, size * 2, size * 0.60);
        // подсвеченная кромка — она и делает плиту объёмной
        c.fillStyle = 'rgba(255,176,92,' + (0.20 + sh.depth * 0.42).toFixed(3) + ')';
        c.fillRect(-size, -size * 0.30, size * 2, Math.max(1, size * 0.05));
        // редкие окна
        c.fillStyle = 'rgba(255,206,150,' + (0.16 + sh.depth * 0.30).toFixed(3) + ')';
        for (var q = 0; q < 4; q++) {
          if (((i + q + (time * 0.7 | 0)) % 5) === 0) continue;
          c.fillRect(-size * 0.82 + q * size * 0.44, -size * 0.10, size * 0.20, size * 0.16);
        }
        c.restore();
      }
      c.restore();

      /* Punch the hole. Everything painted above survives only where the
         portal disc is — which is what makes this a window rather than a
         picture of a window. */
      c.globalCompositeOperation = 'destination-in';
      if (portal) {
        var e = B.ease.out(portal.t);
        var r = portal.r * (0.30 + e * 0.70);
        var hole = c.createRadialGradient(portal.x, portal.y, r * 0.86,
          portal.x, portal.y, r);
        hole.addColorStop(0, 'rgba(0,0,0,1)');
        hole.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = hole;
        c.beginPath(); c.arc(portal.x, portal.y, r, 0, 6.2832); c.fill();
      } else {
        // not open yet: a faint bruise where the stroke has been, so the
        // surface reads as something that *could* be torn
        c.fillStyle = 'rgba(0,0,0,0)';
        c.fillRect(0, 0, W, H);
        if (pts.length > 1) {
          c.strokeStyle = 'rgba(0,0,0,.5)';
          c.lineWidth = 46; c.lineJoin = 'round'; c.lineCap = 'round';
          c.beginPath();
          c.moveTo(pts[0].x, pts[0].y);
          for (var q = 1; q < pts.length; q++) c.lineTo(pts[q].x, pts[q].y);
          c.stroke();
        }
      }
      c.globalCompositeOperation = 'source-over';
    }

    /* -------------------------------------------------------- gestures -- */

    /* ─────────────────────────────────── жест на тач-устройстве ──────────
       Панель занимает половину экрана, и раньше она забирала себе любое
       касание: страницу нельзя было пролистать пальцем, начав движение на
       ней. Теперь по умолчанию жест принадлежит странице, а рисование
       включается удержанием — палец постоял на месте, панель это заметила и
       дальше ведёт линию.

       touch-action на лету не переключить: браузер решает судьбу жеста в
       момент его начала. Поэтому прокрутку останавливает preventDefault в
       не-пассивном обработчике touchmove, и только когда рисование включено. */
    var armed = false, armT = 0, armPt = null;

    function disarm() {
      armed = false;
      clearTimeout(armT);
      cv.classList.remove('is-armed');
    }

    if (E.coarse) {
      on(cv, 'touchstart', function (ev) {
        if (portal || done) return;
        var t = ev.touches[0];
        armPt = { x: t.clientX, y: t.clientY };
        clearTimeout(armT);
        armT = setTimeout(function () {
          armed = true;
          cv.classList.add('is-armed');
          B.buzz(12);
          if (prompt) prompt.classList.add('is-dim');
        }, 170);
      }, { passive: true });

      // палец уехал раньше, чем панель успела «взять» жест — это прокрутка
      on(cv, 'touchmove', function (ev) {
        if (!armed) {
          var t = ev.touches[0];
          if (armPt && Math.hypot(t.clientX - armPt.x, t.clientY - armPt.y) > 12) {
            clearTimeout(armT);
          }
          return;
        }
        // рисование включено: движение принадлежит линии, не странице
        if (ev.cancelable) ev.preventDefault();
      }, { passive: false });

      on(cv, 'touchend', disarm);
      on(cv, 'touchcancel', disarm);
    }

    on(cv, 'pointerdown', function (ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      // на тач-устройстве линия начинается только после удержания
      if (ev.pointerType === 'touch' && !portal && !armed) return;
      var p = pos(ev);
      cv.setPointerCapture && cv.setPointerCapture(ev.pointerId);

      if (portal) {
        if (stepping) return;
        var dToC = Math.hypot(p.x - portal.x, p.y - portal.y);
        /* Ядро кольца — вход, кромка — ручка. Разделение по радиусу, а не по
           отдельной кнопке: тянуть окно и заходить в него — два разных
           намерения, и рука их различает без подписи. */
        if (dToC < portal.r * 0.62) { stepThrough(); return; }
        if (dToC < portal.r * 1.12) {
          dragging = true;
          dragOff.x = portal.x - p.x;
          dragOff.y = portal.y - p.y;
        }
        return;
      }
      drawing = true;
      pts = [p];
      if (prompt) prompt.classList.add('is-dim');
      if (joke) joke.hidden = true;
    });

    on(cv, 'pointermove', function (ev) {
      if (ev.pointerType === 'touch' && !armed && !dragging) return;
      var p = pos(ev);

      if (dragging && portal) {
        portal.x = clamp(p.x + dragOff.x, portal.r * 0.5, W - portal.r * 0.5);
        portal.y = clamp(p.y + dragOff.y, portal.r * 0.5, H - portal.r * 0.5);
        // the world drifts against the drag, so it reads as looking around
        panTX = clamp((W / 2 - portal.x) * 0.42, -W * 0.30, W * 0.30);
        panTY = clamp((H / 2 - portal.y) * 0.42, -H * 0.30, H * 0.30);
        return;
      }
      if (!drawing) {
        // удержание сработало уже после нажатия — начинаем линию отсюда
        if (armed && !portal && !done) { drawing = true; pts = [p]; }
        else return;
      }

      var last = pts[pts.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 4) {
        pts.push(p);
        for (var i = 0; i < 2; i++) {
          sparks.push({
            x: p.x, y: p.y,
            vx: (Math.random() - .5) * 70, vy: (Math.random() - .5) * 70 - 20,
            life: 1
          });
        }
      }
    });

    function endStroke() {
      dragging = false;
      disarm();
      if (!drawing) return;
      drawing = false;
      judge();
    }
    on(cv, 'pointerup', endStroke);
    on(cv, 'pointercancel', endStroke);

    var JOKES = [
      'Так нельзя 😅 Мультивселенная на такое не открывается. Круг, пожалуйста.',
      'Вонг это видел. Вонг не доволен. Давайте всё-таки круг.',
      'Мы за креатив, но у нас тут приличный портал. Круг 🙃',
      'Древняя говорит: «нет». Причём довольно резко. Круг.'
    ];
    var jokeI = 0;

    function judge() {
      if (pts.length < 8) { hint('Слишком коротко — обведите круг целиком.'); return; }

      var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, cx = 0, cy = 0, i;
      for (i = 0; i < pts.length; i++) {
        var p = pts[i];
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        cx += p.x; cy += p.y;
      }
      cx /= pts.length; cy /= pts.length;
      var bw = maxX - minX, bh = maxY - minY;
      var aspect = Math.max(bw, bh) / Math.max(1, Math.min(bw, bh));

      // radial consistency: a circle keeps a steady distance from its centre
      var rs = [], mean = 0;
      for (i = 0; i < pts.length; i++) {
        var rr = Math.hypot(pts[i].x - cx, pts[i].y - cy);
        rs.push(rr); mean += rr;
      }
      mean /= rs.length;
      var dev = 0;
      for (i = 0; i < rs.length; i++) dev += Math.abs(rs[i] - mean);
      dev /= rs.length;
      var wobble = dev / Math.max(1, mean);

      // angular coverage: did the stroke actually go all the way round?
      var bins = new Array(24), covered = 0;
      for (i = 0; i < 24; i++) bins[i] = 0;
      for (i = 0; i < pts.length; i++) {
        var a = Math.atan2(pts[i].y - cy, pts[i].x - cx);
        var bi = Math.floor(((a + Math.PI) / (2 * Math.PI)) * 24) % 24;
        if (!bins[bi]) { bins[bi] = 1; covered++; }
      }
      var cover = covered / 24;
      var small = mean < Math.min(W, H) * 0.11;

      var diag = Math.max(1, Math.hypot(bw, bh));
      var closure = Math.hypot(pts[0].x - pts[pts.length - 1].x,
        pts[0].y - pts[pts.length - 1].y) / diag;

      // the long-and-narrow case — you know the one
      if (aspect > 1.85 && cover < 0.62 && closure > 0.35) {
        hint(JOKES[jokeI % JOKES.length]);
        jokeI++;
        B.audio.sfx('bump');
        return;
      }
      if (small) { hint('Маловат портал. Размахнитесь пошире.'); return; }
      if (cover < 0.72) { hint('Почти! Круг нужно замкнуть — ведите до конца.'); return; }
      if (wobble > 0.42) { hint('Рука дрогнула. Ещё разок, поровнее.'); return; }

      openPortal(cx, cy, mean);
    }

    function hint(msg) {
      if (!joke) return;
      joke.textContent = msg;
      joke.hidden = false;
      joke.classList.remove('is-pop'); void joke.offsetWidth; joke.classList.add('is-pop');
      pts = [];
      if (prompt) prompt.classList.remove('is-dim');
    }

    function openPortal(cx, cy, r) {
      if (done) return;
      done = true;
      portal = { x: cx, y: cy, r: Math.max(r, Math.min(W, H) * 0.18), t: 0 };
      pts = [];
      if (prompt) prompt.classList.add('is-off');
      if (joke) joke.hidden = true;
      if (skip) skip.classList.add('is-off');
      if (ring) ring.classList.add('is-open');
      if (hud) hud.hidden = false;
      B.audio.sfx('portal');
      B.buzz(24);
      B.toast('Портал держится. Тяните его за край — или шагните внутрь.', 4200);
      setTimeout(offerStep, 2600);
    }

    on(skip, 'click', function () {
      if (done) return;
      openPortal(W / 2, H / 2, Math.min(W, H) * 0.34);
    });

    /* ────────────────────────────────────────────────── шаг за кольцо ──── */
    /* Открытый портал — это ещё не «другой мир», это окно в него. Мир
       начинается, когда в него заходят. Тап внутрь кольца утягивает туда всю
       страницу: она уходит в зеркало целиком, держится несколько секунд и
       возвращается. Дальше портал остаётся окном, но человек уже там был. */

    var stepped = false, stepping = false;

    function stepThrough() {
      if (stepping) return;
      stepping = true;
      var first = !stepped;
      stepped = true;

      var root = d.documentElement;
      root.classList.add('mirror-in');
      B.audio.sfx('portal');
      B.buzz(30);

      // кольцо раскрывается до размера экрана — это и есть «проход внутрь»
      var grow = { r0: portal.r, t: 0 };
      var open = B.ticker.add(function (sy, dt) {
        grow.t = Math.min(1, grow.t + (dt || 1 / 60) / 0.85);
        var e = B.ease.io(grow.t);
        portal.r = grow.r0 + (Math.max(W, H) * 1.25 - grow.r0) * e;
        portal.x += (W / 2 - portal.x) * B.damp(0.10, dt || 1 / 60);
        portal.y += (H / 2 - portal.y) * B.damp(0.10, dt || 1 / 60);
        if (grow.t >= 1) B.ticker.remove(open);
      }, 5);

      setTimeout(function () {
        root.classList.add('mirror-on');
        if (first) {
          B.toast('Вы по ту сторону. Здесь бизнес работает без вас — ' +
            'это единственная разница.', 4600);
        }
      }, 620);

      // и обратно: мир показан, держать в нём насильно незачем
      setTimeout(function () {
        root.classList.remove('mirror-on');
        var back = { t: 0, r0: portal.r };
        var shut = B.ticker.add(function (sy, dt) {
          back.t = Math.min(1, back.t + (dt || 1 / 60) / 0.7);
          portal.r = back.r0 + (Math.min(W, H) * 0.30 - back.r0) * B.ease.io(back.t);
          if (back.t >= 1) {
            B.ticker.remove(shut);
            root.classList.remove('mirror-in');
            stepping = false;
          }
        }, 5);
      }, 4200);
    }

    // подсказка появляется один раз, когда портал уже держится
    function offerStep() {
      if (stepped || !prompt) return;
      prompt.classList.remove('is-off', 'is-dim');
      prompt.innerHTML = '<span class="st__promptIco" aria-hidden="true">◉</span>' +
        'а теперь шагните внутрь';
      prompt.classList.add('is-step');
    }

    /* ------------------------------------------------------------ ring -- */

    function paintRing(dt, time) {
      var c = ctx;
      c.clearRect(0, 0, W, H);

      // the stroke being traced
      if (pts.length > 1) {
        c.strokeStyle = 'rgba(255,168,64,.92)';
        c.lineWidth = 3; c.lineJoin = 'round'; c.lineCap = 'round';
        c.shadowColor = 'rgba(255,140,30,.9)'; c.shadowBlur = 14;
        c.beginPath();
        c.moveTo(pts[0].x, pts[0].y);
        for (var i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
        c.stroke();
        c.shadowBlur = 0;
      }

      // sparks from the fingertip
      for (var s = sparks.length - 1; s >= 0; s--) {
        var sp = sparks[s];
        sp.life -= dt * 1.9;
        if (sp.life <= 0) { sparks.splice(s, 1); continue; }
        sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 120 * dt;
        c.fillStyle = 'rgba(255,' + (150 + sp.life * 90 | 0) + ',60,' + sp.life + ')';
        c.fillRect(sp.x, sp.y, 2.2, 2.2);
      }

      if (!portal) return;

      portal.t = Math.min(1, portal.t + dt * 1.6);
      var e = B.ease.out(portal.t);
      var r = portal.r * (0.30 + e * 0.70);

      c.save();
      c.globalCompositeOperation = 'lighter';

      /* Three counter-rotating rings of arc segments. The counter-rotation is
         what makes it burn rather than merely spin. */
      for (var k = 0; k < 3; k++) {
        c.strokeStyle = 'rgba(255,' + (136 + k * 34) + ',' + (30 + k * 26) + ',' +
          ((0.55 - k * 0.13) * e).toFixed(3) + ')';
        c.lineWidth = (3.2 - k) * (1 + e * 0.3);
        var seg = 30 + k * 14;
        var rk = r * (1 + k * 0.052);
        c.beginPath();
        for (var q = 0; q < seg; q++) {
          var a0 = (q / seg) * 6.2832 +
            (k % 2 ? -1 : 1) * (time * (1.1 + k * 0.5) + B.scrollY * 0.0016);
          var a1 = a0 + (6.2832 / seg) * (0.42 + 0.2 * Math.sin(time * 3 + q));
          c.moveTo(portal.x + Math.cos(a0) * rk, portal.y + Math.sin(a0) * rk);
          c.arc(portal.x, portal.y, rk, a0, a1);
        }
        c.stroke();
      }

      // embers thrown off the rim
      if (!E.lite && Math.random() < 0.5) {
        var ea = Math.random() * 6.2832;
        sparks.push({
          x: portal.x + Math.cos(ea) * r,
          y: portal.y + Math.sin(ea) * r,
          vx: Math.cos(ea) * 40, vy: Math.sin(ea) * 40 - 30, life: 1
        });
      }

      // inner glow spilling out of the hole
      var g = c.createRadialGradient(portal.x, portal.y, r * 0.7, portal.x, portal.y, r * 1.35);
      g.addColorStop(0, 'rgba(255,168,72,' + (0.24 * e).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,110,20,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(portal.x, portal.y, r * 1.35, 0, 6.2832); c.fill();
      c.restore();
    }

    /* ----------------------------------------------------------- frame -- */

    /* Что говорит HUD, пока портал открыт. Раньше он называл город под
       курсором — то есть подписывал карту. Теперь это сводки из-за кольца:
       мир на той стороне живёт своей жизнью и иногда о ней сообщает. */
    var SIGNALS = [
      ['связь установлена', 'на той стороне уже работает то, что вы ещё обсуждаете'],
      ['геометрия держится', 'здесь заявка доходит до человека за минуты, а не за день'],
      ['слой стабилен', 'ни одного «я посмотрю и вернусь» за весь квартал'],
      ['эхо с той стороны', 'владелец спит. бизнес работает. это не сон'],
      ['координаты приняты', 'Казань, Москва, Дубай, Сан-Франциско — вход один и тот же']
    ];
    var sigI = -1, sigAt = 0;

    function render(dt) {
      if (!W && !fit()) return;
      var time = performance.now() / 1000;

      var k = B.damp(0.12, dt);
      panX += (panTX - panX) * k;
      panY += (panTY - panY) * k;

      paintWorld(dt, time);
      paintRing(dt, time);

      // сводка меняется сама, раз в несколько секунд, пока портал держат
      if (hud && portal && hudCity && time - sigAt > 4.4) {
        sigAt = time;
        sigI = (sigI + 1) % SIGNALS.length;
        hudCity.textContent = SIGNALS[sigI][0];
        if (hudMeta) hudMeta.textContent = SIGNALS[sigI][1];
        hud.classList.remove('is-pop'); void hud.offsetWidth; hud.classList.add('is-pop');
      }
    }

    B.scene({
      el: band, name: 'strange', bg: '[data-bg="strange"]', margin: 0.4,
      enter: function () { live = true; fit(); B.backdrops.strange && B.backdrops.strange.set(true); },
      exit: function () { live = false; B.backdrops.strange && B.backdrops.strange.set(false); },
      resize: fit,
      update: function () { }
    });

    B.ticker.add(function (sy, dt) {
      if (!live) return;
      render(dt);
    }, 6);
  })();

  /* ====================================================================== */
  /*  08 · UPSIDE DOWN — the wall, the bonus, the button                    */
  /* ====================================================================== */

  (function upside() {
    var band = $('#basement');
    if (!band) return;

    B.scene({
      el: band, name: 'upside', bg: '[data-bg="upside"]', margin: 0.4,
      enter: function () { B.backdrops.upside && B.backdrops.upside.set(true); },
      exit: function () { B.backdrops.upside && B.backdrops.upside.set(false); }
    });

    /* --- alphabet wall -------------------------------------------------- */
    var wall = $('#udLights'), msgEl = $('#udMsg'), spell = $('#udSpell');
    var LETTERS = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЭЮЯ';
    var bulbs = {};
    if (wall) {
      for (var i = 0; i < LETTERS.length; i++) {
        var L = LETTERS[i];
        var b = el('span', 'udl');
        b.innerHTML = '<i aria-hidden="true"></i><b>' + L + '</b>';
        b.style.setProperty('--hue', (i * 13) % 360);
        wall.appendChild(b);
        if (!bulbs[L]) bulbs[L] = [];
        bulbs[L].push(b);
      }
    }

    var MSG = 'ВЫ ДОШЛИ ДО КОНЦА';
    var running = false;
    function spellOut() {
      if (running || !wall) return;
      running = true;
      if (msgEl) msgEl.textContent = '';
      B.audio.sfx('upside');
      var idx = 0;
      (function step() {
        if (idx >= MSG.length) {
          setTimeout(function () {
            wall.querySelectorAll('.udl').forEach(function (n) { n.classList.remove('is-lit'); });
            running = false;
          }, 1600);
          return;
        }
        var ch = MSG[idx++];
        wall.querySelectorAll('.udl').forEach(function (n) { n.classList.remove('is-lit'); });
        if (bulbs[ch]) bulbs[ch].forEach(function (n) { n.classList.add('is-lit'); });
        if (msgEl) msgEl.textContent = MSG.slice(0, idx);
        setTimeout(step, ch === ' ' ? 180 : 320);
      })();
    }
    on(spell, 'click', spellOut);

    /* --- copy the code word --------------------------------------------- */
    on($('#udCopy'), 'click', function () {
      var word = D.udWord;
      var okMsg = 'Скопировано: ' + word;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(word).then(function () { toast(okMsg); },
          function () { toast('Не вышло скопировать — слово: ' + word); });
      } else {
        toast('Кодовое слово: ' + word);
      }
      B.audio.sfx('blip');
    });

    /* --- the button you were told not to press --------------------------- */
    var nope = $('#nope'), nopeHint = $('#nopeHint');
    // Закон 62: цену первым не снижаем. Награда за упорство — не скидка,
    // а лишняя работа с нашей стороны.
    var LINES = [
      'Ну вот зачем.',
      'Второй раз? Серьёзно?',
      'Так, ладно. Вы упорный.',
      'Хорошо, вы победили. Скажите «Я НАЖАЛ» в заявке — добавим к разбору карту конкурентов. Цену это не двигает.',
      'Больше ничего нет. Честно.',
      'Ладно, есть ещё одно: мы правда отвечаем за рабочий день.'
    ];
    var hits = 0;
    on(nope, 'click', function () {
      hits++;
      var line = LINES[Math.min(hits - 1, LINES.length - 1)];
      if (nopeHint) {
        nopeHint.textContent = line;
        nopeHint.classList.remove('is-pop'); void nopeHint.offsetWidth; nopeHint.classList.add('is-pop');
      }
      nope.classList.remove('is-hit'); void nope.offsetWidth; nope.classList.add('is-hit');
      B.audio.sfx(hits > 3 ? 'powerup' : 'bump');
      B.buzz(12);
      if (hits === 3) d.documentElement.classList.add('flipped');
      if (hits === 4) toast('Кодовое слово: Я НАЖАЛ — карта конкурентов сверху', 4600);
      if (hits >= 6) d.documentElement.classList.remove('flipped');
    });
  })();

  /* ====================================================================== */
  /*  09 · STAR WARS — the crawl                                            */
  /* ====================================================================== */

  (function starwars() {
    var band = $('#credits'), crawl = $('#swCrawl');
    if (!band || !crawl) return;
    var far = band.querySelector('.sw__far');

    B.scene({
      el: band, name: 'stars', bg: '[data-bg="stars"]', margin: 0.35,
      enter: function () { B.backdrops.stars && B.backdrops.stars.set(true); B.audio.sfx('force'); },
      exit: function () { B.backdrops.stars && B.backdrops.stars.set(false); },
      update: function (p, r) {
        var span = Math.max(1, r.height - w.innerHeight);
        var t = clamp(-r.top / span, 0, 1);
        // the crawl marches away from the reader
        var y = 120 - t * 235;
        crawl.style.transform =
          'translateX(-50%) rotateX(52deg) translate3d(0,' + y + '%,0)';
        if (far) far.style.opacity = String(clamp(1 - t * 7, 0, 1));
      }
    });

    on($('#swTop'), 'click', function () {
      w.scrollTo({ top: 0, behavior: E.reduce ? 'auto' : 'smooth' });
    });
  })();

})(window, document);


