/* ═══════════════════════════════════════════════════════════════════════════
   БАЗА — 20 · core runtime
   Viewport lock, one animation clock, reveals, chrome, the hero reel.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var D = document, W = window, B = D.body;
var $  = function (s, r) { return (r || D).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };

var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
var lerp  = function (a, b, t) { return a + (b - a) * t; };
var ease  = function (t) { return t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; };
var rnd   = function (a, b) { return a + Math.random() * (b - a); };

var RM = W.matchMedia('(prefers-reduced-motion: reduce)').matches;
var COARSE = W.matchMedia('(pointer: coarse)').matches;

W.BAZA = { $: $, $$: $$, clamp: clamp, lerp: lerp, ease: ease, rnd: rnd, RM: RM, COARSE: COARSE };

/* ───────────────────────────────────────────────── 1 · the viewport lock ──

   Three separate things make a phone page "jump", and each needs its own fix.

   • Double-tap zoom — handled in CSS by `touch-action: manipulation`, which
     removes the browser's 300ms wait-and-see on every tap. That wait is what
     made taps feel like the page twitched.
   • Pinch zoom — `user-scalable=no` covers Chrome/Android. Safari has ignored
     it since iOS 10, so the gesture events are cancelled here instead.
   • Layout reflow when the address bar slides — nothing is measured in `vh`,
     and the resize handler below refuses to act on a height-only change.      */

['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) {
  D.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false });
});
D.addEventListener('touchmove', function (e) {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

/* ─────────────────────────────────────────────────── 2 · the single clock ──

   Every scroll-linked effect on the page is a job on this one loop. One
   `scrollY` read per frame, one rAF, and jobs whose section is off screen are
   skipped rather than throttled.                                             */

var Clock = (function () {
  var jobs = [], y = 0, py = -1, vw = 0, vh = 0, raf = 0;
  /* Seconds since the previous frame, normalised so that 1 means "one frame
     at 60Hz". Every drifting, spinning or scrolling thing multiplies by this.
     Without it a 120Hz phone runs the whole site at double speed and a busy
     frame makes it stutter — which is most of what "not smooth" looks like. */
  var dt = 1, prevT = 0;

  function measure() {
    vw = W.innerWidth;
    vh = W.innerHeight;
    /* --vh is written here and nowhere else. It is a *width*-driven value on
       purpose: a toolbar retracting is not a new layout. */
    D.documentElement.style.setProperty('--vh', (vh * .01) + 'px');
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (D.hidden) { prevT = t || 0; return; }
    /* Clamped: a tab returning from the background must not teleport every
       particle across the screen in one frame. */
    dt = prevT ? clamp((t - prevT) / 16.667, .2, 3) : 1;
    prevT = t || 0;
    y = W.pageYOffset || D.documentElement.scrollTop || 0;
    var moved = y !== py;
    py = y;
    for (var i = 0; i < jobs.length; i++) {
      var j = jobs[i];
      if (j.live === false) continue;
      /* `dirty` is how a gated job catches up. A scroll-only job that becomes
         visible while the page is stationary — a jump to an anchor, a restored
         position, a section revealed by a resize — would otherwise wait for the
         next scroll to render, and until then shows whatever it drew last. */
      if (j.onScroll && !moved && !j.always && !j.dirty) continue;
      j.dirty = false;
      j.fn(y, vw, vh);
    }
  }

  var lastW = 0, lastH = 0;
  function onResize() {
    var w = W.innerWidth, h = W.innerHeight;
    /* The tolerance is the whole point: mobile browsers fire resize when the
       URL bar hides, and re-initialising canvases there is what made the old
       page look like it reloaded itself mid-gesture. */
    if (w === lastW && Math.abs(h - lastH) < 140) return;
    lastW = w; lastH = h;
    measure();
    for (var i = 0; i < jobs.length; i++) {
      if (jobs[i].resize) jobs[i].resize(vw, vh);
      jobs[i].dirty = true;
    }
  }

  measure(); lastW = vw; lastH = vh;
  W.addEventListener('resize', onResize, { passive: true });
  W.addEventListener('orientationchange', function () {
    setTimeout(function () { lastH = 0; onResize(); }, 260);
  }, { passive: true });
  raf = requestAnimationFrame(loop);

  return {
    add: function (fn, opts) {
      opts = opts || {};
      var j = { fn: fn, resize: opts.resize, live: true, dirty: true,
                onScroll: opts.onScroll !== false, always: !!opts.always };
      jobs.push(j);
      if (j.resize) j.resize(vw, vh);
      return j;
    },
    /* Gate a job on its section being anywhere near the viewport. */
    bind: function (el, job, margin) {
      if (!el || !('IntersectionObserver' in W)) return;
      job.live = false;
      new IntersectionObserver(function (es) {
        job.live = es[0].isIntersecting;
        if (job.live) job.dirty = true;
      }, { rootMargin: margin || '60% 0px' }).observe(el);
    },
    get vw() { return vw; }, get vh() { return vh; }, get y() { return y; },
    get dt() { return dt; }
  };
})();
W.BAZA.Clock = Clock;

/* ──────────────────────────────────────────────────── 3 · canvas plumbing ──

   Device pixel ratio is capped at 2. Beyond that the cost is real and the
   gain is not, and phones with dpr 3–4 are exactly the ones that can least
   afford a full-screen canvas repaint.                                       */

function fitCanvas(cv, draw) {
  var dpr = Math.min(W.devicePixelRatio || 1, 2);
  function size() {
    var r = cv.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width * dpr));
    var h = Math.max(1, Math.round(r.height * dpr));
    if (cv.width === w && cv.height === h) return false;
    cv.width = w; cv.height = h;
    return true;
  }
  size();
  return { size: size, dpr: dpr, draw: draw };
}
W.BAZA.fitCanvas = fitCanvas;

