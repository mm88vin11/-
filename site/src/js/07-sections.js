
/* ==========================================================================
   БАЗА — interactive sections, part 1: Mario · Matrix · TikTok · Tetris
   ========================================================================== */
(function (w, d) {
  'use strict';
  var B = w.BAZA, E = B.env, D = B.data;
  var $ = B.$, $$ = B.$$, clamp = B.clamp, on = B.on;

  function el(tag, cls, html) {
    var n = d.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  B.el = el;

  function toast(msg, ms) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(t.__t);
    t.__t = setTimeout(function () { t.classList.remove('is-on'); }, ms || 2600);
  }
  B.toast = toast;

  /* ====================================================================== */
  /*  01 · MARIO — bump the blocks                                          */
  /* ====================================================================== */

  (function mario() {
    var host = $('#painBlocks');
    if (!host) return;
    var score = 0;
    var scoreEl = $('#painScore'), coinsEl = $('#painCoins'), allEl = $('#painAll');

    D.pain.forEach(function (p, i) {
      var wrapEl = el('div', 'mblock');
      wrapEl.setAttribute('data-rise', 80 + i * 70);
      wrapEl.innerHTML =
        '<button class="mblock__brick" aria-expanded="false" aria-controls="mb' + i + '">' +
          '<span class="mblock__q" aria-hidden="true">?</span>' +
          '<span class="vh">Открыть: ' + p.t + '</span>' +
        '</button>' +
        '<div class="mblock__coin" aria-hidden="true"></div>' +
        '<div class="mblock__card" id="mb' + i + '">' +
          '<h3>' + p.t + '</h3>' +
          '<div class="mblock__body">' +
            '<p>' + p.d + '</p>' +
            '<span class="mblock__cost">' + p.cost + '</span>' +
          '</div>' +
        '</div>';
      host.appendChild(wrapEl);

      var brick = wrapEl.querySelector('.mblock__brick');
      on(brick, 'click', function () {
        if (wrapEl.classList.contains('is-hit')) {
          // second bump: an empty block, same as the game
          wrapEl.classList.remove('is-bump');
          void wrapEl.offsetWidth;
          wrapEl.classList.add('is-bump');
          B.audio.sfx('bump');
          return;
        }
        wrapEl.classList.add('is-hit', 'is-bump');
        brick.setAttribute('aria-expanded', 'true');
        B.audio.sfx('coin');
        B.buzz(10);
        score++;
        if (scoreEl) scoreEl.textContent = score;
        if (coinsEl) coinsEl.appendChild(el('i', 'mario__coin'));
        if (score === 4) {
          setTimeout(function () {
            if (allEl) {
              allEl.hidden = false;
              // one frame between unhiding and the class, or the transition
              // has nothing to animate from
              requestAnimationFrame(function () { allEl.classList.add('is-in'); });
            }
            B.audio.sfx('powerup');
          }, 420);
        }
      });
    });

    // Mario runs along the canvas ground in step with the section's progress
    var band = $('#pain');
    if (band) {
      B.scene({
        el: band, name: 'mario', bg: '[data-bg="mario"]', margin: 0.4,
        enter: function () { B.marioRun.live = true; },
        exit: function () { B.marioRun.live = false; },
        update: function (p) {
          B.marioRun.p = clamp((p - .12) / .74, 0, 1);
          if (B.scrollDir) B.marioRun.dir = B.scrollDir < 0 ? -1 : 1;
        }
      });
    }
  })();

  /* ====================================================================== */
  /*  02 · MATRIX — the pills, then the services                            */
  /* ====================================================================== */

  (function matrix() {
    var band = $('#truth'), band2 = $('#services');
    if (band) {
      B.scene({
        el: band, name: 'matrix', bg: '[data-bg="matrix"]', margin: 0.4,
        enter: function () { B.backdrops.matrix && B.backdrops.matrix.set(true); },
        exit: function () { if (!near(band2)) B.backdrops.matrix && B.backdrops.matrix.set(false); }
      });
    }
    if (band2) {
      B.scene({
        el: band2, name: 'matrix2', bg: '[data-bg="matrix"]', margin: 0.4,
        enter: function () { B.backdrops.matrix && B.backdrops.matrix.set(true); },
        exit: function () { if (!near(band)) B.backdrops.matrix && B.backdrops.matrix.set(false); }
      });
    }
    function near(n) {
      if (!n) return false;
      var r = n.getBoundingClientRect();
      var pad = w.innerHeight * .4;
      return r.bottom > -pad && r.top < w.innerHeight + pad;
    }

    /* --- pills ---------------------------------------------------------- */
    var pills = $('#pills'), after = $('#mxAfter'), blue = $('#mxBlue'), again = $('#mxAgain');
    var codeEl = after ? after.querySelector('[data-decode]') : null;
    var taken = false;

    function takeRed() {
      if (taken) return;
      taken = true;
      if (pills) pills.classList.add('is-done');
      if (blue) blue.hidden = true;
      if (after) { after.hidden = false; requestAnimationFrame(function () { after.classList.add('is-on'); }); }
      d.documentElement.classList.add('red-pill');
      B.audio.sfx('portal');
      B.buzz(14);
      if (codeEl) decode(codeEl, codeEl.getAttribute('data-decode'));
    }

    $$('.pill').forEach(function (btn) {
      on(btn, 'click', function () {
        if (btn.dataset.pill === 'red') takeRed();
        else {
          if (taken) return;
          if (blue) blue.hidden = false;
          btn.classList.add('is-taken');
          B.audio.sfx('blip');
        }
      });
    });
    on(again, 'click', takeRed);

    // glyph-scramble reveal
    function decode(node, text) {
      if (E.reduce) { node.textContent = text; return; }
      var pool = 'アイウエオ01#$%&*<>/\\';
      var i = 0, raf;
      var step = function () {
        var out = '';
        for (var k = 0; k < text.length; k++) {
          if (k < i) out += text[k];
          else if (text[k] === ' ') out += ' ';
          else out += pool[(Math.random() * pool.length) | 0];
        }
        node.textContent = out;
        i += 0.9;
        if (i < text.length) raf = requestAnimationFrame(step);
        else node.textContent = text;
      };
      raf = requestAnimationFrame(step);
    }

    /* --- обратное демо (Законы 105-111) --------------------------------
       Мы не показываем продукт. Человек показывает нам, как он живёт сейчас,
       и выводы собираются из его же ответов — ничего выдуманного. */
    (function reverseDemo() {
      var host = $('#rd');
      if (!host || !D.rd) return;
      var pick = { src: [], who: '', speed: '', log: '' };

      Object.keys(D.rd).forEach(function (key) {
        var box = host.querySelector('[data-rd="' + key + '"] .rd__opts');
        if (!box) return;
        var cfg = D.rd[key];
        cfg.opts.forEach(function (o) {
          var b = el('button', 'rd__opt');
          b.type = 'button';
          b.setAttribute('aria-pressed', 'false');
          b.textContent = o.t;
          on(b, 'click', function () {
            if (cfg.multi) {
              var i = pick[key].indexOf(o.id);
              if (i > -1) pick[key].splice(i, 1); else pick[key].push(o.id);
            } else {
              pick[key] = pick[key] === o.id ? '' : o.id;
              box.querySelectorAll('.rd__opt').forEach(function (n) {
                n.classList.remove('is-on'); n.setAttribute('aria-pressed', 'false');
              });
            }
            var onNow = cfg.multi ? pick[key].indexOf(o.id) > -1 : pick[key] === o.id;
            b.classList.toggle('is-on', onNow);
            b.setAttribute('aria-pressed', onNow ? 'true' : 'false');
            B.audio.sfx('blip');
            render();
          });
          box.appendChild(b);
        });
      });

      var outEl = $('#rdOut'), gridEl = $('#rdGrid'), verdictEl = $('#rdVerdict');

      function opt(key, id) {
        var a = D.rd[key].opts.filter(function (o) { return o.id === id; });
        return a[0] || null;
      }

      function render() {
        var ready = pick.src.length && pick.who && pick.speed && pick.log;
        if (!ready) { if (outEl) outEl.hidden = true; return; }

        var who = opt('who', pick.who), sp = opt('speed', pick.speed), lg = opt('log', pick.log);
        var chan = pick.src.length;
        // every number below is arithmetic on what the visitor just said
        var places = chan + (lg.risk >= 3 ? 1 : 0);
        var checks = chan * 6;
        var risk = who.risk + sp.risk + lg.risk;

        var cards = [
          { v: chan, k: B.plural(chan, ['канал', 'канала', 'каналов']) + ', куда пишут' },
          { v: '~' + checks, k: B.plural(checks, ['раз', 'раза', 'раз']) + ' в день туда заглянуть' },
          { v: places, k: B.plural(places, ['место', 'места', 'мест']) + ', где заявка может лечь' },
          { v: sp.say, k: 'столько она ждёт ответа', wide: true }
        ];
        if (gridEl) {
          gridEl.innerHTML = '';
          cards.forEach(function (c, i) {
            var n = el('div', 'rd__card' + (c.wide ? ' rd__card--wide' : ''));
            n.style.setProperty('--rdd', (i * 70) + 'ms');
            n.innerHTML = '<b>' + c.v + '</b><span>' + c.k + '</span>';
            gridEl.appendChild(n);
          });
        }

        var line;
        if (risk <= 2) {
          line = 'Схема рабочая. Узкое место одно: она держится на людях — пока они на месте, всё в порядке.';
        } else if (risk <= 5) {
          line = 'Заявка проходит через ' + places + ' ' +
                 B.plural(places, ['точку', 'точки', 'точек']) +
                 ', где её никто не держит, и след остаётся ' + lg.say + '.';
        } else {
          line = 'Заявка приходит в ' + chan + ' ' +
                 B.plural(chan, ['место', 'места', 'мест']) +
                 ', ответ уходит ' + sp.say + ', а след остаётся ' + lg.say +
                 '. Здесь теряется не «иногда» — здесь теряется по расписанию.';
        }
        if (verdictEl) verdictEl.textContent = line;

        if (outEl && outEl.hidden) {
          outEl.hidden = false;
          requestAnimationFrame(function () { outEl.classList.add('is-on'); });
          B.audio.sfx('bump');
        }
      }
    })();

    /* --- services grid -------------------------------------------------- */
    var grid = $('#svcGrid');
    if (grid) {
      D.services.forEach(function (s, i) {
        var c = el('article', 'svc');
        c.setAttribute('data-rise', 60 + i * 70);
        c.setAttribute('tabindex', '0');
        c.innerHTML =
          '<span class="svc__k">' + s.k + '</span>' +
          '<h3 class="svc__t">' + s.t + '</h3>' +
          '<div class="svc__faces">' +
            '<p class="svc__get"><b>что получаете</b>' + s.get + '</p>' +
            '<p class="svc__pay"><b>чем платите</b>' + s.pay + '</p>' +
          '</div>' +
          '<ul class="svc__tags">' + s.tags.map(function (t) {
            return '<li>' + t + '</li>';
          }).join('') + '</ul>';
        grid.appendChild(c);
      });
    }
  })();

  /* ====================================================================== */
  /*  03 · TIKTOK — the case feed                                           */
  /* ====================================================================== */

  (function tiktok() {
    var feed = $('#tokFeed');
    if (!feed) return;
    var rail = $('#tokRail'), swipe = $('#tokSwipe'), side = $('#tokSide');

    D.cases.forEach(function (c, i) {
      var s = el('article', 'tks');
      s.style.setProperty('--hue', c.hue);
      s.innerHTML =
        '<div class="tks__bg" aria-hidden="true"></div>' +
        '<span class="tks__mark" aria-hidden="true">' + ('0' + (i + 1)) + '</span>' +
        '<div class="tks__top">' +
          '<span class="tks__city">' + c.city + '</span>' +
          '<span class="tks__tag">' + c.tag + '</span>' +
        '</div>' +
        '<div class="tks__mid">' +
          '<h3 class="tks__t">' + c.title + '</h3>' +
          '<div class="tks__swap" data-state="after">' +
            '<p class="tks__before"><b>было</b>' + c.before + '</p>' +
            '<p class="tks__after"><b>стало</b>' + c.after + '</p>' +
          '</div>' +
          '<button class="tks__toggle">было / стало</button>' +
        '</div>' +
        '<div class="tks__metrics">' + c.m.map(function (m) {
          return '<span><b>' + m.v + '</b>' + m.k + '</span>';
        }).join('') + '</div>' +
        '<div class="tks__acts">' +
          '<button class="tks__act tks__like" aria-pressed="false" aria-label="Нравится">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5S3.5 15 3.5 9.4A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8.5 2.1c0 5.6-8.5 11.1-8.5 11.1Z"/></svg>' +
            '<b>' + c.likes + '</b>' +
          '</button>' +
          '<span class="tks__act"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h3v4l5-4h8a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1Z"/></svg><b>' + c.comments + '</b></span>' +
          '<a class="tks__act" href="#brief"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13m0-13L7 8m5-5 5 5"/></svg><b>хочу</b></a>' +
        '</div>' +
        '<div class="tks__heart" aria-hidden="true">♥</div>';
      feed.appendChild(s);

      // before / after
      var swap = s.querySelector('.tks__swap');
      on(s.querySelector('.tks__toggle'), 'click', function () {
        swap.dataset.state = swap.dataset.state === 'after' ? 'before' : 'after';
        B.audio.sfx('blip');
      });

      // like, plus the double-tap gesture people already know
      var likeBtn = s.querySelector('.tks__like');
      function like(force) {
        var onNow = likeBtn.getAttribute('aria-pressed') === 'true';
        if (force && onNow) return;
        likeBtn.setAttribute('aria-pressed', onNow ? 'false' : 'true');
        likeBtn.classList.toggle('is-on', !onNow);
        if (!onNow) { B.audio.sfx('blip'); B.buzz(8); }
      }
      on(likeBtn, 'click', function () { like(false); });

      var lastTap = 0;
      on(s, 'pointerdown', function (ev) {
        if (ev.target.closest('button,a')) return;
        var now = Date.now();
        if (now - lastTap < 320) {
          like(true);
          var h = s.querySelector('.tks__heart');
          h.classList.remove('is-pop'); void h.offsetWidth; h.classList.add('is-pop');
        }
        lastTap = now;
      });
    });

    // progress rail + side dots, driven by the feed's own scroll
    if (side) {
      D.cases.forEach(function (c, i) {
        var b = el('button', 'tok__dot');
        b.setAttribute('aria-label', 'Кейс: ' + c.city);
        b.innerHTML = '<span></span>';
        on(b, 'click', function () {
          feed.scrollTo({ top: i * feed.clientHeight, behavior: E.reduce ? 'auto' : 'smooth' });
        });
        side.appendChild(b);
      });
    }

    var dots = $$('.tok__dot', side);
    var rafPend = false;
    on(feed, 'scroll', function () {
      if (rafPend) return;
      rafPend = true;
      requestAnimationFrame(function () {
        rafPend = false;
        var h = feed.clientHeight || 1;
        var p = feed.scrollTop / Math.max(1, feed.scrollHeight - h);
        if (rail) rail.style.transform = 'scaleY(' + clamp(p, 0, 1) + ')';
        var idx = Math.round(feed.scrollTop / h);
        for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('is-on', i === idx);
        if (swipe && feed.scrollTop > 40) swipe.classList.add('is-off');
      });
    }, { passive: true });

    var band = $('#cases');
    B.scene({
      el: band, name: 'tiktok', bg: '[data-bg="tiktok"]', margin: 0.4
    });
  })();

  /* ====================================================================== */
  /*  04 · TETRIS — the price fork as a well                                */
  /* ====================================================================== */

  (function tetris() {
    var range = $('#ttRange');
    if (!range) return;
    var priceEl = $('#ttPrice'), priceHiEl = $('#ttPriceHi'), termEl = $('#ttTerm');
    var adviceEl = $('#ttAdvice'), adviceName = $('#ttAdviceName'),
        adviceWhy = $('#ttAdviceWhy'), adviceGo = $('#ttAdviceGo');
    var nameEl = $('#ttTierName'), textEl = $('#ttTierText'), featEl = $('#ttFeats');
    var linesEl = $('#ttLines'), levelEl = $('#ttLevel');

    var band = $('#pricing');
    B.scene({
      el: band, name: 'tetris', bg: '[data-bg="tetris"]', margin: 0.4,
      enter: function () { B.backdrops.tetris && B.backdrops.tetris.set(true); },
      exit: function () { B.backdrops.tetris && B.backdrops.tetris.set(false); }
    });

    /* --- the well ------------------------------------------------------- */
    var cv = $('#ttC');
    var ctx = cv ? cv.getContext('2d') : null;
    var COLS = 8, ROWS = 16;
    var grid = [];
    for (var r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(0));
    var flash = 0;
    var wellW = 0, wellH = 0, cell = 0;

    var COL = ['#00e5ff', '#ffd400', '#b14cff', '#00e07a', '#ff4d6d', '#ff8a1f', '#3d7bff'];

    function fitWell() {
      if (!cv || !ctx) return;
      var r = cv.getBoundingClientRect();
      if (!r.width) return;
      var dpr = Math.min(w.devicePixelRatio || 1, 2);
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      wellW = r.width; wellH = r.height;
      cell = Math.min(wellW / COLS, wellH / ROWS);
    }
    B.onResize(fitWell);

    function fillTo(rows) {
      // rebuild the stack so the bottom `rows` rows are filled
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          var filled = r >= ROWS - rows;
          if (filled && !grid[r][c]) grid[r][c] = 1 + ((r * 3 + c * 5) % COL.length);
          else if (!filled) grid[r][c] = 0;
        }
      }
    }

    function drawWell() {
      if (!ctx || !cell) return;
      ctx.clearRect(0, 0, wellW, wellH);
      var ox = (wellW - cell * COLS) / 2;
      var oy = wellH - cell * ROWS;

      // well walls
      ctx.strokeStyle = 'rgba(255,255,255,.10)';
      ctx.lineWidth = 1;
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          ctx.strokeRect(ox + c * cell + .5, oy + r * cell + .5, cell - 1, cell - 1);
        }
      }
      for (r = 0; r < ROWS; r++) {
        for (c = 0; c < COLS; c++) {
          var v = grid[r][c];
          if (!v) continue;
          var x = ox + c * cell, y = oy + r * cell;
          ctx.fillStyle = COL[v - 1];
          ctx.globalAlpha = .92;
          ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
          ctx.globalAlpha = .3;
          ctx.fillStyle = '#fff';
          ctx.fillRect(x + 2, y + 2, cell - 4, Math.max(2, cell * .16));
          ctx.globalAlpha = 1;
        }
      }
      if (flash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,' + (flash * .5) + ')';
        ctx.fillRect(ox, oy, cell * COLS, cell * ROWS);
      }
    }

    B.ticker.add(function (sy, dt) {
      if (!cv) return;
      var rct = cv.getBoundingClientRect();
      if (rct.bottom < -100 || rct.top > w.innerHeight + 100) return;
      if (!wellW) fitWell();
      if (flash > 0) { flash = Math.max(0, flash - dt * 2.6); drawWell(); }
    }, 6);

    /* --- tier logic ----------------------------------------------------- */
    function tierFor(v) {
      var t = D.tiers[0];
      for (var i = 0; i < D.tiers.length; i++) if (v >= D.tiers[i].at) t = D.tiers[i];
      return t;
    }
    function nextTier(v) {
      for (var i = 0; i < D.tiers.length; i++) if (D.tiers[i].at > v) return D.tiers[i];
      return null;
    }

    var lastName = '';
    function apply(v, silent) {
      var t = tierFor(v), nx = nextTier(v);
      // Law 56: a single figure is a wall, and walls get tested. The readout
      // stays a moving range so there is nothing to push against.
      var price = t.price, hi = t.hi, term = t.term;
      if (nx) {
        var k = (v - t.at) / (nx.at - t.at);
        price = Math.round((t.price + (nx.price - t.price) * k) / 10) * 10;
        hi = Math.round((t.hi + (nx.hi - t.hi) * k) / 10) * 10;
        term = Math.round(t.term + (nx.term - t.term) * k);
      }
      if (priceEl) priceEl.textContent = price;
      if (priceHiEl) priceHiEl.textContent = hi;
      if (termEl) termEl.textContent = term;
      if (nameEl) nameEl.textContent = t.name;
      if (textEl) textEl.textContent = t.text;

      if (featEl && t.name !== lastName) {
        featEl.innerHTML = '';
        t.feats.forEach(function (f, i) {
          var li = el('li', null, '<i aria-hidden="true"></i>' + f);
          li.style.setProperty('--fd', (i * 70) + 'ms');
          featEl.appendChild(li);
        });
        featEl.classList.remove('is-in'); void featEl.offsetWidth; featEl.classList.add('is-in');
      }

      var rows = Math.round(2 + (v / 100) * (ROWS - 3));
      fillTo(rows);
      if (linesEl) linesEl.textContent = rows;
      if (levelEl) levelEl.textContent = D.tiers.indexOf(t) + 1;

      if (t.name !== lastName) {
        if (!silent) { flash = 1; B.audio.sfx(lastName ? 'clear' : 'drop'); B.buzz(8); }
        lastName = t.name;
      } else if (!silent) {
        // quiet tick while dragging inside one tier
      }
      syncAdvice(v);
      if (!wellW) fitWell();
      drawWell();
    }

    // Law 78: name the rung we would pick, and say why
    var pickTier = D.tiers.filter(function (x) { return x.pick; })[0] || D.tiers[1];
    if (adviceName) adviceName.textContent = pickTier.name;
    if (adviceWhy) adviceWhy.textContent = ' — ' + pickTier.why;
    function syncAdvice(v) {
      if (!adviceEl) return;
      var here = tierFor(v).name === pickTier.name;
      adviceEl.classList.toggle('is-here', here);
      if (adviceGo) adviceGo.hidden = here;
    }
    on(adviceGo, 'click', function () {
      var target = pickTier.at + 14;
      var from = +range.value;
      var t0 = performance.now();
      (function step(now) {
        var k = B.ease.out(Math.min(1, (now - t0) / 520));
        range.value = Math.round(from + (target - from) * k);
        apply(+range.value, k < 1);
        if (k < 1) requestAnimationFrame(step);
        else { B.audio.sfx('clear'); B.buzz(10); }
      })(t0);
    });

    on(range, 'input', function () { apply(+range.value, false); });
    on(range, 'change', function () { apply(+range.value, false); });

    // first paint once the well actually has a box
    requestAnimationFrame(function () { fitWell(); apply(+range.value, true); });
    w.addEventListener('baza:ready', function () { fitWell(); apply(+range.value, true); });
  })();

})(window, document);


