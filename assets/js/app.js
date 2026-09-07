/* ═══════════════════════════════════════════════════════════════════════
   app.js — БАЗА · Arcade Edition
   One rAF loop, one shared background canvas, ten worlds.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const D = window.BAZA, SC = window.SCENES;
  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp  = (a, b, t) => a + (b - a) * t;

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE    = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const store = {
    get(k, f) { try { const v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch (e) { return f; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k)    { try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* ═══ frame loop + viewport ═══════════════════════════════════════ */
  const loop = (function () {
    const jobs = []; let last = performance.now(), on = false;
    function tick(now) {
      const dt = Math.min(48, now - last); last = now;
      for (let i = 0; i < jobs.length; i++) jobs[i](dt, now);
      requestAnimationFrame(tick);
    }
    return { add(f) { jobs.push(f); if (!on) { on = true; requestAnimationFrame(tick); } } };
  })();

  const vp = { w: 0, h: 0, dpr: 1 };
  function measure() {
    vp.w = window.innerWidth; vp.h = window.innerHeight;
    vp.dpr = Math.min(2, window.devicePixelRatio || 1);
  }
  measure();

  const onResize = (function () {
    const subs = []; let t = 0;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => { measure(); subs.forEach((f) => f()); }, 140);
    }, { passive: true });
    return (f) => subs.push(f);
  })();

  function fitCanvas(cv) {
    const r = cv.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * vp.dpr));
    const h = Math.max(1, Math.round(r.height * vp.dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return { w: r.width, h: r.height, s: vp.dpr };
  }

  /* ═══ boot ════════════════════════════════════════════════════════ */
  (function boot() {
    const el = $('#boot'), fill = $('#bootFill'), txt = $('#bootTxt');
    if (!el) return;
    const steps = ['вставляем картридж…', 'строим мир 1-1…', 'кормим призраков…', 'заводим болото…', 'ready'];
    let p = 0, i = 0;
    const t = setInterval(() => {
      p = Math.min(100, p + 12 + Math.random() * 18);
      fill.style.width = p + '%';
      const ni = Math.min(steps.length - 1, Math.floor(p / 22));
      if (ni !== i) { i = ni; txt.textContent = steps[i]; }
      if (p >= 100) {
        clearInterval(t);
        setTimeout(() => {
          el.classList.add('is-done');
          document.body.classList.remove('is-locked');
          const hero = $('#hero'); if (hero) hero.classList.add('is-live');
          startHeroType();
        }, 240);
      }
    }, REDUCED ? 40 : 180);
  })();

  /* ═══ cursor · toast · score ══════════════════════════════════════ */
  if (FINE && !REDUCED) {
    const cur = $('#cursor');
    let cx = -100, cy = -100, tx = -100, ty = -100;
    window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    document.addEventListener('pointerover', (e) => {
      cur.classList.toggle('is-hot', !!e.target.closest('a, button, input, .qblock, .ghost, .cart, .map-chip'));
    });
    loop.add(() => {
      cx = lerp(cx, tx, .22); cy = lerp(cy, ty, .22);
      cur.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
    });
  }

  let toastT = 0;
  function toast(msg) {
    const el = $('#toast'); if (!el) return;
    el.textContent = msg; el.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('is-on'), 2600);
  }

  const score = (function () {
    const box = $('#hudScore'), n = $('#scoreN');
    let val = 0, shown = 0;
    loop.add(() => {
      shown = Math.abs(val - shown) < .6 ? val : lerp(shown, val, .14);
      if (n) n.textContent = String(Math.round(shown)).padStart(4, '0');
    });
    return { add(v) { val += v; if (box) box.classList.add('is-on'); }, get: () => val };
  })();

  /* ═══ reveal + split ══════════════════════════════════════════════ */
  const io = new IntersectionObserver((ens) => {
    ens.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -10% 0px', threshold: .06 });
  function watch(root) { $$('[data-rise], [data-split]', root).forEach((el) => io.observe(el)); }

  function split(el) {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = '1';
    const walk = (node) => {
      Array.prototype.slice.call(node.childNodes).forEach((ch) => {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          String(ch.nodeValue).split(/(\s+)/).forEach((tok) => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
            const wrd = document.createElement('span');
            wrd.className = 'word';
            tok.split('').forEach((c) => {
              const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; wrd.appendChild(s);
            });
            frag.appendChild(wrd);
          });
          node.replaceChild(frag, ch);
        } else if (ch.nodeType === 1 && !ch.classList.contains('word')) walk(ch);
      });
    };
    walk(el);
    $$('.ch', el).forEach((s, i) => s.style.setProperty('--i', i));
  }
  $$('[data-split]').forEach(split);

  /* ═══════════════════════════════════════════════════════════════════
     THE SKY — cross-fades the ten worlds so no section has a visible edge.

     Each section declares data-world. The viewport centre picks the world;
     inside the first and last slice of a section the two neighbours are
     blended, and the shared canvas paints both scenes at those alphas.
     ═══════════════════════════════════════════════════════════════════ */
  const sky = (function () {
    const wrap = $('#sky'); if (!wrap) return { p: () => 0, world: () => 'flappy' };
    const secs = $$('[data-world]').map((el) => ({ el, k: el.dataset.world, top: 0, h: 1 }));
    const layers = {};
    $$('.sky__l', wrap).forEach((l) => { layers[l.dataset.sky] = l; });
    const cv = $('#skyFx'), ctx = cv.getContext('2d');
    const props = { fight: $('#propFight'), lcd: $('#propLcd'), longago: $('#propLongAgo') };

    let box = fitCanvas(cv);
    function remeasure() {
      box = fitCanvas(cv);
      secs.forEach((s) => {
        const r = s.el.getBoundingClientRect();
        s.top = r.top + window.scrollY;
        s.h = Math.max(1, r.height);
      });
    }
    remeasure();
    onResize(remeasure);
    /* sections change height as fonts land and panels fill in */
    setTimeout(remeasure, 600); setTimeout(remeasure, 1800);

    /* current blend: two worlds and the mix between them */
    const mix = { a: 'flappy', b: 'flappy', k: 0, ia: 0, pa: 0, pb: 0 };
    let lastPa = 0;

    function resolve() {
      const c = window.scrollY + vp.h * 0.5;
      let i = 0;
      for (let j = 0; j < secs.length; j++) if (c >= secs[j].top) i = j;
      const s = secs[i];
      const t = clamp((c - s.top) / s.h, 0, 1);
      /* the blend zone is a fixed slice of the viewport, not of the section,
         so short and tall sections dissolve at the same visual speed */
      const e = clamp(Math.min(vp.h * 0.44, s.h * 0.24) / s.h, .05, .34);

      mix.ia = i;
      if (t < e && i > 0) {
        const k = t / e;
        mix.a = secs[i - 1].k; mix.b = s.k; mix.k = k;
        mix.pa = 1; mix.pb = t;
      } else if (t > 1 - e && i < secs.length - 1) {
        const k = (t - (1 - e)) / e;
        mix.a = s.k; mix.b = secs[i + 1].k; mix.k = k;
        mix.pa = t; mix.pb = 0;
      } else {
        mix.a = mix.b = s.k; mix.k = 0; mix.pa = mix.pb = t;
      }

      for (const key in layers) layers[key].style.setProperty('--a', '0');
      if (mix.a === mix.b) { layers[mix.a] && layers[mix.a].style.setProperty('--a', '1'); }
      else {
        layers[mix.a] && layers[mix.a].style.setProperty('--a', String((1 - mix.k).toFixed(3)));
        layers[mix.b] && layers[mix.b].style.setProperty('--a', String(mix.k.toFixed(3)));
      }

      /* transition props peak exactly on the crossover */
      /* Props are flashes, not washes: cubing the peak keeps them to the
         exact moment of the crossover instead of veiling half a section. */
      const peak = mix.a === mix.b ? 0 : Math.sin(mix.k * Math.PI);
      const flash = peak * peak * peak;
      const pair = mix.a + '>' + mix.b;
      props.fight.style.setProperty('--p', pair === 'pac>mk' ? (peak * peak).toFixed(3) : '0');
      props.fight.style.setProperty('--s', (0.7 + peak * 0.45).toFixed(3));
      props.lcd.style.setProperty('--p', pair === 'shrek>gb' ? (flash * 0.7).toFixed(3) : '0');
      props.longago.style.setProperty('--p', pair === 'matrix>sw' ? (peak * peak).toFixed(3) : '0');
    }

    let T = 0;
    loop.add((dt) => {
      T += dt * 0.001;
      resolve();
      const dpa = mix.pa - lastPa; lastPa = mix.pa;

      ctx.setTransform(box.s, 0, 0, box.s, 0, 0);
      ctx.clearRect(0, 0, box.w, box.h);
      const S = { w: box.w, h: box.h, t: T, dt: dt, p: mix.pa, dp: dpa, a: 1 };

      if (mix.a === mix.b) {
        S.a = 1; S.p = mix.pa;
        SC[mix.a] && SC[mix.a].draw(ctx, S);
      } else {
        S.a = 1 - mix.k; S.p = mix.pa;
        SC[mix.a] && SC[mix.a].draw(ctx, S);
        S.a = mix.k; S.p = mix.pb; S.dp = 0;
        SC[mix.b] && SC[mix.b].draw(ctx, S);
      }
    });
    onResize(() => { box = fitCanvas(cv); });

    return {
      /* progress inside a named world, for the sections that need it */
      p: (k) => (mix.a === k ? mix.pa : mix.b === k ? mix.pb : 0),
      world: () => mix.a,
      remeasure
    };
  })();

  /* ═══ header + nav ════════════════════════════════════════════════ */
  (function header() {
    const head = $('#head'), ink = $('#navInk');
    const items = $$('.nav__item');
    const secs = items.map((a) => $(a.getAttribute('href'))).filter(Boolean);
    let lastY = window.scrollY, active = null;

    function moveInk(el) {
      if (!el || !ink) return;
      const p = el.parentElement.getBoundingClientRect(), r = el.getBoundingClientRect();
      ink.style.width = r.width + 'px';
      ink.style.transform = 'translate3d(' + (r.left - p.left - 5) + 'px,0,0)';
      ink.classList.add('is-on');
    }
    function spy() {
      const y = window.scrollY + vp.h * .34;
      let found = null;
      secs.forEach((s, i) => { if (s.offsetTop <= y) found = items[i]; });
      if (found !== active) {
        items.forEach((a) => a.classList.remove('is-active'));
        active = found;
        if (active) { active.classList.add('is-active'); moveInk(active); }
        else if (ink) ink.classList.remove('is-on');
      }
    }
    let tick = false;
    window.addEventListener('scroll', () => {
      if (tick) return;
      tick = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        head.classList.toggle('is-stuck', y > 24);
        head.classList.toggle('is-hidden', y > 420 && y > lastY + 6 && !$('#menu').classList.contains('is-on'));
        lastY = y; spy();
        const h = document.documentElement.scrollHeight - vp.h;
        $('#hudFill').style.width = (h > 0 ? clamp(y / h, 0, 1) * 100 : 0) + '%';
        tick = false;
      });
    }, { passive: true });
    onResize(() => { if (active) moveInk(active); });
    setTimeout(spy, 200);
  })();

  (function menu() {
    const b = $('#burger'), m = $('#menu');
    function set(on) {
      b.classList.toggle('is-on', on); m.classList.toggle('is-on', on);
      b.setAttribute('aria-expanded', on ? 'true' : 'false');
      document.body.classList.toggle('is-locked', on);
    }
    b.addEventListener('click', () => set(!m.classList.contains('is-on')));
    $$('.menu__link, .menu__foot a', m).forEach((a) => a.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  })();

  const warp = (function () {
    const el = $('#warp'), lbl = $('#warpLabel');
    const COLS = 14, ROWS = 9;
    el.style.setProperty('--cols', COLS); el.style.setProperty('--rows', ROWS);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const i = document.createElement('i');
      i.style.transitionDelay = ((c + r) * 16) + 'ms';
      el.appendChild(i);
    }
    let busy = false;
    return {
      go(target, label) {
        const dest = $(target); if (!dest) return;
        if (REDUCED || busy) { dest.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' }); return; }
        busy = true;
        el.classList.add('is-busy', 'is-in'); el.classList.remove('is-out');
        if (label) { lbl.textContent = label; lbl.classList.add('is-on'); }
        setTimeout(() => {
          window.scrollTo({ top: Math.max(0, dest.getBoundingClientRect().top + window.scrollY - 84), behavior: 'auto' });
          setTimeout(() => {
            el.classList.remove('is-in'); el.classList.add('is-out');
            lbl.classList.remove('is-on');
            setTimeout(() => { el.classList.remove('is-busy'); busy = false; }, 520);
          }, 220);
        }, 440);
      }
    };
  })();

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href === '#') { if (a.dataset.legal) e.preventDefault(); return; }
    const dest = $(href); if (!dest) return;
    e.preventDefault();
    if (a.dataset.warp) warp.go(href, a.dataset.warp);
    else dest.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', href);
  });

  /* ═══ counters ════════════════════════════════════════════════════ */
  (function counters() {
    const cio = new IntersectionObserver((ens) => {
      ens.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target; cio.unobserve(el);
        const to = parseFloat(el.dataset.count) || 0;
        const pre = el.dataset.pre || '', post = el.dataset.post || '';
        if (REDUCED) { el.textContent = pre + to + post; return; }
        const t0 = performance.now();
        (function step(now) {
          const p = clamp((now - t0) / 1200, 0, 1);
          el.textContent = pre + Math.round(to * (1 - Math.pow(1 - p, 3))) + post;
          if (p < 1) requestAnimationFrame(step);
        })(performance.now());
      });
    }, { threshold: .4 });
    $$('[data-count]').forEach((el) => cio.observe(el));
  })();

  /* ═══ WORLD 0 — FLAPPY BIRD ═══════════════════════════════════════
     The bird already rides the page scroll; a click, a tap or the space
     bar adds a real flap on top, and clearing a pipe scores. */
  function startHeroType() {
    const el = $('#heroType'); if (!el) return;
    const lines = [
      'Разбор за три дня — 25 000 ₽.',
      'Работали с брендами одежды, барбершопами, оптом и доставкой.',
      'Ответ приходит от тех, кто будет делать.'
    ];
    if (REDUCED) { el.innerHTML = lines.join('<br>') + '<span class="hero__caret"></span>'; return; }
    let li = 0, ci = 0, out = '';
    (function type() {
      if (li >= lines.length) return;
      const line = lines[li];
      if (ci <= line.length) {
        el.innerHTML = out + line.slice(0, ci) + '<span class="hero__caret"></span>';
        ci++; setTimeout(type, 15 + Math.random() * 24);
      } else { out += line + '<br>'; li++; ci = 0; setTimeout(type, 360); }
    })();
  }

  (function flappy() {
    const hero = $('#hero'), btn = $('#flapBtn'), out = $('#flapScore');
    if (!hero) return;
    let flaps = 0;

    /* the bird's own layer: same pose the sky scene computed, painted above
       the hero haze so its colours stay true */
    const bcv = $('#heroBird');
    if (bcv) {
      const bctx = bcv.getContext('2d');
      let bb = fitCanvas(bcv);
      onResize(() => { bb = fitCanvas(bcv); });
      loop.add(() => {
        const r = hero.getBoundingClientRect();
        bctx.setTransform(bb.s, 0, 0, bb.s, 0, 0);
        bctx.clearRect(0, 0, bb.w, bb.h);
        if (r.bottom < 0 || r.top > vp.h) return;
        /* fades out with the world it belongs to */
        SC.flappy.paintBird(bctx, clamp(1 - Math.max(0, -r.top) / (vp.h * 0.8), 0, 1));
      });
    }
    function flap() {
      SC.flappy.flap();
      flaps++; out.textContent = flaps;
      if (flaps === 10) { score.add(300); toast('Десять взмахов — вы уже играете 🐤'); }
      else score.add(5);
    }
    btn.addEventListener('click', flap);
    /* clicking the hero itself flaps too, but never steals a real control */
    hero.addEventListener('pointerdown', (e) => {
      if (e.target.closest('a, button, input, textarea')) return;
      flap();
    });
    document.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' || e.target.closest('input, textarea, button, a')) return;
      const r = hero.getBoundingClientRect();
      if (r.bottom < 80 || r.top > vp.h) return;
      e.preventDefault(); flap();
    });
  })();

  /* ═══ WORLD 1 — PAC-MAN ═══════════════════════════════════════════ */
  (function symptoms() {
    const picked = new Set();
    const nEl = $('#pacN'), vEl = $('#pacVerdict'), cEl = $('#pacCosts');
    const pellets = $$('#pacPellets i');

    function render() {
      const n = picked.size;
      nEl.textContent = n;
      vEl.textContent = D.VERDICT[n];
      pellets.forEach((p, i) => p.classList.toggle('is-gone', i < n));
      SC.pac.setScared(n);                       /* the backdrop reacts too */
      cEl.innerHTML = '';
      let i = 0;
      picked.forEach((k) => {
        const row = document.createElement('div');
        row.className = 'pac-cost';
        row.style.animationDelay = (i * 70) + 'ms';
        row.innerHTML = '<i aria-hidden="true"></i><span></span>';
        row.lastChild.textContent = D.SYM[k].cost;
        cEl.appendChild(row); i++;
      });
      $('#pacCta').querySelector('span').textContent =
        n === 0 ? 'Посмотреть, как это чинится' : n < 3 ? 'Показать, как это чинится' : 'Показать, во что обойдётся исправить';
      store.set('baza-sym', Array.from(picked));
      window.dispatchEvent(new CustomEvent('baza:sym', { detail: Array.from(picked) }));
    }

    $$('.ghost').forEach((b) => {
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        const k = b.dataset.sym, on = !picked.has(k);
        if (on) { picked.add(k); score.add(200); } else picked.delete(k);
        b.classList.toggle('is-eaten', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        render();
      });
    });
    (store.get('baza-sym', []) || []).forEach((k) => {
      const b = $('.ghost[data-sym="' + k + '"]');
      if (b) { picked.add(k); b.classList.add('is-eaten'); b.setAttribute('aria-pressed', 'true'); }
    });
    render();
  })();

  /* ═══ WORLD 2 — MORTAL KOMBAT ═════════════════════════════════════
     Picking a fighter drains the other side's health bar; BAZA only wins
     the round on the honest count of what each option costs. */
  (function mk() {
    const pick = $('#mkPick'), stat = $('#mkStat');
    const pros = $('#mkPros'), cons = $('#mkCons');
    const hpL = $('#mkHpL'), hpR = $('#mkHpR'), nameR = $('#mkNameR'), fin = $('#mkFinish');
    if (!pick) return;
    let cur = 3;

    D.HIRE.forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mk-card'; b.setAttribute('role', 'tab');
      b.innerHTML = '<span class="mk-card__num" aria-hidden="true">' + (i + 1) + '</span><b></b><span></span>';
      b.querySelector('b').textContent = o.name;
      b.querySelector('b + span').textContent = o.cost;
      b.addEventListener('click', () => select(i, true));
      pick.appendChild(b);
    });

    function list(box, arr, kind) {
      box.innerHTML = '';
      arr.forEach((x, i) => {
        const el = document.createElement('span');
        el.className = 'mk-li mk-li--' + kind;
        el.style.animationDelay = (i * 60) + 'ms';
        el.innerHTML = '<i aria-hidden="true">' + (kind === 'pro' ? '✓' : '✕') + '</i><span></span>';
        el.lastChild.textContent = x;
        box.appendChild(el);
      });
    }

    function select(i, manual) {
      cur = i;
      const o = D.HIRE[i], baza = D.HIRE[3];
      $$('.mk-card', pick).forEach((c, j) => {
        c.classList.toggle('is-on', j === i);
        c.setAttribute('aria-selected', j === i ? 'true' : 'false');
      });
      /* left = the fighter you picked, right = who they are up against */
      $('#mkNameL').textContent = o.name;
      nameR.textContent = i === 3 ? 'Все остальные' : 'БАЗА';
      /* health is what survives the honest count of drawbacks */
      const hit = (x) => clamp(100 - x.cons.length * 26, 12, 100);
      hpL.style.width = hit(o) + '%';
      hpR.style.width = (i === 3 ? 48 : hit(baza)) + '%';

      stat.innerHTML = '<span class="mk-stat__cost"></span><span class="mk-stat__unit"></span><p class="mk-stat__line"></p>';
      stat.querySelector('.mk-stat__cost').textContent = o.cost;
      stat.querySelector('.mk-stat__unit').textContent = o.unit;
      stat.querySelector('.mk-stat__line').textContent = o.line;
      list(pros, o.pros, 'pro');
      list(cons, o.cons, 'con');

      fin.classList.remove('is-on');
      setTimeout(() => {
        fin.textContent = i === 3 ? 'Flawless victory — но проверьте сами' : 'Finish him: ' + o.cons[0];
        fin.classList.add('is-on');
      }, 220);
      if (manual) score.add(90);
    }
    select(cur, false);
  })();

  /* ═══ WORLD 3 — SUPER MARIO ═══════════════════════════════════════
     Clicking a block sends the backdrop Mario running under it; he jumps,
     the block bumps, a coin pops and the panel opens. */
  (function mario() {
    const wrap = $('#blocks'), panel = $('#marioPanel');
    if (!wrap) return;
    let cur = 0; const hit = new Set();

    /* ── the floor strip: bricks, and Mario running and jumping on them ── */
    const fcv = $('#marioCanvas');
    const floorBox = () => (fcv ? fcv.getBoundingClientRect() : { left: 0, width: 1 });
    const runner = {
      x: 40, target: null, y: 0, vy: 0, air: false, step: 0,
      jump() { if (!this.air) { this.air = true; this.vy = -1.75; } }
    };
    if (fcv) {
      const fctx = fcv.getContext('2d');
      let fb = fitCanvas(fcv);
      onResize(() => { fb = fitCanvas(fcv); });
      loop.add((dt) => {
        const r = fcv.getBoundingClientRect();
        if (r.bottom < -40 || r.top > vp.h + 40) return;
        fb = fitCanvas(fcv);
        const w = fb.w, h = fb.h, groundY = h - 34;

        /* walk toward the block that was hit; idle-bounce otherwise */
        const want = runner.target == null ? w * 0.5 : clamp(runner.target, 26, w - 26);
        const moving = Math.abs(want - runner.x) > 2;
        runner.x = lerp(runner.x, want, 0.12);
        runner.step += dt * (moving ? 0.02 : 0.006);
        if (runner.air) {
          runner.vy += 0.055 * dt;
          runner.y += runner.vy * dt * 0.055;
          if (runner.y >= 0) { runner.y = 0; runner.vy = 0; runner.air = false; }
        }

        fctx.setTransform(fb.s, 0, 0, fb.s, 0, 0);
        fctx.clearRect(0, 0, w, h);
        /* brick floor */
        fctx.fillStyle = '#c8641e'; fctx.fillRect(0, groundY, w, h - groundY);
        fctx.fillStyle = '#f0a35a'; fctx.fillRect(0, groundY, w, 4);
        fctx.strokeStyle = 'rgba(90,40,8,.85)'; fctx.lineWidth = 2;
        for (let y = groundY; y < h; y += 13) {
          for (let x = ((y - groundY) / 13 % 2 ? 26 : 0) - 52; x < w; x += 52) {
            fctx.strokeRect(x, y, 52, 13);
          }
        }
        SC.marioGuy(fctx, runner.x, groundY + runner.y,
                    Math.sin(runner.step) > 0 ? 1 : 0, runner.air, 1.45);
      });
    }

    D.SERVICES.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'qblock';
      b.setAttribute('role', 'tab'); b.setAttribute('aria-label', s.label);
      b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      b.innerHTML = '<span class="qblock__q" aria-hidden="true">?</span><span class="qblock__lbl">' + s.short + '</span>';
      b.addEventListener('click', () => bump(i, b));
      wrap.appendChild(b);
    });

    function bump(i, b) {
      /* aim the runner at the block's centre, then jump into it */
      const r = b.getBoundingClientRect(), f = floorBox();
      runner.target = r.left + r.width / 2 - f.left;
      runner.jump();
      b.classList.remove('is-hit'); void b.offsetWidth; b.classList.add('is-hit');
      if (!hit.has(i)) { hit.add(i); score.add(100); }
      b.classList.add('is-used');
      const coin = document.createElement('span');
      coin.className = 'coin-pop'; b.appendChild(coin);
      setTimeout(() => coin.remove(), 700);
      show(i);
    }

    function show(i) {
      cur = i;
      const s = D.SERVICES[i];
      $$('.qblock', wrap).forEach((b, j) => {
        b.classList.toggle('is-on', j === i);
        b.setAttribute('aria-selected', j === i ? 'true' : 'false');
      });
      panel.innerHTML =
        '<div class="mario-panel__txt"><span class="mario-panel__tag"></span><h3></h3><p></p>' +
        '<ul class="mario-panel__list"></ul></div><div class="mario-panel__side"></div>';
      panel.querySelector('.mario-panel__tag').textContent = s.label;
      panel.querySelector('h3').textContent = s.title;
      panel.querySelector('p').textContent = s.desc;
      const ul = panel.querySelector('.mario-panel__list');
      s.inc.forEach((x) => {
        const li = document.createElement('li');
        li.innerHTML = '<i aria-hidden="true">✓</i><span></span>';
        li.lastChild.textContent = x; ul.appendChild(li);
      });
      const side = panel.querySelector('.mario-panel__side');
      s.stat.forEach((st) => {
        const d = document.createElement('div');
        d.className = 'mario-stat';
        d.innerHTML = '<b></b><span></span>';
        d.querySelector('b').textContent = st[0];
        d.querySelector('span').textContent = st[1];
        side.appendChild(d);
      });
      const a = document.createElement('a');
      a.className = 'btn btn--solid'; a.href = '#brief';
      a.dataset.warp = 'World 8 · Matrix';
      a.style.cssText = 'background:#12233d;border-color:#12233d;color:#fffaf0';
      a.innerHTML = '<span>Обсудить это направление</span>';
      side.appendChild(a);
    }
    show(0);
  })();

  /* ═══ WORLD 4 — TETRIS (playable) ═════════════════════════════════
     A real well: arrows or the on-screen pad move and rotate, space drops.
     Clearing lines is what raises the tier, so playing IS the price picker. */
  const pricing = (function tetris() {
    const input = $('#forkInput'), fill = $('#forkFill'), stops = $('#forkStops');
    const rows = $('#forkRows'), tiersBox = $('#tiers');
    const cap = $('#forkCap'), nm = $('#forkName'), tm = $('#forkTerm'), cut = $('#forkCut');
    const lvlEl = $('#tetLevel'), nameEl = $('#tetName');
    if (!input) return { set() {} };
    let cur = 0;

    D.FORK.forEach((f, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'fork__stop';
      b.innerHTML = '<span></span><b></b>';
      b.querySelector('span').textContent = f.short;
      b.querySelector('b').textContent = f.name.replace(/^Сделать /, '').replace(/^Сначала /, '');
      b.addEventListener('click', () => set(i, true));
      stops.appendChild(b);
    });

    D.TIERS.forEach((t) => {
      const c = document.createElement('div');
      c.className = 'tier';
      c.innerHTML =
        '<span class="tier__flag" hidden>советуем</span><div class="tier__nm"></div>' +
        '<div class="tier__pr"></div><div class="tier__tm"></div><p class="tier__ds"></p>' +
        '<ul class="tier__inc"></ul><a class="btn" href="#brief" data-warp="World 8 · Matrix"><span></span></a>';
      c.querySelector('.tier__nm').textContent = t.name;
      c.querySelector('.tier__pr').textContent = t.price;
      c.querySelector('.tier__tm').textContent = t.term;
      c.querySelector('.tier__ds').textContent = t.desc;
      const ul = c.querySelector('.tier__inc');
      t.inc.forEach((x) => {
        const li = document.createElement('li');
        li.innerHTML = '<i aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></i><span></span>';
        li.lastChild.textContent = x; ul.appendChild(li);
      });
      c.querySelector('.btn span').textContent = t.cta;
      tiersBox.appendChild(c);
    });

    function set(i, fromClick) {
      cur = clamp(i | 0, 0, 3);
      input.value = cur;
      fill.style.width = ((cur / 3) * 100) + '%';
      const f = D.FORK[cur], t = D.TIERS[cur];
      cap.textContent = f.cap; nm.textContent = f.name; tm.textContent = f.term; cut.textContent = f.cut;
      lvlEl.textContent = 'LV ' + (cur + 1);
      nameEl.textContent = t.name.length > 26 ? t.name.slice(0, 24) + '…' : t.name;
      $$('.fork__stop', stops).forEach((b, j) => b.classList.toggle('is-on', j === cur));

      rows.innerHTML = '';
      D.TIERS.forEach((tt, ti) => tt.inc.forEach((x) => {
        const on = ti <= cur;
        const r = document.createElement('span');
        r.className = 'fork__row' + (on ? ' is-on' : '');
        r.innerHTML = '<i aria-hidden="true">' + (on ? '✓' : '') + '</i><span></span>';
        r.lastChild.textContent = x; rows.appendChild(r);
      }));
      $$('.tier', tiersBox).forEach((c, j) => {
        c.classList.toggle('is-reco', j === cur);
        c.querySelector('.tier__flag').hidden = j !== cur;
      });
      well.setLevel(cur);
      if (fromClick) score.add(50);
    }

    input.addEventListener('input', () => set(parseInt(input.value, 10), false));
    input.addEventListener('change', () => score.add(50));

    /* ── the playable well ─────────────────────────────────────────── */
    const well = (function () {
      const cv = $('#tetCanvas'); if (!cv) return { setLevel() {} };
      const ctx = cv.getContext('2d');
      const COLS = 10, ROWS = 16;
      const SHAPES = [
        [[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]],
        [[0, 1, 1], [1, 1, 0]], [[1, 1, 0], [0, 1, 1]],
        [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]]
      ];
      const COL = ['#31e0c8', '#f7c948', '#b45cff', '#3fae4a', '#ff4d2e', '#3d7bff', '#ff9e2c'];
      let box = fitCanvas(cv);
      onResize(() => { box = fitCanvas(cv); });

      const grid = [];
      for (let r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(0));
      let piece = null, fall = 0, want = 4, lines = 0, played = false;
      const hint = $('#tetHint');

      function spawn() {
        const i = Math.floor(Math.random() * SHAPES.length);
        piece = { s: SHAPES[i], c: COL[i], x: (COLS >> 1) - 1, y: -1 };
        if (hits(piece.s, piece.x, 0)) reset();
      }
      function hits(s, x, y) {
        for (let r = 0; r < s.length; r++) for (let c = 0; c < s[r].length; c++) {
          if (!s[r][c]) continue;
          const gx = x + c, gy = y + r;
          if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
          if (gy >= 0 && grid[gy][gx]) return true;
        }
        return false;
      }
      function lock() {
        const s = piece.s;
        for (let r = 0; r < s.length; r++) for (let c = 0; c < s[r].length; c++) {
          if (s[r][c] && piece.y + r >= 0) grid[piece.y + r][piece.x + c] = piece.c;
        }
        /* full rows clear and push the tier up — playing sets the budget */
        let cleared = 0;
        for (let r = ROWS - 1; r >= 0; r--) {
          if (grid[r].every(Boolean)) {
            grid.splice(r, 1); grid.unshift(new Array(COLS).fill(0));
            cleared++; r++;
          }
        }
        if (cleared) {
          lines += cleared;
          score.add(cleared * 250);
          const lvl = clamp(Math.floor(lines / 2), 0, 3);
          if (lvl !== cur) set(lvl, false);
          toast(cleared > 1 ? 'Double! Уровень поднялся' : 'Линия собрана — уровень выше');
        }
        spawn();
      }
      function reset() {
        for (let r = 0; r < ROWS; r++) grid[r].fill(0);
        lines = 0; seedTo(want);
      }
      /* the stack the chosen tier implies, filled instantly */
      function seedTo(n) {
        for (let r = 0; r < ROWS; r++) grid[r].fill(0);
        for (let i = 0; i < n; i++) {
          const r = ROWS - 1 - i, gap = (i * 3 + 2) % COLS;
          for (let c = 0; c < COLS; c++) {
            if (c === gap) continue;
            /* real tetromino colours, so a seeded stack looks played, not filler */
            grid[r][c] = COL[(i * 3 + Math.floor(c / 3)) % COL.length];
          }
        }
      }
      function setLevel(l) { want = [4, 7, 11, 14][clamp(l, 0, 3)]; seedTo(want); }

      function move(dx) { if (piece && !hits(piece.s, piece.x + dx, piece.y)) { piece.x += dx; touched(); } }
      function rotate() {
        if (!piece) return;
        const s = piece.s, n = s.length, m = s[0].length;
        const out = [];
        for (let c = 0; c < m; c++) { out.push([]); for (let r = n - 1; r >= 0; r--) out[c].push(s[r][c]); }
        if (!hits(out, piece.x, piece.y)) { piece.s = out; touched(); }
      }
      function drop() {
        if (!piece) return;
        while (!hits(piece.s, piece.x, piece.y + 1)) piece.y++;
        lock(); touched();
      }
      function touched() {
        if (played) return;
        played = true; hint && hint.classList.add('is-off'); score.add(60);
      }

      cv.addEventListener('keydown', (e) => {
        const K = { ArrowLeft: () => move(-1), ArrowRight: () => move(1), ArrowUp: rotate,
                    ArrowDown: () => { if (piece && !hits(piece.s, piece.x, piece.y + 1)) piece.y++; touched(); },
                    Space: drop };
        const f = K[e.code === 'Space' ? 'Space' : e.key];
        if (f) { e.preventDefault(); f(); }
      });
      $$('[data-tet]').forEach((b) => b.addEventListener('click', () => {
        ({ left: () => move(-1), right: () => move(1), rot: rotate, drop: drop })[b.dataset.tet]();
      }));
      /* swipe on touch */
      let sx = 0, sy = 0;
      cv.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; cv.focus(); });
      cv.addEventListener('pointerup', (e) => {
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) < 14 && Math.abs(dy) < 14) rotate();
        else if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
        else if (dy > 0) drop();
      });

      seedTo(want); spawn();
      loop.add((dt) => {
        const r = cv.getBoundingClientRect();
        if (r.bottom < -60 || r.top > vp.h + 60) return;
        fall += dt;
        if (fall > 620) {
          fall = 0;
          if (piece) { if (hits(piece.s, piece.x, piece.y + 1)) lock(); else piece.y++; }
        }
        const cw = box.w / COLS, ch = box.h / ROWS;
        ctx.setTransform(box.s, 0, 0, box.s, 0, 0);
        ctx.clearRect(0, 0, box.w, box.h);
        for (let r2 = 0; r2 < ROWS; r2++) for (let c = 0; c < COLS; c++) {
          if (!grid[r2][c]) continue;
          cell(c * cw, r2 * ch, cw, ch, grid[r2][c]);
        }
        if (piece) {
          const s = piece.s;
          for (let r2 = 0; r2 < s.length; r2++) for (let c = 0; c < s[r2].length; c++) {
            if (s[r2][c] && piece.y + r2 >= 0) cell((piece.x + c) * cw, (piece.y + r2) * ch, cw, ch, piece.c);
          }
        }
        function cell(x, y, w, h, col) {
          ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
          ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + 1, y + 1, w - 2, 3);
          ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x + 1, y + h - 5, w - 2, 4);
        }
      });
      return { setLevel };
    })();

    set(0, false);
    return { set };
  })();

  /* ═══ WORLD 5 — SHREK'S SWAMP (the onion) ═════════════════════════
     "Ogres are like onions." Each peel flies a layer off the SVG and opens
     the matching stage of the process — and yes, it makes you tear up. */
  (function onion() {
    const svg = $('.onion__svg'), out = $('#onionOut');
    const peel = $('#onionPeel'), rst = $('#onionReset'), hint = $('#onionHint'), tear = $('#onionTear');
    if (!svg || !out) return;
    const layers = $$('.onion__layer', svg);
    let open = 0;

    D.LAYERS.forEach((L, i) => {
      const el = document.createElement('article');
      el.className = 'layer';
      el.innerHTML =
        '<span class="layer__n" aria-hidden="true">' + (i + 1) + '</span>' +
        '<span class="layer__when"></span><h3 class="layer__t"></h3><p class="layer__d"></p>' +
        '<span class="layer__cap"></span><span class="layer__t" style="font-size:16px"></span>' +
        '<ul class="layer__list"></ul>';
      el.querySelector('.layer__when').textContent = L.when;
      el.querySelectorAll('.layer__t')[0].textContent = L.t;
      el.querySelector('.layer__d').textContent = L.d;
      el.querySelector('.layer__cap').textContent = L.cap;
      el.querySelectorAll('.layer__t')[1].textContent = L.ot;
      const ul = el.querySelector('.layer__list');
      L.items.forEach((x) => {
        const li = document.createElement('li');
        li.innerHTML = '<i aria-hidden="true">✦</i><span></span>';
        li.lastChild.textContent = x; ul.appendChild(li);
      });
      out.appendChild(el);
    });
    const cards = $$('.layer', out);

    function render() {
      cards.forEach((c, i) => c.classList.toggle('is-open', i < open));
      layers.forEach((l, i) => l.classList.toggle('is-peeled', i < open));
      svg.style.setProperty('--sprout', (open * 36) + 'px');
      hint.textContent = open >= 3 ? 'сердцевина — всё снято' : 'слой ' + (open + 1) + ' из 3';
      peel.querySelector('span').textContent = open >= 3 ? 'Слоёв больше нет' : 'Снять слой';
      peel.disabled = open >= 3;
      peel.style.opacity = open >= 3 ? '.5' : '';
    }
    /* the layers fly off in different directions so it reads as peeling */
    layers.forEach((l, i) => {
      l.style.setProperty('--px', (i % 2 ? -1 : 1) * (96 + i * 26) + 'px');
      l.style.setProperty('--py', (-70 - i * 24) + 'px');
      l.style.setProperty('--pr', (i % 2 ? -1 : 1) * (34 + i * 12) + 'deg');
    });

    peel.addEventListener('click', () => {
      if (open >= 3) return;
      open++; render(); score.add(150);
      tear.classList.remove('is-on'); void tear.offsetWidth; tear.classList.add('is-on');
      if (open === 3) toast('Сердцевина: команда, которая справляется без вас 🧅');
      cards[open - 1].scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'nearest' });
    });
    rst.addEventListener('click', () => { open = 0; render(); });
    render();
  })();

  /* ═══ WORLD 6 — GAME BOY ══════════════════════════════════════════
     A real DMG: the cartridge boots, the d-pad flips projects, A opens the
     owner's review and B closes it. The screen art is drawn in the four
     canonical LCD greens. */
  (function gameboy() {
    const screen = $('#gbScreen'), carts = $('#carts'), rev = $('#rev'), led = $('#gbLed');
    if (!screen) return;
    const GREEN = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];
    let cur = 0, revOpen = false, timer = 0, shownAt = performance.now();

    const boot = document.createElement('div');
    boot.className = 'gb__boot'; boot.textContent = 'BAZA';
    screen.appendChild(boot);

    D.CASES.forEach((c, i) => {
      const s = document.createElement('div');
      s.className = 'gb__slide';
      s.innerHTML =
        '<div class="gb__slide-top"><span class="gb__tag"></span><span class="gb__lives">♥×' + (5 - i) + '</span></div>' +
        '<div class="gb__art"><canvas></canvas></div>' +
        '<div class="gb__t"></div>' +
        '<div class="gb__wn"><span><i>было:</i> <b></b></span><span><i>стало:</i> <b></b></span></div>';
      s.querySelector('.gb__tag').textContent = c.svc;
      s.querySelector('.gb__t').textContent = c.title;
      const wn = s.querySelectorAll('.gb__wn b');
      wn[0].textContent = c.was; wn[1].textContent = c.now;
      screen.appendChild(s);

      const ct = document.createElement('button');
      ct.type = 'button'; ct.className = 'cart'; ct.setAttribute('role', 'tab');
      ct.innerHTML = '<span class="cart__chip" aria-hidden="true"></span><span class="cart__txt"><b></b><span></span></span>';
      ct.querySelector('.cart__chip').style.setProperty('--cc', c.color);
      ct.querySelector('b').textContent = c.svc;
      ct.querySelector('b + span').textContent = c.tag;
      ct.addEventListener('click', () => go(i, true));
      carts.appendChild(ct);
    });

    const slides = $$('.gb__slide', screen), cartEls = $$('.cart', carts);
    const arts = $$('.gb__art canvas', screen);

    function go(i, manual) {
      cur = (i + D.CASES.length) % D.CASES.length;
      shownAt = performance.now();
      slides.forEach((s, j) => s.classList.toggle('is-on', j === cur));
      cartEls.forEach((c, j) => {
        c.classList.toggle('is-on', j === cur);
        c.setAttribute('aria-selected', j === cur ? 'true' : 'false');
      });
      renderRev();
      if (manual) {
        score.add(75);
        boot.classList.remove('is-on'); void boot.offsetWidth; boot.classList.add('is-on');
        led && led.classList.add('is-on');
        restart();
      }
    }

    function renderRev() {
      const r = D.CASES[cur].rv;
      rev.classList.toggle('is-off', !revOpen);
      rev.innerHTML =
        '<div class="rev__top"><span class="rev__ini" aria-hidden="true"></span>' +
        '<span class="rev__who"><b></b><span></span></span><span class="rev__mk"></span></div>' +
        '<div class="rev__body"></div>' +
        '<span class="rev__hint"></span>';
      rev.querySelector('.rev__ini').textContent = r.ini;
      rev.querySelector('.rev__who b').textContent = r.name;
      rev.querySelector('.rev__who span').textContent = r.role;
      rev.querySelector('.rev__mk').textContent = r.mk;
      const body = rev.querySelector('.rev__body');
      (revOpen ? r.p : r.p.slice(0, 1)).forEach((p) => {
        const el = document.createElement('p'); el.textContent = p; body.appendChild(el);
      });
      rev.querySelector('.rev__hint').textContent = revOpen ? 'B — свернуть' : 'A — читать отзыв целиком';
    }

    $$('[data-gb]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.gb;
      if (k === 'next' || k === 'down') go(cur + 1, true);
      else if (k === 'prev' || k === 'up') go(cur - 1, true);
      else if (k === 'a') { revOpen = true; renderRev(); score.add(40); }
      else if (k === 'b') { revOpen = false; renderRev(); }
    }));

    function restart() {
      clearInterval(timer);
      if (REDUCED) return;
      timer = setInterval(() => go(cur + 1, false), 7600);
    }
    new IntersectionObserver((ens) => ens.forEach((en) => {
      if (en.isIntersecting) { restart(); led && led.classList.add('is-on'); }
      else { clearInterval(timer); led && led.classList.remove('is-on'); }
    }), { threshold: .25 }).observe(screen);

    /* ── the LCD artwork: four greens, no anti-aliasing, chunky pixels ── */
    function art(ctx, w, h, kind, p, t) {
      ctx.clearRect(0, 0, w, h);
      const P = (x, y, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, Math.ceil(ww), Math.ceil(hh)); };
      const ease = (v) => 1 - Math.pow(1 - clamp(v, 0, 1), 3);
      P(0, 0, w, h, GREEN[3]);
      const pad = 4;
      if (kind === 'chat') {
        for (let i = 0; i < 5; i++) {
          const a = ease((p - i * 0.13) / 0.4); if (a <= 0) continue;
          const mine = i % 2 === 1, bw = w * (0.34 + ((i * 17) % 20) / 100) * a;
          P(mine ? w - pad - bw : pad, pad + i * ((h - pad * 2) / 5), bw, (h - pad * 2) / 5 - 3,
            mine ? GREEN[0] : GREEN[1]);
        }
      } else if (kind === 'app') {
        const pw = h * 0.5, px2 = (w - pw) / 2;
        P(px2, pad, pw, h - pad * 2, GREEN[1]);
        for (let i = 0; i < 4; i++) {
          const a = ease((p - i * 0.15) / 0.4); if (a <= 0) continue;
          P(px2 + 4, pad + 6 + i * ((h - 16) / 4), (pw - 8) * a, (h - 18) / 4 - 3, i ? GREEN[2] : GREEN[0]);
        }
      } else if (kind === 'crm') {
        for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
          const a = ease((p - (r * 4 + c) * 0.035) / 0.35); if (a <= 0) continue;
          const cw = (w - pad * 2 - 9) / 4;
          P(pad + c * (cw + 3), pad + r * ((h - pad * 2) / 5), cw * a, (h - pad * 2) / 5 - 3,
            (r + c) % 3 ? GREEN[1] : GREEN[0]);
        }
      } else {
        /* a site: hero band, headline, three cards */
        const a0 = ease(p / 0.35);
        P(pad, pad, (w - pad * 2) * a0, h * 0.42, GREEN[1]);
        const a1 = ease((p - 0.2) / 0.35);
        P(pad + 6, pad + h * 0.14, (w * 0.4) * a1, 5, GREEN[3]);
        P(pad + 6, pad + h * 0.24, (w * 0.26) * a1, 4, GREEN[2]);
        for (let i = 0; i < 3; i++) {
          const a = ease((p - 0.35 - i * 0.1) / 0.35); if (a <= 0) continue;
          const cw = (w - pad * 2 - 8) / 3;
          P(pad + i * (cw + 4), h * 0.5, cw, (h * 0.5 - pad) * a, i === 1 ? GREEN[0] : GREEN[2]);
        }
      }
      /* the blinking cursor every DMG screen had */
      if (Math.sin(t * 4) > 0) P(w - 8, h - 7, 4, 4, GREEN[0]);
    }

    let aT = 0;
    loop.add((dt) => {
      const r = screen.getBoundingClientRect();
      if (r.bottom < -40 || r.top > vp.h + 40) return;
      aT += dt * 0.001;
      const cv = arts[cur]; if (!cv) return;
      const b = fitCanvas(cv);
      const ctx = cv.getContext('2d');
      ctx.setTransform(b.s, 0, 0, b.s, 0, 0);
      ctx.imageSmoothingEnabled = false;
      art(ctx, b.w, b.h, D.CASES[cur].mock, clamp((performance.now() - shownAt) / 1100, 0, 1), aT);
    });

    go(0, false);
  })();

  /* ═══ high-score belt ═════════════════════════════════════════════ */
  (function belt() {
    const row = $('#hiscoreRow'); if (!row) return;
    const make = () => D.METRICS.map((m) => {
      const s = document.createElement('span');
      s.className = 'hiscore__it';
      s.innerHTML = '<span></span><b class="' + (m[2] ? 'up' : 'down') + '"></b>';
      s.firstChild.textContent = m[0]; s.lastChild.textContent = m[1];
      return s;
    });
    make().forEach((s) => row.appendChild(s));
    make().forEach((s) => row.appendChild(s));
  })();

  /* ═══ WORLD 7 — THE INDIANA JONES MAP ═════════════════════════════
     A red dashed line draws itself from Moscow to whichever city you pick,
     with a little plane riding the head of the line. */
  (function jonesMap() {
    const cv = $('#mapCanvas'); if (!cv) return;
    const ctx = cv.getContext('2d');
    const cityEl = $('#mapCity'), chips = $('#mapChips');
    let box = fitCanvas(cv);

    const LON0 = -128, LON1 = 96, LAT0 = 66, LAT1 = 18;
    const project = (c) => ({
      x: ((c.lon - LON0) / (LON1 - LON0)) * box.w,
      y: ((LAT0 - c.lat) / (LAT0 - LAT1)) * box.h
    });
    /* coarse coastlines — a prop map, not a basemap */
    const LAND = [
      [[-125,49],[-124,42],[-120,34],[-117,32],[-110,30],[-104,26],[-97,26],[-93,29],[-88,30],[-84,30],[-81,25],[-80,29],[-76,35],[-70,42],[-67,45],[-71,47],[-79,44],[-84,46],[-90,47],[-95,49],[-105,49],[-115,49]],
      [[-10,43],[-9,39],[-6,36],[0,39],[4,43],[8,44],[12,45],[16,42],[19,40],[24,40],[26,41],[29,41],[28,45],[31,46],[34,45],[38,46],[40,44],[44,42],[48,45],[50,47],[46,50],[40,52],[34,55],[28,57],[24,60],[22,63],[26,65],[30,66],[21,66],[15,65],[12,62],[10,59],[8,58],[4,52],[0,51],[-4,50],[-6,48],[-2,46],[-4,44]],
      [[-17,21],[-16,26],[-10,30],[-5,34],[3,36],[10,34],[15,32],[20,31],[25,32],[30,31],[34,31],[35,28],[38,24],[43,20],[48,20],[52,25],[56,26],[58,24],[57,20],[52,18],[45,19],[40,20],[36,22],[33,25],[30,25],[25,23],[20,22],[14,20],[8,20],[0,20],[-8,20]],
      [[50,47],[56,50],[62,54],[68,55],[74,54],[80,52],[88,50],[95,50],[92,45],[86,44],[80,42],[74,40],[70,40],[66,42],[60,44],[54,45]]
    ];

    let pts = [], dest = 0, prog = 0, hover = -1;
    function seed() { box = fitCanvas(cv); pts = D.CITIES.map((c) => Object.assign(project(c), { l: c.l })); }
    seed(); onResize(seed);

    /* a chip per city, so the map is reachable without a pointer */
    D.CITIES.forEach((c, i) => {
      if (i === 0) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'map-chip'; b.textContent = c.l;
      b.addEventListener('click', () => fly(i, true));
      chips.appendChild(b);
    });
    const chipEls = $$('.map-chip', chips);

    function fly(i, manual) {
      dest = i; prog = 0;
      cityEl.textContent = i === 0 ? 'Москва — отсюда всё началось'
        : 'Москва → ' + D.CITIES[i].l + ' · ' + Math.round(dist(0, i)) + ' км';
      chipEls.forEach((c, j) => c.classList.toggle('is-on', j === i - 1));
      if (manual) score.add(60);
    }
    function dist(a, b) {
      const A = D.CITIES[a], B = D.CITIES[b], R = 6371, rad = Math.PI / 180;
      const dLat = (B.lat - A.lat) * rad, dLon = (B.lon - A.lon) * rad;
      const s = Math.sin(dLat / 2) ** 2 + Math.cos(A.lat * rad) * Math.cos(B.lat * rad) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(s));
    }

    cv.addEventListener('pointermove', (e) => {
      const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      let best = -1, bd = 30 * 30;
      pts.forEach((p, i) => {
        const d = (p.x - mx) ** 2 + (p.y - my) ** 2;
        if (d < bd) { bd = d; best = i; }
      });
      hover = best;
      cv.style.cursor = best >= 0 ? 'pointer' : 'crosshair';
    }, { passive: true });
    cv.addEventListener('pointerleave', () => { hover = -1; });
    cv.addEventListener('click', () => { if (hover > 0) fly(hover, true); });

    let cyc = 1, hold = 0;
    let T = 0;
    loop.add((dt) => {
      const r = cv.getBoundingClientRect();
      if (r.bottom < -60 || r.top > vp.h + 60) return;
      T += dt * 0.001;
      prog = Math.min(1, prog + dt * 0.00085);
      /* when nobody is steering, the map keeps travelling on its own */
      if (prog >= 1) {
        hold += dt;
        if (hold > 2600 && hover < 0) { hold = 0; cyc = (cyc % (D.CITIES.length - 1)) + 1; fly(cyc, false); }
      } else hold = 0;

      ctx.setTransform(box.s, 0, 0, box.s, 0, 0);
      ctx.clearRect(0, 0, box.w, box.h);

      /* land */
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = 'rgba(90,62,28,.55)';
      ctx.fillStyle = 'rgba(150,116,62,.2)';
      LAND.forEach((poly) => {
        ctx.beginPath();
        poly.forEach((c, i) => { const q = project({ lon: c[0], lat: c[1] }); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
        ctx.closePath(); ctx.fill(); ctx.stroke();
      });

      /* the travelling dashed line */
      const A = pts[0], B = pts[dest];
      if (B && dest !== 0) {
        const mx = (A.x + B.x) / 2, my = Math.min(A.y, B.y) - Math.abs(B.x - A.x) * 0.24;
        ctx.setLineDash([11, 9]);
        ctx.lineDashOffset = -T * 26;
        ctx.strokeStyle = '#a4210c'; ctx.lineWidth = 3.6;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        /* draw only the travelled part of the arc */
        for (let s = 0; s <= prog; s += 0.02) {
          const q = bez(A, { x: mx, y: my }, B, s);
          ctx.lineTo(q.x, q.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        const head = bez(A, { x: mx, y: my }, B, prog);
        const prev = bez(A, { x: mx, y: my }, B, Math.max(0, prog - 0.02));
        plane(ctx, head.x, head.y, Math.atan2(head.y - prev.y, head.x - prev.x));
      }

      /* cities */
      pts.forEach((p, i) => {
        const home = i === 0, on = i === dest, hot = i === hover;
        ctx.beginPath();
        ctx.arc(p.x, p.y, home ? 6 : 4.2, 0, 6.284);
        ctx.fillStyle = home ? '#a4210c' : on ? '#a4210c' : 'rgba(70,46,20,.72)';
        ctx.fill();
        if (home || on || hot) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 11 + Math.sin(T * 3) * 2.4, 0, 6.284);
          ctx.strokeStyle = 'rgba(164,33,12,.5)'; ctx.lineWidth = 1.6; ctx.stroke();
        }
        if (home || on || hot) {
          ctx.font = '700 12px "JetBrains Mono", monospace';
          const w = ctx.measureText(p.l).width;
          const lx = clamp(p.x + 10, 3, box.w - w - 8);
          ctx.fillStyle = 'rgba(246,235,208,.9)';
          ctx.fillRect(lx - 4, p.y - 20, w + 8, 18);
          ctx.fillStyle = '#5a3e1c';
          ctx.fillText(p.l, lx, p.y - 7);
        }
      });
    });

    function bez(a, c, b, t) {
      const u = 1 - t;
      return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
               y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
    }
    function plane(ctx, x, y, r) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(r);
      ctx.fillStyle = '#7a1f0c';
      ctx.beginPath();
      ctx.moveTo(13, 0); ctx.lineTo(-7, 7); ctx.lineTo(-3, 0); ctx.lineTo(-7, -7);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    fly(15, false);  /* Кремниевая долина — the long haul, so the arc reads at once */
  })();

  /* ═══ WORLD 8 — THE MATRIX (brief) ════════════════════════════════ */
  (function brief() {
    const DRAFT = 'baza-brief-v2';
    const st = Object.assign(
      { task: [], when: '', pain: [], lvl: 1, name: '', contact: '', msg: '' },
      store.get(DRAFT, {}) || {}
    );
    const qTask = $('#qTask'), qWhen = $('#qWhen'), qPain = $('#qPain');
    const lvls = $('#calcLvls'), sumEl = $('#calcSum'), termEl = $('#calcTerm'), noteEl = $('#calcNote');
    const promptEl = $('#termPrompt'), form = $('#briefForm');
    if (!form) return;

    function chip(label, on) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (on ? ' is-on' : '');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.innerHTML = '<i aria-hidden="true">✓</i><span></span>';
      b.lastChild.textContent = label;
      return b;
    }
    function multi(box, list, key) {
      box.innerHTML = '';
      list.forEach((label) => {
        const b = chip(label, st[key].indexOf(label) >= 0);
        b.addEventListener('click', () => {
          const i = st[key].indexOf(label);
          if (i >= 0) st[key].splice(i, 1); else { st[key].push(label); score.add(60); }
          b.classList.toggle('is-on', i < 0);
          b.setAttribute('aria-pressed', i < 0 ? 'true' : 'false');
          say(key, label, i < 0); calc(); save();
        });
        box.appendChild(b);
      });
    }
    function single(box, list, key) {
      box.innerHTML = '';
      list.forEach((label) => {
        const b = chip(label, st[key] === label);
        b.addEventListener('click', () => {
          st[key] = st[key] === label ? '' : label;
          $$('.chip', box).forEach((c) => {
            const on = c.textContent.trim() === st[key];
            c.classList.toggle('is-on', on);
            c.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          if (st[key]) score.add(60);
          say(key, label, !!st[key]); calc(); save();
        });
        box.appendChild(b);
      });
    }

    let typing = 0;
    function say(key, label, added) {
      if (!added) return;
      const t = D.TIP[key];
      let line = key === 'task' ? (st.task.length > 1 ? D.TIP.task.__multi : (t[label] || 'Записал 📌'))
        : key === 'when' ? (t[label] || 'Сроки понятны ⏱')
        : (st.pain.length > 1 ? t.__multi : t.__any);
      write(line);
    }
    function write(text) {
      clearInterval(typing);
      if (REDUCED) { promptEl.textContent = text; return; }
      let i = 0; promptEl.textContent = '';
      typing = setInterval(() => {
        i++;
        promptEl.innerHTML = text.slice(0, i) + '<span class="hero__caret"></span>';
        if (i >= text.length) clearInterval(typing);
      }, 16);
    }

    D.LVL.forEach((l, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'calc__lvl' + (i === st.lvl ? ' is-on' : '');
      b.innerHTML = '<b></b><span></span>';
      b.querySelector('b').textContent = l.name;
      b.querySelector('b + span').textContent = l.short;
      b.addEventListener('click', () => {
        st.lvl = i;
        $$('.calc__lvl', lvls).forEach((c, j) => c.classList.toggle('is-on', j === i));
        pricing.set(i === 0 ? 1 : i === 1 ? 2 : 3);
        calc(); save(); score.add(40);
      });
      lvls.appendChild(b);
    });

    const fmt = (n) => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');
    function calc() {
      const picks = st.task;
      if (!picks.length) {
        sumEl.textContent = '—'; termEl.textContent = 'выберите направление';
        noteEl.textContent = D.LVL[st.lvl].note; return;
      }
      let lo = 0, hi = 0, w0 = 0, w1 = 0;
      picks.forEach((p) => {
        const c = D.CALC[p]; if (!c) return;
        lo += c.lo; hi += c.hi; w0 = Math.max(w0, c.w[0]); w1 = Math.max(w1, c.w[1]);
      });
      const L = D.LVL[st.lvl];
      const a = lo + (hi - lo) * Math.max(0, L.at - L.span / 2);
      const b = lo + (hi - lo) * Math.min(1, L.at + L.span / 2);
      sumEl.textContent = fmt(a * 1000) + ' — ' + fmt(b * 1000) + ' ₽';
      termEl.textContent = w0 === w1 ? (w0 + ' нед.') : (w0 + '–' + w1 + ' недель');
      noteEl.textContent = L.note;
    }
    function save() {
      st.name = $('#fName').value; st.contact = $('#fContact').value; st.msg = $('#fMsg').value;
      store.set(DRAFT, st);
    }

    multi(qTask, D.TASKS, 'task');
    single(qWhen, D.WHEN, 'when');
    multi(qPain, D.PAIN, 'pain');
    $('#fName').value = st.name || ''; $('#fContact').value = st.contact || ''; $('#fMsg').value = st.msg || '';
    ['fName', 'fContact', 'fMsg'].forEach((id) => $('#' + id).addEventListener('input', save));
    calc();

    window.addEventListener('baza:sym', (e) => {
      let touched = false;
      (e.detail || []).forEach((k) => {
        const m = D.SYM[k]; if (!m) return;
        if (st.task.indexOf(m.task) < 0) { st.task.push(m.task); touched = true; }
        if (st.pain.indexOf(m.pain) < 0) { st.pain.push(m.pain); touched = true; }
      });
      if (!touched) return;
      multi(qTask, D.TASKS, 'task'); multi(qPain, D.PAIN, 'pain');
      calc(); save();
    });

    /* the two pills: one opens the calculator, one skips straight to chat */
    $('#pillRed').addEventListener('click', () => {
      form.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
      write('Ты выбрал красную. Показываю, сколько это стоит на самом деле.');
      $('#fName').focus({ preventScroll: true });
      score.add(120);
    });
    $('#pillBlue').addEventListener('click', () => {
      write('Синяя таблетка. История заканчивается в Telegram — тоже рабочий вариант.');
      window.open('https://t.me/lllbaza', '_blank', 'noopener');
      score.add(60);
    });

    function err(id, msg) { $('#' + id).textContent = msg || ''; return !msg; }
    form.addEventListener('submit', (e) => {
      e.preventDefault(); save();
      const okName = err('eName', st.name.trim().length < 2 ? 'Как к вам обращаться?' : '');
      const okCont = err('eContact', st.contact.trim().length < 4 ? 'Оставьте телеграм, телефон или почту' : '');
      const okAgr  = err('eAgree', $('#fAgree').checked ? '' : 'Без согласия мы не сможем ответить');
      if (!okName || !okCont || !okAgr) {
        (!okName ? $('#fName') : !okCont ? $('#fContact') : $('#fAgree')).focus();
        return;
      }
      const lines = [
        'Заявка с сайта БАЗА', 'Имя: ' + st.name, 'Контакт: ' + st.contact,
        st.task.length ? 'Задача: ' + st.task.join(', ') : '',
        st.when ? 'Сроки: ' + st.when : '',
        st.pain.length ? 'Боль: ' + st.pain.join(', ') : '',
        'Уровень: ' + D.LVL[st.lvl].name,
        sumEl.textContent !== '—' ? 'Вилка: ' + sumEl.textContent + ' · ' + termEl.textContent : '',
        st.msg ? 'Комментарий: ' + st.msg : ''
      ].filter(Boolean);

      /* no endpoint lives in a public repo: queue locally, hand to Telegram */
      const q = store.get('baza-leads', []) || [];
      q.push({ ts: Date.now(), text: lines.join('\n') });
      store.set('baza-leads', q.slice(-20));

      $('#tgDup').href = 'https://t.me/lllbaza?text=' + encodeURIComponent(lines.join('\n'));
      $('#briefDone').classList.add('is-on');
      $('#briefDone').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
      write('Заявка записана. Ответим в течение рабочего дня 🤝');
      score.add(1000);
      toast('Заявка у нас — ответим в течение рабочего дня');
      store.del(DRAFT);
    });
  })();

  /* ═══ WORLD 9 — STAR WARS CRAWL ═══════════════════════════════════ */
  (function crawl() {
    const foot = $('.credits'), inner = $('#crawlInner');
    if (!foot || !inner) return;
    const stage = $('.crawl');
    loop.add(() => {
      const r = stage.getBoundingClientRect();
      if (r.bottom < -80 || r.top > vp.h + 80) return;
      /* p runs 0→1 while the crawl window crosses the viewport; the text
         travels its own height plus the window, so it enters from the
         bottom edge and disappears into the vanishing point exactly once */
      const p = clamp((vp.h - r.top) / (vp.h + r.height), 0, 1);
      const travel = inner.offsetHeight + r.height;
      inner.style.setProperty('--crawl', (-p * travel).toFixed(0) + 'px');
    });
  })();

  /* ═══ legal · cookie · konami ═════════════════════════════════════ */
  (function legal() {
    const m = $('#modal'), t = $('#modalT'), b = $('#modalB');
    let lastFocus = null;
    function open(key) {
      const doc = D.LEGAL[key]; if (!doc) return;
      lastFocus = document.activeElement;
      t.textContent = doc.t; b.innerHTML = '';
      doc.b.forEach((p) => { const el = document.createElement('p'); el.textContent = p; b.appendChild(el); });
      m.hidden = false;
      requestAnimationFrame(() => m.classList.add('is-on'));
      document.body.classList.add('is-locked');
      $('#modalX').focus();
    }
    function close() {
      m.classList.remove('is-on');
      document.body.classList.remove('is-locked');
      setTimeout(() => { m.hidden = true; }, 340);
      lastFocus && lastFocus.focus();
    }
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-legal]');
      if (a) { e.preventDefault(); open(a.dataset.legal); return; }
      if (e.target === m) close();
    });
    $('#modalX').addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !m.hidden) close(); });
  })();

  (function cookie() {
    const el = $('#cookie'), KEY = 'baza-cookie-v1';
    const hide = () => el.classList.remove('is-on');
    if (!store.get(KEY, null)) setTimeout(() => el.classList.add('is-on'), 3200);
    $('#cookieYes').addEventListener('click', () => { store.set(KEY, 'all'); hide(); toast('Спасибо 🍪'); });
    $('#cookieNo').addEventListener('click', () => { store.set(KEY, 'min'); hide(); });
    $('#cookieOpen').addEventListener('click', (e) => { e.preventDefault(); el.classList.add('is-on'); });
  })();

  (function konami() {
    const SEQ = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let i = 0;
    document.addEventListener('keydown', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      i = (k === SEQ[i]) ? i + 1 : (k === SEQ[0] ? 1 : 0);
      if (i === SEQ.length) {
        i = 0;
        document.documentElement.animate(
          [{ filter: 'hue-rotate(0deg)' }, { filter: 'hue-rotate(360deg)' }], { duration: 2400 });
        score.add(9999);
        toast('30 жизней выдано. Пользуйтесь аккуратно 🎮');
      }
    });
  })();

  /* ═══ go ══════════════════════════════════════════════════════════ */
  document.body.classList.add('is-locked');
  watch(document);
  setTimeout(() => { watch(document); sky.remeasure(); }, 500);
})();