/* ──────────────────────────────────────────────────────────── 4 · reveals ── */

var revealIO = null;
function watchReveals(root) {
  if (RM) { $$('[data-rise]', root).forEach(function (el) { el.classList.add('is-in'); }); return; }
  if (!revealIO) {
    revealIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        revealIO.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: .01 });
  }
  $$('[data-rise]', root).forEach(function (el) { revealIO.observe(el); });
}
W.BAZA.watchReveals = watchReveals;

/* ──────────────────────────────────────────────────────────── 5 · helpers ── */

var toastEl = $('#toast'), toastT = 0;
function toast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('is-on');
  clearTimeout(toastT);
  toastT = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2600);
}
W.BAZA.toast = toast;

function copy(text, msg) {
  var done = function () { toast(msg || 'Скопировано'); };
  if (navigator.clipboard && W.isSecureContext) {
    navigator.clipboard.writeText(text).then(done, fallback);
  } else fallback();
  function fallback() {
    var ta = D.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
    B.appendChild(ta); ta.select();
    try { D.execCommand('copy'); done(); } catch (e) { toast('Не вышло скопировать'); }
    B.removeChild(ta);
  }
}
W.BAZA.copy = copy;

/* Smooth in-page travel that respects a reduced-motion preference and never
   fights the browser's own scroll anchoring. */
/* Nudge an element into view, but only as far as it needs and only when it is
   genuinely out of sight. The complaint this answers is having to scroll down
   to find out what a tap did and back up to tap again: on a phone the control
   and its consequence rarely fit the same fold, so the page closes the gap
   instead of leaving it to the reader. Anything already visible is left alone,
   because scrolling under someone who can already see the answer is worse than
   not scrolling at all. */
function ensureVisible(el, pad) {
  if (!el) return;
  pad = pad == null ? 24 : pad;
  var r = el.getBoundingClientRect();
  if (!r.height) return;
  var bar = parseInt(getComputedStyle(D.documentElement).getPropertyValue('--barh'), 10) || 0;
  var top = 76, bottom = W.innerHeight - bar - 12;
  var dy = 0;
  if (r.bottom > bottom) dy = Math.min(r.bottom - bottom + pad, r.top - top);
  else if (r.top < top) dy = r.top - top - pad;
  if (Math.abs(dy) < 8) return;
  W.scrollBy({ top: dy, behavior: RM ? 'auto' : 'smooth' });
}
W.BAZA.ensureVisible = ensureVisible;

/* Mark a group of controls as the world's opening move. The cue retires on
   the first real interaction with any of them — a hint that keeps pulsing
   after you have understood it is just noise.

   `cues` limits how many actually get the ring. A row of four mystery blocks
   wants all four lit, because hitting them all is the mechanic; a list of
   eight priced line items wants one, because eight pulsing outlines stop
   reading as an invitation and start reading as an error. */
function invite(els, cues) {
  els = [].slice.call(els);
  if (!els.length) return;
  var n = cues == null ? els.length : cues;
  els.slice(0, n).forEach(function (el) { el.setAttribute('data-invite', ''); });
  function done() {
    els.forEach(function (el) {
      el.classList.add('is-used');
      el.removeEventListener('pointerdown', done);
    });
  }
  /* Any of them counts as understood, including the ones without a ring. */
  els.forEach(function (el) { el.addEventListener('pointerdown', done, { once: true }); });
}
W.BAZA.invite = invite;

