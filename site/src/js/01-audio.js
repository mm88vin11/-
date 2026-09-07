
/* ==========================================================================
   БАЗА — tiny chiptune synth.
   All sound is generated with oscillators: no sample files, nothing to
   download, nothing licensed. Muted until the visitor turns it on.
   ========================================================================== */
(function (w, d) {
  'use strict';
  var B = w.BAZA;

  var ctx = null, master = null, on = false, unlocked = false;

  function ensure() {
    if (ctx) return ctx;
    var AC = w.AudioContext || w.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.0;
    master.connect(ctx.destination);
    return ctx;
  }

  function unlock() {
    if (unlocked) return;
    var c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    unlocked = true;
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (e) {
    w.addEventListener(e, unlock, { once: true, passive: true });
  });

  /* one note ------------------------------------------------------------- */
  function note(freq, t0, dur, type, vol, glideTo) {
    if (!on || !ctx) return;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    var v = (vol == null ? 0.22 : vol);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }

  /* short noise burst (percussion / splat) -------------------------------- */
  function noise(t0, dur, vol, freq) {
    if (!on || !ctx) return;
    var n = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var ch = buf.getChannelData(0);
    for (var i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
    var g = ctx.createGain(); g.gain.value = vol == null ? 0.18 : vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  var SFX = {
    coin: function () {
      if (!on || !ctx) return; var t = ctx.currentTime;
      note(987.77, t, 0.07, 'square', 0.16);
      note(1318.51, t + 0.07, 0.34, 'square', 0.16);
    },
    bump: function () {
      if (!on || !ctx) return; var t = ctx.currentTime;
      note(180, t, 0.09, 'square', 0.14, 90);
    },
    pipe: function () {
      if (!on || !ctx) return; var t = ctx.currentTime;
      note(700, t, 0.32, 'square', 0.13, 120);
    },
    powerup: function () {
      if (!on || !ctx) return; var t = ctx.currentTime;
      [523, 659, 784, 1046].forEach(function (f, i) {
        note(f, t + i * 0.065, 0.14, 'square', 0.14);
      });
    },
    blip: function () {
      if (!on || !ctx) return; var t = ctx.currentTime;
      note(880, t, 0.05, 'square', 0.09);
    },
    clear: function () {
      if (!on || !ctx) return; var t = ctx.currentTime;
      [1046, 1318, 1568, 2093].forEach(function (f, i) {
        note(f, t + i * 0.045, 0.12, 'triangle', 0.13);
      });
    },
    drop: function () {
      if (!on || !ctx) return; var t = ctx.currentTime;
      noise(t, 0.09, 0.12, 700);
      note(140, t, 0.1, 'square', 0.1, 80);
    },
    portal: function () {
      if (!on || !ctx) return; var t = ctx.currentTime;
      note(220, t, 0.7, 'sawtooth', 0.07, 1400);
      noise(t + 0.05, 0.5, 0.05, 3000);
    },
    splat: function () {
      if (!on || !ctx) return; var t = ctx.currentTime;
      noise(t, 0.22, 0.16, 500);
      note(96, t, 0.2, 'sine', 0.14, 52);
    },
    flap: function () {
      if (!on || !ctx) return; var t = ctx.currentTime;
      noise(t, 0.05, 0.07, 2200);
      note(560, t, 0.05, 'triangle', 0.06, 760);
    },
    // Original swamp riff — five bars of a chunky major groove.
    swamp: function () {
      if (!on || !ctx) return; var t = ctx.currentTime, s = 0.16;
      var mel = [392, 392, 440, 494, 440, 392, 330, 392];
      var bass = [98, 98, 110, 123];
      mel.forEach(function (f, i) { note(f, t + i * s, s * 0.9, 'square', 0.1); });
      bass.forEach(function (f, i) { note(f, t + i * s * 2, s * 1.7, 'triangle', 0.13); });
    },
    // Upside-Down sting: detuned minor drone.
    upside: function () {
      if (!on || !ctx) return; var t = ctx.currentTime;
      note(110, t, 1.5, 'sawtooth', 0.06);
      note(110 * 1.012, t, 1.5, 'sawtooth', 0.06);
      note(164.81, t + 0.2, 1.3, 'sine', 0.05);
    },
    force: function () {
      if (!on || !ctx) return; var t = ctx.currentTime;
      note(146.83, t, 0.9, 'sawtooth', 0.07);
      note(220, t + 0.25, 0.8, 'sawtooth', 0.05);
    }
  };

  var A = (B.audio = {
    sfx: function (name) { if (SFX[name]) SFX[name](); },
    get on() { return on; },
    toggle: function (want) {
      unlock();
      on = (want == null) ? !on : !!want;
      if (master && ctx) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(on ? 0.55 : 0.0, ctx.currentTime, 0.08);
      }
      d.documentElement.classList.toggle('snd-on', on);
      try { localStorage.setItem('baza-snd', on ? '1' : '0'); } catch (e) { }
      return on;
    }
  });

  // Never auto-enable: the visitor asks for sound, sound does not ask for them.
  try { if (localStorage.getItem('baza-snd') === '1') { /* restore on first gesture */
    w.addEventListener('pointerdown', function () { A.toggle(true); }, { once: true, passive: true });
  } } catch (e) { }
})(window, document);


