/* ═══════════════════════════════════════════════════════════════════════
   scenes.js — the ten worlds, drawn on one shared canvas.

   Each scene is a pure draw(ctx, S) call. S carries the canvas box, the
   world's own 0…1 scroll progress, elapsed time, and the alpha the sky
   engine wants it painted at. Two scenes are drawn per frame at most: the
   one you are in and the one you are dissolving into.
   ═══════════════════════════════════════════════════════════════════════ */
window.SCENES = (function () {
  'use strict';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  /* deterministic noise so a scene looks identical on every repaint */
  const rnd = (i) => { const v = Math.sin(i * 12.9898) * 43758.5453; return v - Math.floor(v); };

  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, Math.ceil(w), Math.ceil(h)); }

  /* ═══ 0 · FLAPPY BIRD ════════════════════════════════════════════════
     The bird's x is pinned to the viewport; the pipe field scrolls past at
     a rate the page scroll drives, so flying and reading are the same act.
     A flap adds upward velocity on top — the bird is never fully autopilot. */
  const flappy = {
    bird: { y: 0, v: 0, wing: 0 },
    pipes: null,
    passed: 0,
    init(S) {
      this.bird.y = S.h * 0.3;
      this.pipes = [];
      /* the gap always leaves room for both halves, so every pair is a
         real Flappy pair rather than a lone pipe hanging from the top */
      for (let i = 0; i < 22; i++) {
        this.pipes.push({ i, gap: 0.16 + rnd(i * 3.1) * 0.3 });
      }
    },
    flap() { this.bird.v = -0.75; },
    draw(ctx, S) {
      if (!this.pipes) this.init(S);
      const { w, h, t, dt, p } = S;
      const groundH = Math.max(52, h * 0.11);
      const skyH = h - groundH;

      /* clouds — two parallax bands */
      ctx.globalAlpha = S.a * 0.9;
      for (let i = 0; i < 7; i++) {
        const sp = 0.24 + (i % 3) * 0.16;
        const cx = ((rnd(i) * 1.6 - 0.3) * w - t * 12 * sp) % (w * 1.6);
        const x = cx < -w * 0.3 ? cx + w * 1.6 : cx;
        const y = skyH * (0.08 + rnd(i + 40) * 0.4);
        const s = (0.7 + rnd(i + 80) * 0.7) * clamp(w / 1200, .55, 1.15);
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.beginPath();
        ctx.arc(x, y, 17 * s, 0, 6.284);
        ctx.arc(x + 20 * s, y - 8 * s, 23 * s, 0, 6.284);
        ctx.arc(x + 44 * s, y, 17 * s, 0, 6.284);
        ctx.rect(x, y, 44 * s, 19 * s);
        ctx.fill();
      }

      /* the bushes band, straight out of the original sprite sheet */
      const bushY = skyH - 46;
      ctx.fillStyle = '#5ee270';
      for (let i = 0; i < 40; i++) {
        const bx = ((i * 74) - ((t * 26) % 74) + (p * -w * 0.35)) % (w + 160) - 80;
        ctx.beginPath();
        ctx.arc(bx, bushY + 30, 30, Math.PI, 0);
        ctx.fill();
      }
      px(ctx, 0, bushY + 28, w, skyH - bushY - 26, '#4fce62');

      /* PIPES — the field slides left with page scroll */
      const SPAN = 430 * clamp(w / 1100, .68, 1.25);
      const off = p * SPAN * 14 + t * 14;
      const pipeW = 74 * clamp(w / 1100, .62, 1.15);
      for (const pipe of this.pipes) {
        const x = w * 0.62 + pipe.i * SPAN - off;
        if (x < -pipeW * 2 || x > w + pipeW) continue;
        const gapY = skyH * pipe.gap;
        const gapH = Math.max(190, skyH * 0.34);
        drawPipe(ctx, x, 0, pipeW, gapY, true);
        drawPipe(ctx, x, gapY + gapH, pipeW, skyH - gapY - gapH, false);
      }

      /* ground */
      px(ctx, 0, skyH, w, groundH, '#ded895');
      px(ctx, 0, skyH, w, 6, '#5ee270');
      px(ctx, 0, skyH + 6, w, 5, '#3aa64a');
      ctx.fillStyle = '#d0be7a';
      for (let i = 0; i < Math.ceil(w / 24) + 2; i++) {
        const gx = i * 24 - ((t * 40 + p * w * 3) % 24);
        ctx.beginPath();
        ctx.moveTo(gx, skyH + 12); ctx.lineTo(gx + 12, skyH + 12);
        ctx.lineTo(gx + 6, groundH + skyH); ctx.lineTo(gx - 6, groundH + skyH);
        ctx.fill();
      }

      /* The bird flies itself: it aims for the gap of the pipe it is about
         to pass, so it always looks like a run in progress. A flap adds a
         real impulse on top, which decays — the reader can help, not crash. */
      const b = this.bird;
      const bx = w < 760 ? w * 0.74 : w * 0.5;   /* clear of the stacked column on a phone */
      let aim = skyH * 0.42, best = 1e9;
      for (const pipe of this.pipes) {
        const x = w * 0.62 + pipe.i * SPAN - off;
        const d = x - bx;
        if (d > -pipeW && d < best) { best = d; aim = skyH * pipe.gap + Math.max(190, skyH * 0.34) * 0.5; }
      }
      b.v += (aim - b.y) * 0.00028 * dt;          /* seek the gap          */
      b.v += 0.0004 * dt;                          /* a little gravity      */
      b.v *= Math.pow(0.94, dt / 16);              /* damping, no wobble    */
      b.v = clamp(b.v, -1.1, 1.1);
      b.y += b.v * dt * 0.42;
      b.y = clamp(b.y, 26, skyH - 34);
      b.wing += dt * 0.012;
      /* The bird is NOT drawn here. It lives on its own canvas inside the
         hero, above the copy's haze, so the sprite never washes out. */
      this.pose = { x: bx, y: b.y, rot: clamp(b.v * 40, -26, 32),
                    wing: Math.sin(b.wing) > 0 ? 1 : 0, s: clamp(w / 620, 1.2, 2.3) };
      ctx.globalAlpha = 1;
    },
    /* called by the hero's own canvas each frame */
    paintBird(ctx, alpha) {
      const p = this.pose; if (!p) return;
      ctx.globalAlpha = alpha;
      drawBird(ctx, p.x, p.y, p.rot, p.wing, p.s);
      ctx.globalAlpha = 1;
    }
  };

  function drawPipe(ctx, x, y, w, h, top) {
    if (h <= 0) return;
    const lipH = 26;
    px(ctx, x, y, w, h, '#74bf2e');
    px(ctx, x + 4, y, 12, h, '#a5e05a');
    px(ctx, x + w - 10, y, 8, h, '#4a8a1c');
    const ly = top ? y + h - lipH : y;
    px(ctx, x - 6, ly, w + 12, lipH, '#74bf2e');
    px(ctx, x - 2, ly, 14, lipH, '#a5e05a');
    px(ctx, x + w - 4, ly, 8, lipH, '#4a8a1c');
    ctx.strokeStyle = '#2f5a12'; ctx.lineWidth = 3;
    ctx.strokeRect(x - 6 + 1.5, ly + 1.5, w + 12 - 3, lipH - 3);
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  }

  function drawBird(ctx, x, y, rot, wing, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(s, s);
    /* the bird reads through the hero's haze because it carries its own
       shadow and a heavy outline, not because the haze gets out of the way */
    ctx.shadowColor = 'rgba(20,60,20,.45)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    px(ctx, -17, -12, 34, 24, '#ffc400');      /* body   */
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    px(ctx, -17, 2, 34, 10, '#f08a1e');        /* belly  */
    px(ctx, 3, -10, 12, 12, '#fff');           /* eye    */
    px(ctx, 8, -7, 5, 6, '#111');
    px(ctx, 15, -1, 11, 7, '#f05a28');         /* beak   */
    px(ctx, -14, wing ? -4 : 2, 15, 9, '#fffdf0'); /* wing */
    ctx.strokeStyle = '#5a3a08'; ctx.lineWidth = 2;
    ctx.strokeRect(-14, wing ? -4 : 2, 15, 9);
    ctx.strokeStyle = '#4a2f06'; ctx.lineWidth = 3;
    ctx.strokeRect(-17, -12, 34, 24);
    ctx.strokeRect(15, -1, 11, 7);
    ctx.restore();
  }

  /* ═══ 1 · PAC-MAN ════════════════════════════════════════════════════
     A real maze, a pellet trail Pac-Man clears as the page scrolls, and the
     ghosts you tick in the copy turn blue and flee here. */
  const pac = {
    eaten: new Set(),
    ghosts: [
      { c: '#ff4d5e', k: 'a' }, { c: '#ff9ad5', k: 'b' },
      { c: '#31e0c8', k: 'c' }, { c: '#ffa94d', k: 'd' }
    ],
    scare: 0,
    setScared(n) { this.scare = n; },
    draw(ctx, S) {
      const { w, h, t, p } = S;
      const C = 44;
      ctx.globalAlpha = S.a;

      /* maze walls: rounded double-line corridors */
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(33,42,220,.62)';
      const cols = Math.ceil(w / C) + 1, rows = Math.ceil(h / C) + 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const f = rnd(r * 31.7 + c * 7.3);
          const x = c * C, y = r * C;
          ctx.beginPath();
          if (f < 0.2) { ctx.moveTo(x + 7, y + C / 2); ctx.lineTo(x + C - 7, y + C / 2); }
          else if (f < 0.4) { ctx.moveTo(x + C / 2, y + 7); ctx.lineTo(x + C / 2, y + C - 7); }
          else if (f < 0.52) { ctx.arc(x + C / 2, y + C / 2, C / 2 - 7, 0, 1.571); }
          else if (f < 0.6) { ctx.arc(x + C / 2, y + C / 2, C / 2 - 7, 3.142, 4.712); }
          else continue;
          ctx.stroke();
        }
      }

      /* the pellet lane Pac-Man is clearing */
      const laneY = h * 0.9;
      const head = p * (w + 240) - 60;
      for (let i = 0; i < Math.ceil(w / 34) + 2; i++) {
        const px2 = i * 34 + 18;
        if (px2 < head) continue;
        const big = i % 7 === 3;
        ctx.beginPath();
        ctx.arc(px2, laneY, big ? 7 : 3, 0, 6.284);
        ctx.fillStyle = big ? 'rgba(255,212,38,' + (0.55 + 0.45 * Math.sin(t * 5)) + ')' : 'rgba(255,212,38,.75)';
        ctx.fill();
      }

      /* Pac-Man */
      const mouth = Math.abs(Math.sin(t * 9)) * 0.33;
      ctx.beginPath();
      ctx.moveTo(head, laneY);
      ctx.arc(head, laneY, 21, mouth, 6.284 - mouth);
      ctx.closePath();
      ctx.fillStyle = '#ffd426';
      ctx.shadowColor = 'rgba(255,212,38,.6)'; ctx.shadowBlur = 22;
      ctx.fill(); ctx.shadowBlur = 0;

      /* the four ghosts, trailing him; ticked ones turn blue and run */
      this.ghosts.forEach((g, i) => {
        const scared = i < this.scare;
        const gx = head - 74 - i * 52 + Math.sin(t * 2 + i) * 6;
        ghost(ctx, gx, laneY, scared ? '#2b3bff' : g.c, scared, t + i);
      });
      ctx.globalAlpha = 1;
    }
  };

  function ghost(ctx, x, y, c, scared, t) {
    const r = 17;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y - 2, r, Math.PI, 0);
    ctx.lineTo(x + r, y + r - 4);
    for (let i = 0; i < 3; i++) {
      const sx = x + r - (i * 2 + 1) * (r / 3);
      ctx.quadraticCurveTo(sx, y + r + (i % 2 ? -6 : 4), sx - r / 3, y + r - 4);
    }
    ctx.closePath();
    ctx.fill();
    if (scared) {
      ctx.fillStyle = '#fff';
      px(ctx, x - 8, y - 6, 5, 5, '#fff'); px(ctx, x + 4, y - 6, 5, 5, '#fff');
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) ctx.lineTo(x - 9 + i * 4.5, y + 5 + (i % 2 ? -3 : 3));
      ctx.stroke();
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x - 6, y - 4, 5.5, 0, 6.284); ctx.arc(x + 6, y - 4, 5.5, 0, 6.284); ctx.fill();
      ctx.fillStyle = '#1b2bff';
      const dx = Math.cos(t) * 1.6;
      ctx.beginPath(); ctx.arc(x - 6 + dx, y - 4, 2.6, 0, 6.284); ctx.arc(x + 6 + dx, y - 4, 2.6, 0, 6.284); ctx.fill();
    }
  }

  /* ═══ 2 · MORTAL KOMBAT ══════════════════════════════════════════════
     The pit: embers rising, chains, and two fighters lit from below. */
  const mk = {
    draw(ctx, S) {
      const { w, h, t } = S;
      ctx.globalAlpha = S.a;

      /* the fire pit glow */
      const g = ctx.createRadialGradient(w / 2, h * 1.05, 10, w / 2, h * 1.05, h * 0.9);
      g.addColorStop(0, 'rgba(255,170,40,.7)');
      g.addColorStop(0.4, 'rgba(220,70,10,.28)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

      /* chains hanging in the arena */
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 4;
      for (let i = 0; i < 7; i++) {
        const cx = (i + 0.5) * (w / 7) + Math.sin(t * 0.5 + i) * 8;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.quadraticCurveTo(cx + 10, h * 0.3, cx, h * 0.56);
        ctx.stroke();
      }

      /* two silhouettes squaring up */
      ctx.fillStyle = 'rgba(0,0,0,.72)';
      fighter(ctx, w * 0.22, h * 0.95, h * 0.42, 1, t);
      fighter(ctx, w * 0.78, h * 0.95, h * 0.42, -1, t + 1.6);

      /* embers */
      for (let i = 0; i < 60; i++) {
        const sp = 0.3 + rnd(i) * 0.8;
        const y = h - ((t * 60 * sp + rnd(i + 9) * h) % (h + 80));
        const x = rnd(i + 3) * w + Math.sin(t * 1.4 + i) * 16;
        const a = clamp(y / h, 0, 1);
        ctx.fillStyle = 'rgba(255,' + (120 + rnd(i + 5) * 110 | 0) + ',40,' + (a * 0.7).toFixed(2) + ')';
        ctx.fillRect(x, y, 2.5, 5);
      }
      ctx.globalAlpha = 1;
    }
  };

  function fighter(ctx, x, base, hh, dir, t) {
    const s = hh / 100, bob = Math.sin(t * 2) * 2;
    ctx.save(); ctx.translate(x, base + bob); ctx.scale(dir * s, s);
    ctx.beginPath();
    ctx.ellipse(0, -84, 13, 15, 0, 0, 6.284);                  /* head  */
    ctx.fill();
    ctx.fillRect(-16, -70, 32, 40);                             /* torso */
    ctx.fillRect(-30, -66, 20, 12);                             /* arm   */
    ctx.fillRect(10, -60, 26, 11);                              /* punch */
    ctx.fillRect(-20, -30, 15, 30); ctx.fillRect(4, -30, 15, 30); /* legs */
    ctx.fillRect(-26, -3, 24, 6); ctx.fillRect(2, -3, 26, 6);   /* feet  */
    ctx.restore();
  }

  /* ═══ 3 · SUPER MARIO ════════════════════════════════════════════════ */
  const mario = {
    hero: { x: 0, y: 0, vy: 0, jumping: false, target: null },
    jumpTo(fx) { this.hero.target = fx; },
    draw(ctx, S) {
      const { w, h, t, p } = S;
      ctx.globalAlpha = S.a;
      const groundY = h - Math.max(64, h * 0.13);

      /* clouds + hills, parallaxed by scroll */
      const cs = clamp(w / 1200, .5, 1.15);
      for (let i = 0; i < 8; i++) {
        const x = ((rnd(i) * 1.4 - .2) * w - t * 9 - p * w * .3) % (w * 1.4);
        const cx = x < -w * .2 ? x + w * 1.4 : x;
        const y = h * (0.08 + rnd(i + 20) * 0.34);
        cloud(ctx, cx, y, (0.7 + rnd(i + 30) * 0.6) * cs);
      }
      ctx.fillStyle = '#3aa64a';
      for (let i = 0; i < 5; i++) {
        const hx = ((i / 4) * w * 1.3 - p * w * 0.5) % (w * 1.3);
        ctx.beginPath(); ctx.arc(hx, groundY + 20, 90 + rnd(i) * 70, Math.PI, 0); ctx.fill();
      }
      ctx.fillStyle = '#2f8c3d';
      for (let i = 0; i < 4; i++) {
        const hx = ((i / 3) * w * 1.2 - p * w * 0.28 + 120) % (w * 1.2);
        ctx.beginPath(); ctx.arc(hx, groundY + 34, 130 + rnd(i + 7) * 60, Math.PI, 0); ctx.fill();
      }

      /* brick floor */
      px(ctx, 0, groundY, w, h - groundY, '#c8641e');
      for (let x = -((p * w * 2) % 48); x < w; x += 48) {
        for (let y = groundY; y < h; y += 24) {
          ctx.strokeStyle = 'rgba(90,40,8,.85)'; ctx.lineWidth = 2;
          ctx.strokeRect(x + ((y - groundY) / 24 % 2 ? 24 : 0), y, 48, 24);
        }
      }
      px(ctx, 0, groundY, w, 5, '#f0a35a');

      /* Mario: idles, and jumps to whichever block was clicked */
      const m = this.hero;
      const want = m.target == null ? w * 0.12 + p * w * 0.7 : m.target;
      m.x = lerp(m.x || want, want, 0.08);
      if (m.jumping) {
        m.vy += 0.055 * S.dt;
        m.y += m.vy * S.dt * 0.06;
        if (m.y >= 0) { m.y = 0; m.vy = 0; m.jumping = false; }
      }
      guy(ctx, m.x, groundY + m.y, Math.sin(t * 12) > 0 ? 1 : 0, m.jumping, clamp(w / 1100, .8, 1.3));
      ctx.globalAlpha = 1;
    },
    jump() { if (!this.hero.jumping) { this.hero.jumping = true; this.hero.vy = -1.55; } }
  };

  function cloud(ctx, x, y, s) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 17 * s, 0, 6.284);
    ctx.arc(x + 21 * s, y - 9 * s, 23 * s, 0, 6.284);
    ctx.arc(x + 45 * s, y, 17 * s, 0, 6.284);
    ctx.rect(x, y, 45 * s, 18 * s);
    ctx.fill();
  }
  function guy(ctx, x, base, step, air, s) {
    ctx.save(); ctx.translate(x, base); ctx.scale(s, s);
    px(ctx, -11, -46, 22, 9, '#e5312b');                       /* cap    */
    px(ctx, -14, -40, 8, 5, '#e5312b');
    px(ctx, -9, -37, 18, 12, '#f0b088');                       /* face   */
    px(ctx, 2, -34, 4, 4, '#3a2410');
    px(ctx, -9, -28, 12, 4, '#6b3410');                        /* 'stache */
    px(ctx, -12, -25, 24, 16, '#2a5bd7');                      /* overalls */
    px(ctx, -16, -24, 6, 12, '#e5312b'); px(ctx, 10, -24, 6, 12, '#e5312b');
    if (air) { px(ctx, -12, -10, 9, 8, '#2a5bd7'); px(ctx, 4, -10, 9, 8, '#2a5bd7'); }
    else if (step) { px(ctx, -12, -9, 9, 9, '#2a5bd7'); px(ctx, 3, -9, 9, 9, '#2a5bd7'); }
    else { px(ctx, -9, -9, 9, 9, '#2a5bd7'); px(ctx, 1, -9, 9, 9, '#2a5bd7'); }
    px(ctx, -15, -2, 13, 5, '#5a3a10'); px(ctx, 3, -2, 13, 5, '#5a3a10');
    ctx.restore();
  }

  /* ═══ 4 · TETRIS ═════════════════════════════════════════════════════ */
  const PIECES = [
    [[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]],
    [[0, 1, 1], [1, 1, 0]], [[1, 1, 0], [0, 1, 1]],
    [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]]
  ];
  const PCOL = ['#31e0c8', '#f7c948', '#b45cff', '#3fae4a', '#ff4d2e', '#3d7bff', '#ff9e2c'];
  const tetris = {
    bg: null,
    draw(ctx, S) {
      const { w, h, t } = S;
      ctx.globalAlpha = S.a;
      const C = 34;
      ctx.strokeStyle = 'rgba(255,255,255,.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += C) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += C) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

      if (!this.bg) {
        this.bg = [];
        for (let i = 0; i < 16; i++) {
          this.bg.push({ p: (i * 7) % PIECES.length, x: rnd(i) * w, y: rnd(i + 5) * h,
                         v: 0.02 + rnd(i + 9) * 0.05, r: (rnd(i + 3) * 4 | 0) });
        }
      }
      /* ambient tetrominoes drifting down behind the copy */
      this.bg.forEach((b, i) => {
        b.y += b.v * S.dt;
        if (b.y > h + 120) { b.y = -120; b.x = rnd(i + t | 0) * w; }
        const sh = PIECES[b.p], col = PCOL[b.p];
        ctx.globalAlpha = S.a * 0.2;
        for (let r = 0; r < sh.length; r++) {
          for (let c = 0; c < sh[r].length; c++) {
            if (!sh[r][c]) continue;
            px(ctx, b.x + c * 24, b.y + r * 24, 22, 22, col);
          }
        }
      });
      ctx.globalAlpha = 1;
    }
  };

  /* ═══ 5 · SHREK'S SWAMP ══════════════════════════════════════════════ */
  const shrek = {
    draw(ctx, S) {
      const { w, h, t } = S;
      ctx.globalAlpha = S.a;

      /* layered bog hills */
      for (let l = 0; l < 3; l++) {
        ctx.beginPath(); ctx.moveTo(0, h);
        const base = h * (0.6 + l * 0.14), amp = 22 + l * 16;
        for (let x = 0; x <= w; x += 22) ctx.lineTo(x, base + Math.sin(x * 0.006 + l * 2 + t * 0.12) * amp);
        ctx.lineTo(w, h); ctx.closePath();
        ctx.fillStyle = 'rgba(' + [26 + l * 14, 56 + l * 24, 18 + l * 10].join(',') + ',.72)';
        ctx.fill();
      }
      /* the water line, with bubbles Shrek would approve of */
      const wl = h * 0.86;
      ctx.fillStyle = 'rgba(58,92,30,.5)'; ctx.fillRect(0, wl, w, h - wl);
      for (let i = 0; i < 26; i++) {
        const by = wl - ((t * 18 * (0.4 + rnd(i) * 0.8) + rnd(i + 4) * 200) % 220);
        const bx = rnd(i + 2) * w + Math.sin(t + i) * 10;
        ctx.beginPath(); ctx.arc(bx, by, 2 + rnd(i + 6) * 4, 0, 6.284);
        ctx.strokeStyle = 'rgba(190,230,120,.32)'; ctx.lineWidth = 1.4; ctx.stroke();
      }
      /* hanging vines + fireflies */
      ctx.strokeStyle = 'rgba(88,138,48,.42)'; ctx.lineWidth = 2;
      for (let i = 0; i < 22; i++) {
        const vx = rnd(i + 11) * w, vh = 60 + rnd(i + 13) * 200, sw = Math.sin(t * 0.6 + i) * 12;
        ctx.beginPath(); ctx.moveTo(vx, 0);
        ctx.quadraticCurveTo(vx + sw * 0.6, vh * 0.55, vx + sw, vh);
        ctx.stroke();
        for (let k = 1; k <= 3; k++) {
          const ly = (vh / 4) * k, lx = vx + sw * (ly / vh);
          ctx.beginPath();
          ctx.ellipse(lx + (k % 2 ? 7 : -7), ly, 8, 3.4, k % 2 ? .5 : -.5, 0, 6.284);
          ctx.fillStyle = 'rgba(120,178,66,.34)'; ctx.fill();
        }
      }
      for (let i = 0; i < 40; i++) {
        const a = t * (0.3 + rnd(i) * 0.5) + i;
        const fx = rnd(i + 21) * w + Math.cos(a) * 26;
        const fy = rnd(i + 31) * h + Math.sin(a * 1.4) * 20;
        ctx.beginPath(); ctx.arc(fx, fy, 1.4 + rnd(i + 41) * 1.8, 0, 6.284);
        ctx.fillStyle = 'rgba(216,236,132,' + (0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2.4 + i))).toFixed(2) + ')';
        ctx.shadowColor = 'rgba(190,230,110,.9)'; ctx.shadowBlur = 9; ctx.fill(); ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
    }
  };

  /* ═══ 6 · GAME BOY ═══════════════════════════════════════════════════ */
  const gb = {
    draw(ctx, S) {
      const { w, h, t } = S;
      ctx.globalAlpha = S.a;
      /* the DMG dot-matrix, scaled up until it is unmistakably a Game Boy */
      const C = 7;
      for (let y = 0; y < h; y += C) {
        for (let x = 0; x < w; x += C) {
          const v = Math.sin((x * 0.01 + y * 0.013) + t * 0.5) * 0.5 + 0.5;
          if (v > 0.72) px(ctx, x, y, C - 2, C - 2, 'rgba(139,172,15,.12)');
        }
      }
      /* scanline sweep, like an LCD refresh */
      const sy = (t * 90) % (h + 200) - 100;
      const g = ctx.createLinearGradient(0, sy - 60, 0, sy + 60);
      g.addColorStop(0, 'rgba(155,188,15,0)');
      g.addColorStop(.5, 'rgba(155,188,15,.07)');
      g.addColorStop(1, 'rgba(155,188,15,0)');
      ctx.fillStyle = g; ctx.fillRect(0, sy - 60, w, 120);
      ctx.globalAlpha = 1;
    }
  };

  /* ═══ 7 · INDIANA JONES MAP ══════════════════════════════════════════ */
  const map = {
    draw(ctx, S) {
      const { w, h, t } = S;
      ctx.globalAlpha = S.a;
      /* parchment blotches */
      for (let i = 0; i < 26; i++) {
        const x = rnd(i) * w, y = rnd(i + 3) * h, r = 60 + rnd(i + 7) * 190;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(120,88,44,.16)');
        g.addColorStop(1, 'rgba(120,88,44,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.284); ctx.fill();
      }
      /* graticule, drawn like an old chart */
      ctx.strokeStyle = 'rgba(60,40,18,.2)'; ctx.lineWidth = 1;
      for (let i = 0; i <= 14; i++) { const x = (i / 14) * w; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let i = 0; i <= 8; i++) { const y = (i / 8) * h; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      /* compass rose */
      const cx = w * 0.86, cy = h * 0.2, R = Math.min(w, h) * 0.09;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.06);
      ctx.strokeStyle = 'rgba(70,46,20,.34)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.284); ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 6.284, l = i % 2 ? R * 0.55 : R;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  };

  /* ═══ 8 · THE MATRIX ═════════════════════════════════════════════════ */
  const matrix = {
    cols: null, lastW: 0,
    draw(ctx, S) {
      const { w, h, dt } = S;
      const CW = 16;
      if (!this.cols || this.lastW !== w) {
        this.lastW = w; this.cols = [];
        for (let i = 0; i < Math.ceil(w / CW); i++) {
          this.cols.push({ y: rnd(i) * -h, v: 0.09 + rnd(i + 4) * 0.24, len: 8 + (rnd(i + 8) * 22 | 0) });
        }
      }
      ctx.globalAlpha = S.a;
      ctx.font = '600 15px "JetBrains Mono", monospace';
      ctx.textBaseline = 'top';
      const G = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789БАЗАБАЗА';
      this.cols.forEach((c, i) => {
        c.y += c.v * dt;
        if (c.y - c.len * 18 > h) { c.y = -20; c.len = 8 + (rnd(i + (S.t | 0)) * 22 | 0); }
        for (let k = 0; k < c.len; k++) {
          const y = c.y - k * 18;
          if (y < -20 || y > h) continue;
          const ch = G[(i * 7 + k * 3 + (S.t * 6 | 0)) % G.length];
          ctx.fillStyle = k === 0 ? 'rgba(220,255,230,.95)'
            : 'rgba(60,255,120,' + (0.72 * (1 - k / c.len)).toFixed(2) + ')';
          ctx.fillText(ch, i * CW, y);
        }
      });
      ctx.globalAlpha = 1;
    }
  };

  /* ═══ 9 · STAR WARS ══════════════════════════════════════════════════ */
  const sw = {
    stars: null,
    draw(ctx, S) {
      const { w, h, dt } = S;
      if (!this.stars) {
        this.stars = [];
        for (let i = 0; i < 220; i++) {
          this.stars.push({ x: rnd(i) * w, y: rnd(i + 2) * h, z: 0.2 + rnd(i + 5) * 0.9, r: 0.4 + rnd(i + 8) * 1.5 });
        }
      }
      ctx.globalAlpha = S.a;
      this.stars.forEach((s) => {
        s.y -= s.z * dt * 0.012;
        if (s.y < -3) { s.y = h + 3; s.x = Math.random() * w; }
        ctx.beginPath(); ctx.arc(s.x % w, s.y, s.r * s.z, 0, 6.284);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + s.z * 0.6).toFixed(2) + ')';
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
  };

  /* the Mario sprite is reused by the in-section floor strip */
  return { flappy, pac, mk, mario, tetris, shrek, gb, map, matrix, sw, marioGuy: guy };
})();