function goTo(id) {
  var el = D.getElementById(id);
  if (!el) return;
  var top = el.getBoundingClientRect().top + W.pageYOffset - 12;
  W.scrollTo({ top: top, behavior: RM ? 'auto' : 'smooth' });
}
W.BAZA.goTo = goTo;

/* ─────────────────────────────────────────────────────────── 6 · sound ─────

   Muted until asked for. Everything is synthesised — no audio files, so the
   page stays one file and the sounds stay tiny.                              */

var Snd = (function () {
  var ctx = null, on = false;
  function ac() {
    if (!ctx) {
      var C = W.AudioContext || W.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, t0, dur, type, vol) {
    /* The context is created lazily *and* only once sound is asked for —
       building one while muted just earns an autoplay warning per call. */
    if (!on) return;
    var c = ac(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, c.currentTime + t0);
    g.gain.setValueAtTime(0, c.currentTime + t0);
    g.gain.linearRampToValueAtTime(vol == null ? .1 : vol, c.currentTime + t0 + .012);
    g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + .02);
  }
  return {
    get on() { return on; },
    toggle: function () { on = !on; if (on) ac(); return on; },
    /* the two-note coin, B5 then E6 — the actual interval */
    coin:  function () { tone(988, 0, .07, 'square', .09); tone(1319, .07, .34, 'square', .09); },
    bump:  function () { tone(160, 0, .09, 'square', .07); },
    jump:  function () { tone(392, 0, .06, 'square', .06); tone(659, .05, .1, 'square', .05); },
    lock:  function () { tone(220, 0, .05, 'square', .05); },
    clear: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * .05, .16, 'square', .07); }); },
    craft: function () { tone(660, 0, .05, 'triangle', .07); tone(880, .05, .12, 'triangle', .06); },
    flux:  function () { tone(110, 0, .5, 'sawtooth', .05); tone(880, .1, .5, 'sine', .03); },
    riff:  function () { [392, 440, 494, 440, 392].forEach(function (f, i) { tone(f, i * .13, .14, 'triangle', .07); }); },
    click: function () { tone(1200, 0, .03, 'sine', .04); }
  };
})();
W.BAZA.Snd = Snd;

var sndBtn = $('#snd');
if (sndBtn) sndBtn.addEventListener('click', function () {
  var on = Snd.toggle();
  sndBtn.classList.toggle('is-on', on);
  sndBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  if (on) { Snd.click(); toast('Звук включён'); } else toast('Звук выключен');
});

/* ────────────────────────────────────────────────────────── 7 · the header ── */

(function header() {
  var head = $('#head'), nav = $('#headNav'), ink = $('#headInk'), burger = $('#burger'), menu = $('#menu');
  var links = $$('a[data-k]', nav);

  Clock.add(function (y) {
    B.classList.toggle('is-scrolled', y > W.innerHeight * .5);
  }, { always: false });

  /* menu */
  function setMenu(open) {
    B.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    /* Locking the body while the sheet is open stops the page underneath from
       scrolling away behind it — and restoring the exact offset afterwards is
       what keeps the position from snapping. */
    if (open) {
      B.dataset.lockY = String(W.pageYOffset);
      B.style.cssText += ';position:fixed;left:0;right:0;width:100%;top:' + (-W.pageYOffset) + 'px;';
    } else {
      var yy = parseInt(B.dataset.lockY || '0', 10);
      B.style.position = ''; B.style.top = ''; B.style.left = ''; B.style.right = ''; B.style.width = '';
      W.scrollTo(0, yy);
    }
  }
  burger.addEventListener('click', function () { setMenu(!B.classList.contains('menu-open')); });
  menu.setAttribute('aria-hidden', 'true');
  $$('a', menu).forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = (a.getAttribute('href') || '').replace('#', '');
      if (!id) return;
      e.preventDefault();
      setMenu(false);
      setTimeout(function () { goTo(id); }, 240);
    });
  });
  D.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && B.classList.contains('menu-open')) setMenu(false);
  });

  /* in-page links everywhere else */
  $$('a[href^="#"]').forEach(function (a) {
    if (a.closest('#menu')) return;
    a.addEventListener('click', function (e) {
      var id = (a.getAttribute('href') || '').replace('#', '');
      if (!id || !D.getElementById(id)) return;
      e.preventDefault();
      goTo(id);
    });
  });

  /* the nav pill follows the section you are actually in */
  var secs = links.map(function (a) { return D.getElementById(a.dataset.k); }).filter(Boolean);
  function moveInk(a) {
    if (!a) { nav.classList.remove('has-ink'); return; }
    nav.classList.add('has-ink');
    ink.style.width = a.offsetWidth + 'px';
    ink.style.transform = 'translateX(' + a.offsetLeft + 'px)';
  }
  /* Offset arithmetic on the shared clock, rather than seven intersection
     ratios reconciled against each other — the sections are tall and adjacent,
     so "which one owns the middle of the screen" is the honest question. */
  if (secs.length) {
    Clock.add(function (y) {
      var mid = y + W.innerHeight * .38, best = null;
      for (var i = 0; i < secs.length; i++) {
        var s = secs[i], top = s.offsetTop;
        if (mid >= top && mid < top + s.offsetHeight) { best = links[i]; break; }
      }
      links.forEach(function (a) { a.classList.toggle('is-on', a === best); });
      if (nav.offsetParent) moveInk(best);
    });
  }
})();

