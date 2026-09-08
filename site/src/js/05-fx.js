
/* ==========================================================================
   БАЗА — page-wide feedback: the boot field, the click burst, the ticker.

   All three are chrome rather than content, so they live on one canvas and
   one fixed strip and never make any section responsible for its own ripple.
   ========================================================================== */
(function (w, d) {
  'use strict';
  var B = w.BAZA, E = B.env;
  var $ = B.$, clamp = B.clamp, ss = B.ease.ss;

  /* Universe accent colours, used by both the burst and the ticker. Kept
     here rather than read from CSS so a burst never forces a style recalc
     in the middle of a pointer event. */
  var ACCENT = {
    hero: [242, 235, 221], mario: [255, 205, 60], matrix: [90, 255, 160],
    tiktok: [255, 70, 120], tetris: [130, 170, 255], flappy: [255, 220, 90],
    shrek: [170, 230, 90], strange: [255, 168, 70], brief: [242, 235, 221],
    upside: [235, 60, 80], stars: [255, 232, 31]
  };
  function uniNow() {
    return d.documentElement.getAttribute('data-uni-now') || 'hero';
  }
  function accent() { return ACCENT[uniNow()] || ACCENT.hero; }

  /* Форма брызг у каждой вселенной своя. Один и тот же кружок во всех девяти
     мирах — это и есть та самая «одинаковость», из-за которой интерактив не
     чувствуется: нажатие в мире Марио обязано быть монетой, в Матрице —
     символом, в Тетрисе — квадратом. Стоит это ноль: форма выбирается один
     раз на нажатие, дальше рисуется тот же цикл частиц. */
  var SHAPE = {
    mario: 'coin', matrix: 'glyph', tetris: 'block', strange: 'spark',
    stars: 'star', upside: 'ash', shrek: 'blob', tiktok: 'heart',
    flappy: 'feather'
  };
  var GLYPHS = 'アカサタナハマヤラ01アイウエオ0110';

  /* ==================================================== 1 · boot field === */
  /* A drifting field of specks that pulls itself into the wordmark as the
     reel loads. It is the only thing on screen for the first second, so it
     has to carry the whole "something is being assembled" idea on its own. */

  (function () {
    var cv = $('#bootC');
    if (!cv || E.reduce) return;
    var ctx = cv.getContext('2d');
    var dots = [], size = { w: 0, h: 0 }, raf = 0, t0 = performance.now();
    var fill = $('#bootFill');

    function build() {
      var m = B.fitCanvas(cv, ctx, 1.5);
      size = m;
      var n = E.lite ? 46 : 110;
      dots = [];
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2;
        var rad = 0.34 + Math.random() * 0.66;
        dots.push({
          // home: where the speck settles once loading completes
          hx: 0.5 + Math.cos(a) * rad * 0.42,
          hy: 0.5 + Math.sin(a) * rad * 0.22,
          x: Math.random(), y: Math.random(),
          sp: 0.35 + Math.random() * 0.9,
          r: 0.6 + Math.random() * 1.5
        });
      }
    }

    function frame(now) {
      var el = (now - t0) / 1000;
      // progress read straight off the bar — one source of truth
      var p = 0;
      if (fill) {
        var m = /scaleX\(([\d.]+)\)/.exec(fill.style.transform || '');
        p = m ? parseFloat(m[1]) : 0;
      }
      ctx.clearRect(0, 0, size.w, size.h);
      var pull = ss(p);
      for (var i = 0; i < dots.length; i++) {
        var o = dots[i];
        var wob = Math.sin(el * o.sp + i) * 0.014;
        var x = (o.x + (o.hx - o.x) * pull + wob) * size.w;
        var y = (o.y + (o.hy - o.y) * pull - wob) * size.h;
        var al = (0.10 + pull * 0.34) * (0.5 + 0.5 * Math.sin(el * 1.6 + i));
        ctx.fillStyle = 'rgba(242,235,221,' + al.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(x, y, o.r * (1 + pull * 0.7), 0, 6.2832);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }

    build();
    raf = requestAnimationFrame(frame);
    w.addEventListener('baza:ready', function () {
      setTimeout(function () { cancelAnimationFrame(raf); }, 1000);
    }, { once: true });
  })();

  /* ================================================== 2 · click burst ==== */
  /* One fixed canvas for the whole page. Idle costs nothing: the loop only
     runs while there are live particles, and the canvas is cleared and the
     loop stopped the moment the last one dies. */

  (function () {
    var cv = $('#fxC');
    if (!cv) return;
    var ctx = cv.getContext('2d');
    var parts = [], rings = [], size = { w: 0, h: 0 }, running = false;

    function fit() { size = B.fitCanvas(cv, ctx, 1.5); }
    fit();
    B.onResize(fit);

    function burst(x, y, strength) {
      if (E.reduce) return;
      var c = accent();
      var sh = SHAPE[uniNow()] || 'dot';
      var st = strength || 1;
      var n = Math.round((E.lite ? 14 : 24) * st);
      for (var i = 0; i < n; i++) {
        // two speed groups: a tight core that reads instantly and a slower
        // spray that gives the burst a tail
        var fast = i % 3 === 0;
        var a = Math.random() * Math.PI * 2;
        var v = (fast ? 190 + Math.random() * 260 : 60 + Math.random() * 170) * st;
        parts.push({
          x: x, y: y,
          vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
          life: 0, max: 0.40 + Math.random() * 0.50,
          r: (fast ? 1.2 : 2.0) + Math.random() * 2.6, c: c,
          sh: sh,
          rot: Math.random() * 6.2832,
          spin: (Math.random() - .5) * 14,
          g: GLYPHS[(Math.random() * GLYPHS.length) | 0]
        });
      }
      // two rings a beat apart: the second one is what makes a tap feel like
      // it landed rather than merely happened
      rings.push({ x: x, y: y, life: 0, max: 0.46, c: c, k: 1 });
      rings.push({ x: x, y: y, life: -0.07, max: 0.62, c: c, k: 1.7 });
      start();
    }

    function start() {
      if (running) return;
      running = true;
      B.ticker.add(step, 90);
    }
    function stop() {
      running = false;
      B.ticker.remove(step);
      ctx.clearRect(0, 0, size.w, size.h);
    }

    function step(sy, dt) {
      ctx.clearRect(0, 0, size.w, size.h);
      var i, o, k;

      for (i = rings.length - 1; i >= 0; i--) {
        o = rings[i];
        o.life += dt;
        if (o.life < 0) continue;                  // staggered second ring
        k = o.life / o.max;
        if (k >= 1) { rings.splice(i, 1); continue; }
        var rad = 8 + ss(k) * 74 * o.k;
        var fade = (1 - k) * (1 - k);
        // a filled wash inside the ring, so the burst has a body and not
        // just an outline
        var g = ctx.createRadialGradient(o.x, o.y, rad * 0.4, o.x, o.y, rad);
        g.addColorStop(0, 'rgba(' + o.c[0] + ',' + o.c[1] + ',' + o.c[2] + ',0)');
        g.addColorStop(1, 'rgba(' + o.c[0] + ',' + o.c[1] + ',' + o.c[2] + ',' +
          (fade * 0.16).toFixed(3) + ')');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(o.x, o.y, rad, 0, 6.2832); ctx.fill();

        ctx.strokeStyle = 'rgba(' + o.c[0] + ',' + o.c[1] + ',' + o.c[2] + ',' +
          (fade * 0.85).toFixed(3) + ')';
        ctx.lineWidth = (1 - k) * 3 + 0.5;
        ctx.beginPath();
        ctx.arc(o.x, o.y, rad, 0, 6.2832);
        ctx.stroke();
      }

      for (i = parts.length - 1; i >= 0; i--) {
        o = parts[i];
        o.life += dt;
        k = o.life / o.max;
        if (k >= 1) { parts.splice(i, 1); continue; }
        o.vy += 520 * dt;
        o.vx *= 1 - 2.1 * dt;
        o.vy *= 1 - 1.1 * dt;
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        var pa = (1 - k) * (1 - k * 0.4);
        var col = 'rgba(' + o.c[0] + ',' + o.c[1] + ',' + o.c[2] + ',' + pa.toFixed(3) + ')';
        var rr = o.r * (1 - k * 0.45);
        ctx.fillStyle = col;
        o.rot += o.spin * dt;

        switch (o.sh) {
          case 'coin':
            /* Монета «крутится»: ширина ходит по косинусу, поэтому диск то
               становится ребром, то разворачивается — тот же приём, что в
               спрайте из игры, только без спрайта. */
            var wq = Math.abs(Math.cos(o.rot)) * rr * 1.6 + 0.6;
            ctx.beginPath();
            ctx.ellipse(o.x, o.y, wq, rr * 1.6, 0, 0, 6.2832);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,' + (pa * .5).toFixed(3) + ')';
            ctx.lineWidth = .8; ctx.stroke();
            break;
          case 'glyph':
            ctx.save();
            ctx.translate(o.x, o.y);
            ctx.font = '700 ' + (rr * 3.4).toFixed(1) + 'px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(o.g, 0, 0);
            ctx.restore();
            break;
          case 'block':
            ctx.save();
            ctx.translate(o.x, o.y); ctx.rotate(o.rot);
            var bs = rr * 1.7;
            ctx.fillRect(-bs / 2, -bs / 2, bs, bs);
            ctx.strokeStyle = 'rgba(255,255,255,' + (pa * .45).toFixed(3) + ')';
            ctx.lineWidth = 1; ctx.strokeRect(-bs / 2, -bs / 2, bs, bs);
            ctx.restore();
            break;
          case 'spark':
            // искра вытянута вдоль собственной скорости — так она читается
            // как след, а не как точка
            var sp = Math.hypot(o.vx, o.vy) || 1;
            ctx.strokeStyle = col;
            ctx.lineWidth = rr * .9;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(o.x, o.y);
            ctx.lineTo(o.x - o.vx / sp * rr * 4, o.y - o.vy / sp * rr * 4);
            ctx.stroke();
            break;
          case 'star':
            ctx.save();
            ctx.translate(o.x, o.y); ctx.rotate(o.rot);
            ctx.beginPath();
            for (var sI = 0; sI < 4; sI++) {
              var aa = sI * 1.5708;
              ctx.lineTo(Math.cos(aa) * rr * 2.2, Math.sin(aa) * rr * 2.2);
              ctx.lineTo(Math.cos(aa + .785) * rr * .55, Math.sin(aa + .785) * rr * .55);
            }
            ctx.closePath(); ctx.fill();
            ctx.restore();
            break;
          case 'ash':
            // пепел Изнанки падает вверх
            o.vy -= 900 * dt;
            ctx.globalAlpha = pa * .8;
            ctx.beginPath(); ctx.arc(o.x, o.y, rr * .8, 0, 6.2832); ctx.fill();
            ctx.globalAlpha = 1;
            break;
          case 'blob':
            ctx.save();
            ctx.translate(o.x, o.y); ctx.rotate(o.rot);
            ctx.beginPath();
            ctx.ellipse(0, 0, rr * 1.5, rr * 1.05, 0, 0, 6.2832);
            ctx.fill();
            ctx.restore();
            break;
          case 'heart':
            ctx.save();
            ctx.translate(o.x, o.y); ctx.rotate(o.rot * .3);
            var hs = rr * .9;
            ctx.beginPath();
            ctx.moveTo(0, hs);
            ctx.bezierCurveTo(-hs * 2, -hs * .4, -hs * .7, -hs * 1.7, 0, -hs * .55);
            ctx.bezierCurveTo(hs * .7, -hs * 1.7, hs * 2, -hs * .4, 0, hs);
            ctx.fill();
            ctx.restore();
            break;
          case 'feather':
            ctx.save();
            ctx.translate(o.x, o.y); ctx.rotate(o.rot * .5);
            ctx.beginPath();
            ctx.ellipse(0, 0, rr * 2.1, rr * .62, 0, 0, 6.2832);
            ctx.fill();
            ctx.restore();
            break;
          default:
            ctx.beginPath();
            ctx.arc(o.x, o.y, rr, 0, 6.2832);
            ctx.fill();
        }
      }

      if (!parts.length && !rings.length) stop();
    }

    /* pointerdown, not click: the feedback has to land under the finger at
       the moment of contact, not after the browser has decided it was a tap */
    w.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      // a burst on top of a text selection drag is noise
      if (ev.target.closest('input,textarea,[data-sel]')) return;
      var strong = !!ev.target.closest('button,a,.pill,.mblock,.udl,.nope,.stc,.socc');
      burst(ev.clientX, ev.clientY, strong ? 1.4 : 0.85);
      if (strong) B.buzz(9);
    }, { passive: true });

    B.burst = burst;
  })();

  /* ====================================================== 3 · ticker ===== */
  /* The strip along the bottom. Each universe gets its own line, the words
     swap on the handover, and the run speed is tied to scroll velocity so
     the page feels physically connected to it. */

  var LINES = {
    hero: ['РАЗРАБОТКА', 'КРЕАТИВ', 'КАЧЕСТВО', 'РЕЗУЛЬТАТ'],
    mario: ['WORLD 1-1', 'ГДЕ ТЕРЯЮТСЯ ДЕНЬГИ', 'НАЖМИ БЛОК', '1 UP'],
    matrix: ['КРАСНАЯ ИЛИ СИНЯЯ', 'WAKE UP', 'СИСТЕМА ВМЕСТО ЛЮДЕЙ', 'FOLLOW THE WHITE RABBIT'],
    tiktok: ['КЕЙСЫ', 'ЛИСТАЙ ВВЕРХ', 'ЦИФРЫ ДО И ПОСЛЕ', 'БЕЗ PDF-ПОРТФОЛИО'],
    tetris: ['ЦЕНА БЕЗ ЗАГАДОК', 'ВИЛКА, А НЕ СЧЁТ', 'LINE CLEAR', 'ТЯНИ РУЧКУ'],
    flappy: ['МАРШРУТ', 'ТРИ ТРУБЫ ДО РЕЗУЛЬТАТА', 'НИ ОДНА НЕ ПРОПУСКАЕТСЯ', 'GET READY'],
    shrek: ['ЧТО ВЫ ПОЛУЧАЕТЕ', 'БОЛОТО РАБОТАЕТ САМО', 'SOMEBODY ONCE TOLD ME', 'НЕ ТЯНУТЬ ДВЕРЬ'],
    strange: ['ГЕОГРАФИЯ', 'ОТКРОЙ ПОРТАЛ', 'ОТ КАЗАНИ ДО ДОЛИНЫ', 'DORMAMMU, I’VE COME TO BARGAIN'],
    brief: ['ЗАЯВКА', 'ОТВЕТ ЗА РАБОЧИЙ ДЕНЬ', 'ЧИТАЮТ ТЕ, КТО ДЕЛАЕТ', 'ЦИФРЫ В ПЕРВОМ ЖЕ СООБЩЕНИИ'],
    upside: ['ИЗНАНКА', 'ВЫ ДОМОТАЛИ', 'НЕ НАЖИМАТЬ', 'RUN'],
    stars: ['ТИТРЫ', 'ЭТО БАЗА', 'ВОЗВРАЩЕНИЕ ВЫХОДНОГО', 'ЭПИЗОД VI']
  };

  (function () {
    var strip = $('#tick'), run = $('#tickRun');
    if (!strip || !run) return;

    var offset = 0, speed = 42, cur = '', halfW = 0;

    function paint(key) {
      var words = LINES[key] || LINES.hero;
      var html = '';
      // two identical halves make the loop seamless with a single transform
      for (var half = 0; half < 2; half++) {
        for (var i = 0; i < words.length; i++) {
          html += '<span class="tick__i">' + words[i] + '</span><i class="tick__d"></i>';
        }
      }
      run.innerHTML = html;
      var c = ACCENT[key] || ACCENT.hero;
      strip.style.setProperty('--tick-c', 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')');
      // remeasure after the swap; halfW is the loop distance
      halfW = run.scrollWidth / 2 || 1;
      offset = offset % halfW;
    }

    var lastY = 0;
    B.ticker.add(function (sy, dt) {
      var key = d.documentElement.getAttribute('data-uni-now') || 'hero';
      if (key !== cur) {
        cur = key;
        strip.classList.add('is-swap');
        paint(key);
        setTimeout(function () { strip.classList.remove('is-swap'); }, 380);
      }
      if (!halfW || halfW < 2) { halfW = run.scrollWidth / 2 || 1; }

      // scroll velocity drives the run: still page, gentle drift; fast
      // scroll, the strip races along with it
      var v = (sy - lastY) / Math.max(dt, 1 / 240);
      lastY = sy;
      var boost = clamp(Math.abs(v) * 0.35, 0, 620);
      var dir = v < -2 ? -1 : 1;
      if (!E.reduce) offset += (speed + boost) * dt * dir;
      offset = ((offset % halfW) + halfW) % halfW;
      run.style.transform = 'translate3d(' + (-offset).toFixed(1) + 'px,0,0)';

      // the strip steps aside for the footer so it never covers the credits
      var max = d.documentElement.scrollHeight - w.innerHeight;
      strip.classList.toggle('is-off', max > 0 && sy > max - w.innerHeight * 0.55);
    }, 30);

    paint('hero');
  })();
})(window, document);

