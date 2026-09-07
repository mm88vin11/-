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
      bird(ctx, bx, by, Math.max(-0.5, Math.min(0.7, birdVY * 7)), wingT);

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

    function bird(c, x, y, rot, t) {
      c.save();
      c.translate(x, y);
      c.rotate(rot);
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
  /*  07 · DOCTOR STRANGE — draw the portal                                 */
  /* ====================================================================== */

  (function strange() {
    var band = $('#atlas'), cv = $('#stC');
    if (!band || !cv) return;
    var ctx = cv.getContext('2d');
    var prompt = $('#stPrompt'), joke = $('#stJoke'), skip = $('#stSkip'), citiesEl = $('#stCities');
    var ring = $('#stRing');

    var W = 0, H = 0;
    function fit() {
      var r = cv.getBoundingClientRect();
      if (!r.width) return false;
      var dpr = Math.min(w.devicePixelRatio || 1, 2);
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      W = r.width; H = r.height;
      return true;
    }
    B.onResize(function () { fit(); });

    var pts = [], drawing = false, sparks = [], openP = 0, done = false;

    function pos(ev) {
      var r = cv.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    }

    on(cv, 'pointerdown', function (ev) {
      if (done) return;
      drawing = true;
      pts = [pos(ev)];
      cv.setPointerCapture && cv.setPointerCapture(ev.pointerId);
      if (prompt) prompt.classList.add('is-dim');
      if (joke) joke.hidden = true;
      ev.preventDefault();
    });

    on(cv, 'pointermove', function (ev) {
      if (!drawing) return;
      var p = pos(ev);
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
      ev.preventDefault();
    });

    function endStroke() {
      if (!drawing) return;
      drawing = false;
      judge();
    }
    on(cv, 'pointerup', endStroke);
    on(cv, 'pointercancel', endStroke);
    on(cv, 'pointerleave', endStroke);

    var JOKES = [
      'Так нельзя 😅 Мультивселенная на такое не открывается. Круг, пожалуйста.',
      'Вонг это видел. Вонг не доволен. Давайте всё-таки круг.',
      'Мы за креатив, но у нас тут приличный портал. Круг 🙃',
      'Древняя говорит: «нет». Причём довольно резко. Круг.'
    ];
    var jokeI = 0;

    function judge() {
      if (pts.length < 8) { hint('Слишком коротко — обведите круг целиком.'); return; }

      var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, cx = 0, cy = 0;
      for (var i = 0; i < pts.length; i++) {
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
        var r = Math.hypot(pts[i].x - cx, pts[i].y - cy);
        rs.push(r); mean += r;
      }
      mean /= rs.length;
      var dev = 0;
      for (i = 0; i < rs.length; i++) dev += Math.abs(rs[i] - mean);
      dev /= rs.length;
      var wobble = dev / Math.max(1, mean);

      // angular coverage: did the stroke actually go all the way round?
      var bins = new Array(24).fill(0), covered = 0;
      for (i = 0; i < pts.length; i++) {
        var a = Math.atan2(pts[i].y - cy, pts[i].x - cx);
        var bi = Math.floor(((a + Math.PI) / (2 * Math.PI)) * 24) % 24;
        if (!bins[bi]) { bins[bi] = 1; covered++; }
      }
      var cover = covered / 24;
      var small = mean < Math.min(W, H) * 0.11;

      // how far the stroke ended from where it started, relative to its size
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

    var portal = null;
    function openPortal(cx, cy, r) {
      if (done) return;
      done = true;
      portal = { x: cx, y: cy, r: r, t: 0 };
      if (prompt) prompt.classList.add('is-off');
      if (joke) joke.hidden = true;
      if (skip) skip.classList.add('is-off');
      B.audio.sfx('portal');
      B.buzz(24);
      setTimeout(showCities, 620);
    }

    function showCities() {
      if (!citiesEl || citiesEl.dataset.built) return;
      citiesEl.dataset.built = '1';
      citiesEl.hidden = false;
      D.cities.forEach(function (c, i) {
        var b = el('button', 'stc');
        b.style.left = c.x + '%';
        b.style.top = c.y + '%';
        b.style.setProperty('--cd', (i * 70) + 'ms');
        b.innerHTML = '<i aria-hidden="true"></i><span>' + c.n + '<em>' + c.c + '</em></span>';
        on(b, 'click', function () {
          citiesEl.querySelectorAll('.stc').forEach(function (o) { o.classList.remove('is-on'); });
          b.classList.add('is-on');
          B.audio.sfx('blip');
        });
        citiesEl.appendChild(b);
      });
      requestAnimationFrame(function () { citiesEl.classList.add('is-in'); });
      if (ring) ring.classList.add('is-open');
    }

    on(skip, 'click', function () {
      done = true;
      if (prompt) prompt.classList.add('is-off');
      if (skip) skip.classList.add('is-off');
      portal = { x: W / 2, y: H / 2, r: Math.min(W, H) * .34, t: 0 };
      showCities();
    });

    function render(dt) {
      if (!W && !fit()) return;
      ctx.clearRect(0, 0, W, H);

      // the stroke being drawn
      if (pts.length > 1) {
        ctx.strokeStyle = 'rgba(255,168,64,.9)';
        ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(255,140,30,.9)'; ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // sparks
      for (var s = sparks.length - 1; s >= 0; s--) {
        var sp = sparks[s];
        sp.life -= dt * 1.9;
        if (sp.life <= 0) { sparks.splice(s, 1); continue; }
        sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 120 * dt;
        ctx.fillStyle = 'rgba(255,' + (150 + sp.life * 90 | 0) + ',60,' + sp.life + ')';
        ctx.fillRect(sp.x, sp.y, 2.2, 2.2);
      }

      // once the portal is open, a wireframe globe gives the city pins
      // somewhere to actually be — otherwise they read as floating labels
      if (portal && portal.t > 0.25) {
        var gt = clamp((portal.t - 0.25) / 0.75, 0, 1);
        var grx = W * 0.40, gry = H * 0.40;
        var gcx = W * 0.5, gcy = H * 0.46;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,168,80,' + (0.16 * gt) + ')';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.ellipse(gcx, gcy, grx, gry, 0, 0, 6.2832); ctx.stroke();
        for (var la = 1; la <= 3; la++) {           // latitudes
          var f = la / 4;
          var yy = gcy - gry + gry * 2 * f;
          var rr = grx * Math.sin(Math.PI * f);
          ctx.beginPath();
          ctx.ellipse(gcx, yy, rr, rr * 0.16, 0, 0, 6.2832);
          ctx.stroke();
        }
        for (var lo = 0; lo < 4; lo++) {            // longitudes
          var k = (lo + 0.5) / 4;
          ctx.beginPath();
          ctx.ellipse(gcx, gcy, grx * Math.abs(Math.cos(Math.PI * k)), gry, 0, 0, 6.2832);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.restore();
      }

      // the opened portal
      if (portal) {
        portal.t = Math.min(1, portal.t + dt * 1.5);
        var e = B.ease.out(portal.t);
        var r = portal.r * (0.4 + e * 0.6);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (var k = 0; k < 3; k++) {
          ctx.strokeStyle = 'rgba(255,' + (140 + k * 30) + ',40,' + (0.5 - k * 0.13) * e + ')';
          ctx.lineWidth = 3 - k;
          var seg = 30 + k * 12;
          var rk = r * (1 + k * .06);
          ctx.beginPath();
          for (var q = 0; q < seg; q++) {
            var a0 = (q / seg) * 6.2832 + (k % 2 ? -1 : 1) * (portal.t * 3 + B.scrollY * .002);
            var a1 = a0 + (6.2832 / seg) * .55;
            ctx.moveTo(portal.x + Math.cos(a0) * rk, portal.y + Math.sin(a0) * rk);
            ctx.arc(portal.x, portal.y, rk, a0, a1);
          }
          ctx.stroke();
        }
        var g = ctx.createRadialGradient(portal.x, portal.y, 0, portal.x, portal.y, r);
        g.addColorStop(0, 'rgba(255,190,90,' + (0.16 * e) + ')');
        g.addColorStop(.7, 'rgba(255,110,20,' + (0.07 * e) + ')');
        g.addColorStop(1, 'rgba(255,110,20,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(portal.x, portal.y, r, 0, 6.2832); ctx.fill();
        ctx.restore();
      }
    }

    B.scene({
      el: band, name: 'strange', bg: '[data-bg="strange"]', margin: 0.4,
      enter: function () { fit(); B.backdrops.strange && B.backdrops.strange.set(true); },
      exit: function () { B.backdrops.strange && B.backdrops.strange.set(false); },
      resize: fit,
      update: function () { }
    });

    B.ticker.add(function (sy, dt) {
      var r = cv.getBoundingClientRect();
      if (r.bottom < -80 || r.top > w.innerHeight + 80) return;
      render(dt);
    }, 6);

    /* --- the "we won't take it" filter list ----------------------------- */
    var noEl = $('#stNo');
    if (noEl) {
      D.no.forEach(function (t, i) {
        var li = el('li', null, '<i aria-hidden="true">✕</i><span>' + t + '</span>');
        li.setAttribute('data-rise', 60 + i * 60);
        noEl.appendChild(li);
      });
    }
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
    var LINES = [
      'Ну вот зачем.',
      'Второй раз? Серьёзно?',
      'Так, ладно. Вы упорный.',
      'Хорошо, вы победили. Держите скидку: скажите «Я НАЖАЛ» в заявке.',
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
      if (hits === 4) toast('Кодовое слово на скидку: Я НАЖАЛ', 4200);
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