/* ───────────────────────────────────────────────── 8 · loader + hero reel ──

   The shot exists as two cuts of the same take: a 16:9 pass for wide screens
   and a 9:16 pass for phones. Only the one that matches the viewport is ever
   decoded — an earlier build concatenated both arrays, which is why the hero
   appeared to play one video and then a second.                              */

(function hero() {
  var load = $('#load'), mark = $('#loadMark'), pctEl = $('#loadPct');
  var cv = $('#heroC'), prog = $('#heroProg');
  var hero = $('#hero');
  var ctx = cv.getContext('2d', { alpha: false });

  /* Scroll distance each frame is worth. The old runway spent about 12px a
     frame, so one wheel notch threw away eight frames and the shot read as a
     fast-forward. At 18 the same notch advances five or six. */
  var PX_PER_FRAME = 18;

  /* How much of the reel has to be decoded before the page is handed over.
     Waiting for all 182 frames kept people on the loader for the better part
     of eight seconds; the rest streams in behind the hero while the opening
     stretch is already scrubbable. */
  var PRIME = 56;

  var pool = null;      /* { d: [...], m: [...] } */
  var cut = null;       /* 'd' | 'm' */
  var srcs = [], imgs = [];
  var ready = 0, drawn = -1;

  function wantCut() {
    /* Portrait-ish viewports get the portrait cut. Matching the *shot* to the
       frame beats cropping a landscape take down to a 26% centre slice, which
       is what cut the headline off the laptop screen on a phone. */
    return (W.innerHeight / W.innerWidth) > 1.12 ? 'm' : 'd';
  }

  function setRunway() {
    hero.style.setProperty('--runway', (srcs.length * PX_PER_FRAME) + 'px');
  }

  /* ——— progress + the loader ——————————————————————————————————————— */

  /* ——— the intro, as an explicit timeline ————————————————————————————

     converge (820ms) → fill → hold (260ms) → fly (880ms)

     The fill is the honest one: it can never run ahead of how much of the reel
     has actually decoded. But it also cannot run *faster* than MIN_FILL, since
     inline data URIs decode almost instantly and a bar that snaps from nought
     to full in a third of a second is not something anyone sees happen.      */

  var CONVERGE = 820, MIN_FILL = 1150, HOLD = 260;
  var fillFrom = 0, filling = false, poured = false;

  function setP(p) {
    p = clamp(p, 0, 1);
    if (mark) mark.style.setProperty('--fill', (p * 100).toFixed(1) + '%');
    if (pctEl) pctEl.textContent = Math.round(p * 100) + '%';
  }

  function need() { return Math.max(1, Math.min(srcs.length || PRIME, PRIME)); }

  function pour() {
    if (poured) return;
    var real = ready / need();
    var floor = (performance.now() - fillFrom) / MIN_FILL;
    var shown = Math.min(real, floor);
    setP(shown);
    if (shown >= 1) { poured = true; setTimeout(finish, HOLD); return; }
    requestAnimationFrame(pour);
  }

  /* The mark is not allowed to move until it has decoded. Running the entrance
     against artwork that is still arriving is how the previous build managed
     to land its logo after it had already flown into place. */
  Promise.all($$('#load img').map(function (im) {
    return im.decode ? im.decode().catch(function () {}) : Promise.resolve();
  })).then(function () {
    load.classList.add('is-ready');
    setTimeout(function () {
      filling = true;
      fillFrom = performance.now();
      load.classList.add('is-pouring');
      pour();
    }, RM ? 0 : CONVERGE);
  });

  var landed = false;
  function finish() {
    if (landed) return;
    /* The brief is explicit: it flies only once it has filled. If the safety
       timeout gets here first, top the fill up and let it land normally. */
    if (filling && !poured) { poured = true; }
    landed = true;
    setP(1);
    B.classList.add('reel-ready');

    /* The mark does not cut to the header — it travels there. Measure both
       rectangles, run the difference as one transform, and only then hand the
       real header logo back its opacity. */
    var target = $('#headLogo');
    var from = mark.getBoundingClientRect();
    var to = target.getBoundingClientRect();

    if (!RM && from.width && to.width) {
      var sx = to.width / from.width;
      var dx = (to.left + to.width / 2) - (from.left + from.width / 2);
      var dy = (to.top + to.height / 2) - (from.top + from.height / 2);
      mark.style.setProperty('--fx', dx + 'px');
      mark.style.setProperty('--fy', dy + 'px');
      mark.style.setProperty('--fs', sx);
      /* a beat at full so the fill is seen finishing, then the flight */
      setTimeout(function () { load.classList.add('is-flying'); }, 420);
      setTimeout(function () { B.classList.add('is-live'); }, 420 + 620);
      setTimeout(function () {
        load.classList.add('is-gone');
        setTimeout(function () { load.setAttribute('hidden', ''); }, 500);
        watchReveals(D);
      }, 420 + 900);
    } else {
      load.classList.add('is-gone');
      B.classList.add('is-live');
      setTimeout(function () { load.setAttribute('hidden', ''); }, 500);
      watchReveals(D);
    }
  }

  /* ——— frame loading ——————————————————————————————————————————————— */

  var next = 0, lanes = 6, generation = 0;
  function pump(gen) {
    while (next < srcs.length && lanes > 0) {
      lanes--;
      (function (i) {
        var im = new Image();
        im.decoding = 'async';
        im.onload = im.onerror = function () {
          if (gen !== generation) return;
          imgs[i] = im.naturalWidth ? im : null;
          ready++; lanes++;
          if (ready === 1) { drawn = -1; draw(0); }
          pump(gen);
        };
        im.src = srcs[i];
      })(next++);
    }
  }

  function useCut(which) {
    if (!pool || which === cut) return;
    cut = which;
    generation++;
    srcs = pool[which] || [];
    imgs = new Array(srcs.length);
    ready = 0; next = 0; lanes = 6; drawn = -1;
    setRunway();
    pump(generation);
  }

  /* ——— drawing ————————————————————————————————————————————————————— */

  function draw(i) {
    if (!srcs.length) return;
    i = clamp(i | 0, 0, srcs.length - 1);
    if (i === drawn) return;
    var im = imgs[i], k = i;
    /* hold the nearest decoded frame rather than flashing a gap */
    while (!im && k > 0) im = imgs[--k];
    if (!im) return;
    drawn = i;
    var cw = cv.width, ch = cv.height;
    var s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight);
    var w = im.naturalWidth * s, h = im.naturalHeight * s;
    ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  var sizer = fitCanvas(cv);
  /* The scrub is eased rather than mapped straight off `scrollY`: a trackpad
     flick moves the raw value in jumps, and following it literally is what
     makes a frame reel look like it is stuttering rather than playing. */
  var smooth = 0, targetP = 0;

  var job = Clock.add(function (y) {
    var top = hero.offsetTop, run = hero.offsetHeight - W.innerHeight;
    targetP = clamp((y - top) / Math.max(1, run), 0, 1);
    smooth = RM ? targetP : lerp(smooth, targetP, 1 - Math.pow(1 - .16, Clock.dt));
    if (Math.abs(targetP - smooth) < .0008) smooth = targetP;
    prog.style.setProperty('--p', smooth);
    draw(Math.round(smooth * (srcs.length - 1)));
    B.classList.toggle('hero-out', targetP > .9);
  }, {
    always: true, onScroll: false,
    resize: function () {
      if (sizer.size()) { drawn = -1; }
      useCut(wantCut());
      setRunway();
      draw(Math.round(smooth * (srcs.length - 1)));
    }
  });
  Clock.bind(hero, job, '30% 0px');

  function boot(list) {
    pool = list || {};
    if (!pool.d && !pool.m) { setP(1); finish(); return; }
    setP(0);
    useCut(wantCut());
  }
  if (W.__SEQ) boot(W.__SEQ); else W.__seqReady = boot;

  /* A hard ceiling, so a slow connection never traps anyone on the loader. */
  setTimeout(finish, 14000);

  /* Nothing to load at all (no reel): still play the intro rather than
     flashing the loader out of existence. */
  if (!W.__SEQ) setTimeout(function () { if (!filling) { ready = PRIME; } }, 2000);
})();

var yr = $('#yr'); if (yr) yr.textContent = String(new Date().getFullYear());

})();
