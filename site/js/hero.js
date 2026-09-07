/* ==========================================================================
   БАЗА — hero: scroll-driven laptop frame sequence.
   96 "open" frames + 37 "close" frames, desktop and portrait variants.
   Only the first RUNWAY frames gate the reveal; the rest stream in behind.
   ========================================================================== */
(function (w, d) {
  'use strict';
  var B = w.BAZA;

  var OPEN = 96, CLOSE = 37, TOTAL = OPEN + CLOSE;
  var RUNWAY = 14;                       // frames needed before we hand over
  var CONCURRENCY = 6;

  var portrait = w.innerWidth < 760 || w.innerHeight > w.innerWidth;
  var dirOpen = portrait ? 'seqm5' : 'seqd';
  var dirClose = portrait ? 'closem5' : 'seqdc';

  // In the single-file build the frames live in window.__res as data URIs.
  // With no catalog present this returns the plain path, so one source serves
  // both the folder build and the bundle.
  function src(i) {
    var path = i < OPEN
      ? 'assets/' + dirOpen + '/f' + pad(i) + '.webp'
      : 'assets/' + dirClose + '/f' + pad(i - OPEN) + '.webp';
    var cat = w.__res;
    return (cat && cat[path]) || path;
  }
  function pad(n) { return n < 10 ? '00' + n : n < 100 ? '0' + n : '' + n; }

  var frames = new Array(TOTAL);
  var loaded = 0;
  var next = 0;
  var revealed = false;

  var boot = d.getElementById('boot');
  var bootFill = d.getElementById('bootFill');
  var bootPct = d.getElementById('bootPct');
  var bootLabel = d.getElementById('bootLabel');

  var cv = d.getElementById('heroC');
  var poster = d.getElementById('heroPoster');
  var ctx = cv ? cv.getContext('2d', { alpha: false }) : null;

  var box = { w: 0, h: 0 };
  var cur = 0, target = 0;
  var lastDrawn = -1;

  /* --------------------------------------------------------- loading ---- */

  function bumpBoot() {
    var need = Math.min(RUNWAY, TOTAL);
    var p = Math.min(loaded / need, 1);
    if (bootFill) bootFill.style.transform = 'scaleX(' + p + ')';
    if (bootPct) bootPct.textContent = Math.round(p * 100) + '%';
    if (bootLabel && p > .55) bootLabel.textContent = 'почти на месте';
  }

  function loadOne(i, done) {
    if (i >= TOTAL) { done(); return; }
    var img = new Image();
    img.decoding = 'async';
    img.onload = function () {
      frames[i] = img;
      loaded++;
      if (!revealed) { bumpBoot(); if (loaded >= RUNWAY) reveal(); }
      done();
    };
    img.onerror = function () {
      // a missing frame must not stall the runway — count it and move on
      loaded++;
      if (!revealed) { bumpBoot(); if (loaded >= RUNWAY) reveal(); }
      done();
    };
    img.src = src(i);
  }

  function pump() {
    if (next >= TOTAL) return;
    var i = next++;
    loadOne(i, function () {
      // stagger background loading so decoding never fights the first paint
      if (revealed) setTimeout(pump, 0); else pump();
    });
  }

  function startLoading() {
    var lanes = Math.min(CONCURRENCY, TOTAL);
    for (var i = 0; i < lanes; i++) pump();
  }

  /* ---------------------------------------------------------- reveal ---- */

  function reveal() {
    if (revealed) return;
    revealed = true;
    if (bootFill) bootFill.style.transform = 'scaleX(1)';
    if (bootPct) bootPct.textContent = '100%';
    draw(0, true);
    setTimeout(function () {
      if (boot) boot.classList.add('is-gone');
      d.documentElement.classList.add('booted');
      if (poster) poster.classList.add('is-off');
      setTimeout(function () { if (boot) boot.style.display = 'none'; }, 800);
      w.dispatchEvent(new CustomEvent('baza:ready'));
    }, 180);
  }

  // hard safety net: never hold the page hostage to the network
  setTimeout(function () { if (!revealed) reveal(); }, 6000);

  /* ------------------------------------------------------------ draw ---- */

  function fit() {
    if (!cv || !ctx) return;
    var r = cv.getBoundingClientRect();
    // the source art is 1916px wide, so rendering past that resolves nothing
    var dpr = Math.min(w.devicePixelRatio || 1, 2, 1920 / Math.max(1, r.width));
    dpr = Math.max(1, dpr);
    var cw = Math.round(r.width * dpr), ch = Math.round(r.height * dpr);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    box.w = cw; box.h = ch;
    lastDrawn = -1;                       // force a repaint at the new size
  }

  // nearest already-decoded frame, so a gap never shows a blank canvas
  function pick(i) {
    if (frames[i]) return frames[i];
    for (var k = 1; k < 14; k++) {
      if (frames[i - k]) return frames[i - k];
      if (frames[i + k]) return frames[i + k];
    }
    return null;
  }

  function draw(i, force) {
    if (!ctx || !box.w) return;
    i = Math.max(0, Math.min(TOTAL - 1, Math.round(i)));
    if (i === lastDrawn && !force) return;
    var img = pick(i);
    if (!img) return;
    lastDrawn = i;

    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    // cover fit — the frames are full-bleed art, letterboxing would look broken
    var s = Math.max(box.w / iw, box.h / ih);
    var dw = iw * s, dh = ih * s;
    var dx = (box.w - dw) * .5, dy = (box.h - dh) * .5;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, box.w, box.h);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /* ----------------------------------------------------------- scene ---- */

  var hero = d.getElementById('hero');
  var hint = d.getElementById('heroHint');

  if (hero && cv) {
    fit();
    B.onResize(function () {
      var wasPortrait = portrait;
      portrait = w.innerWidth < 760 || w.innerHeight > w.innerWidth;
      fit();
      if (portrait !== wasPortrait) {
        // orientation flipped into the other art set: swap sources and refill
        dirOpen = portrait ? 'seqm5' : 'seqd';
        dirClose = portrait ? 'closem5' : 'seqdc';
        frames = new Array(TOTAL); loaded = 0; next = 0; lastDrawn = -1;
        startLoading();
      }
      draw(cur, true);
    });

    B.scene({
      el: hero,
      name: 'hero',
      bg: '[data-bg="hero"]',
      margin: 0.2,
      // the hint is position:fixed. Jumping straight to a deep anchor would
      // otherwise strand it, lit, over whichever universe you landed in.
      exit: function () { if (hint) hint.classList.add('is-off'); },
      enter: function () { if (hint) hint.classList.remove('is-off'); },
      update: function (p, r) {
        var vh = w.innerHeight;
        var span = Math.max(1, r.height - vh);
        var t = B.clamp(-r.top / span, 0, 1);

        // frames run across the first 76% of the pin; the tail is the outro
        var ft = B.clamp(t / 0.76, 0, 1);
        target = ft * (TOTAL - 1);

        if (B.env.reduce) { cur = target; }
        else { cur += (target - cur) * B.damp(0.22, 1 / 60); }

        draw(cur);

        if (hint) {
          var o = 1 - B.clamp(t * 14, 0, 1);
          hint.style.opacity = o;
          hint.style.visibility = o < 0.02 ? 'hidden' : 'visible';
        }
      }
    });
  }

  // Start pulling frames right away; the CSS poster covers the first paint.
  // The bundle appends its catalogue at the very end of the body (20MB of
  // base64 in the head would mean nothing paints until it is all parsed), so
  // there we wait for the document before reading it.
  bumpBoot();
  if (w.__bundled) {
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', startLoading);
    else startLoading();
  } else {
    startLoading();
  }
})(window, document);
