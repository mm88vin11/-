/* ═══════════════════════════════════════════════════════════════════════
   app.js — БАЗА · Arcade Edition
   One rAF loop drives every scene; everything else is event-driven.
   Nothing here reads layout inside the loop — measurements are cached and
   refreshed on resize, which is what keeps the scroll smooth.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const D = window.BAZA;
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

  /* ═══ shared frame loop ═══════════════════════════════════════════ */
  const loop = (function () {
    const jobs = [];
    let last = performance.now(), running = false;
    function tick(now) {
      const dt = Math.min(64, now - last); last = now;
      for (let i = 0; i < jobs.length; i++) jobs[i](dt, now);
      requestAnimationFrame(tick);
    }
    return {
      add(fn) { jobs.push(fn); if (!running) { running = true; requestAnimationFrame(tick); } }
    };
  })();

  /* Viewport metrics, measured once per resize instead of per frame. */
  const vp = { w: 0, h: 0, dpr: 1 };
  function measure() {
    vp.w = window.innerWidth;
    vp.h = window.innerHeight;
    vp.dpr = Math.min(2, window.devicePixelRatio || 1);
  }
  measure();

  const onResize = (function () {
    const subs = [];
    let t = 0;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => { measure(); subs.forEach((f) => f()); }, 140);
    }, { passive: true });
    return (fn) => { subs.push(fn); };
  })();

  /* Canvas sized to its own box in device pixels — no blurry scenes. */
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
    const steps = ['загружаем картридж…', 'собираем мир 1…', 'кормим призраков…', 'полируем тени…', 'готово'];
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
          $('#hero') && $('#hero').classList.add('is-live');
          startHeroType();
        }, 260);
      }
    }, REDUCED ? 40 : 190);
  })();

  /* ═══ cursor ══════════════════════════════════════════════════════ */
  if (FINE && !REDUCED) {
    const cur = $('#cursor');
    let cx = -100, cy = -100, tx = -100, ty = -100;
    window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    document.addEventListener('pointerover', (e) => {
      const hot = e.target.closest('a, button, input, [role="tablist"] *, .qblock, .ghost, .cart');
      cur.classList.toggle('is-hot', !!hot);
    });
    loop.add(() => {
      cx = lerp(cx, tx, 0.22); cy = lerp(cy, ty, 0.22);
      cur.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
    });
  }

  /* ═══ toast ═══════════════════════════════════════════════════════ */
  let toastT = 0;
  function toast(msg) {
    const el = $('#toast'); if (!el) return;
    el.textContent = msg; el.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('is-on'), 2600);
  }

  /* ═══ score ═══════════════════════════════════════════════════════ */
  const score = (function () {
    const box = $('#hudScore'), n = $('#scoreN');
    let val = 0, shown = 0;
    function add(v) {
      val += v;
      box && box.classList.add('is-on');
    }
    loop.add(() => {
      if (Math.abs(val - shown) < 0.6) { shown = val; } else { shown = lerp(shown, val, 0.14); }
      if (n) n.textContent = String(Math.round(shown)).padStart(4, '0');
    });
    return { add, get: () => val };
  })();

  /* ═══ reveal engine ═══════════════════════════════════════════════ */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      io.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

  function watch(root) {
    $$('[data-rise], [data-split], .stop, .seam-clear', root).forEach((el) => io.observe(el));
  }

  /* Split a heading into per-character spans so it can type itself in.
     Characters are grouped inside per-word wrappers — otherwise every glyph
     becomes its own inline-block and the browser breaks lines mid-word. */
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
            const w = document.createElement('span');
            w.className = 'word';
            tok.split('').forEach((c) => {
              const s = document.createElement('span');
              s.className = 'ch';
              s.textContent = c;
              w.appendChild(s);
            });
            frag.appendChild(w);
          });
          node.replaceChild(frag, ch);
        } else if (ch.nodeType === 1 && !ch.classList.contains('word')) { walk(ch); }
      });
    };
    walk(el);
    $$('.ch', el).forEach((s, i) => s.style.setProperty('--i', i));
  }
  $$('[data-split]').forEach(split);

  /* ═══ header + nav ════════════════════════════════════════════════ */
  (function header() {
    const head = $('#head'), ink = $('#navInk');
    const items = $$('.nav__item');
    const secs = items.map((a) => $(a.getAttribute('href'))).filter(Boolean);
    let lastY = window.scrollY, active = null;

    function moveInk(el) {
      if (!el || !ink) return;
      const p = el.parentElement.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      ink.style.width = r.width + 'px';
      ink.style.transform = 'translate3d(' + (r.left - p.left - 5) + 'px,0,0)';
      ink.classList.add('is-on');
    }

    function spy() {
      const y = window.scrollY + vp.h * 0.34;
      let found = null;
      secs.forEach((s, i) => { if (s.offsetTop <= y) found = items[i]; });
      if (found !== active) {
        items.forEach((a) => a.classList.remove('is-active'));
        active = found;
        if (active) { active.classList.add('is-active'); moveInk(active); }
        else if (ink) ink.classList.remove('is-on');
      }
    }

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        head.classList.toggle('is-stuck', y > 24);
        head.classList.toggle('is-hidden', y > 420 && y > lastY + 6 && !$('#menu').classList.contains('is-on'));
        lastY = y;
        spy();
        const h = document.documentElement.scrollHeight - vp.h;
        $('#hudFill').style.width = (h > 0 ? clamp(y / h, 0, 1) * 100 : 0) + '%';
        ticking = false;
      });
    }, { passive: true });

    onResize(() => { if (active) moveInk(active); });
    setTimeout(spy, 200);
  })();

  /* ═══ mobile menu ═════════════════════════════════════════════════ */
  (function menu() {
    const b = $('#burger'), m = $('#menu');
    function set(on) {
      b.classList.toggle('is-on', on);
      m.classList.toggle('is-on', on);
      b.setAttribute('aria-expanded', on ? 'true' : 'false');
      document.body.classList.toggle('is-locked', on);
    }
    b.addEventListener('click', () => set(!m.classList.contains('is-on')));
    $$('.menu__link, .menu__foot a', m).forEach((a) => a.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  })();

  /* ═══ warp transition on in-page jumps ════════════════════════════ */
  const warp = (function () {
    const el = $('#warp'), lbl = $('#warpLabel');
    const COLS = 14, ROWS = 9;
    el.style.setProperty('--cols', COLS);
    el.style.setProperty('--rows', ROWS);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = document.createElement('i');
        /* a diagonal ripple reads as one motion instead of 126 separate ones */
        i.style.transitionDelay = ((c + r) * 16) + 'ms';
        el.appendChild(i);
      }
    }
    let busy = false;
    function go(target, label) {
      const dest = $(target);
      if (!dest) return;
      if (REDUCED || busy) { dest.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' }); return; }
      busy = true;
      el.classList.add('is-busy', 'is-in'); el.classList.remove('is-out');
      if (label) { lbl.textContent = label; lbl.classList.add('is-on'); }
      setTimeout(() => {
        const top = dest.getBoundingClientRect().top + window.scrollY - 88;
        window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
        setTimeout(() => {
          el.classList.remove('is-in'); el.classList.add('is-out');
          lbl.classList.remove('is-on');
          setTimeout(() => { el.classList.remove('is-busy'); busy = false; }, 520);
        }, 220);
      }, 460);
    }
    return { go };
  })();

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href === '#') { if (a.dataset.legal) e.preventDefault(); return; }
    const dest = $(href);
    if (!dest) return;
    e.preventDefault();
    if (a.dataset.warp) warp.go(href, a.dataset.warp);
    else dest.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', href);
  });

  /* ═══ counters ════════════════════════════════════════════════════ */
  (function counters() {
    const els = $$('[data-count]');
    const cio = new IntersectionObserver((ens) => {
      ens.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        cio.unobserve(el);
        const to = parseFloat(el.dataset.count) || 0;
        const pre = el.dataset.pre || '', post = el.dataset.post || '';
        /* markup already carries the final value, so reduced motion is a no-op */
        if (REDUCED) { el.textContent = pre + to + post; return; }
        const t0 = performance.now(), dur = 1200;
        (function step(now) {
          const p = clamp((now - t0) / dur, 0, 1);
          const e = 1 - Math.pow(1 - p, 3);
          el.textContent = pre + Math.round(to * e) + post;
          if (p < 1) requestAnimationFrame(step);
        })(performance.now());
      });
    }, { threshold: 0.4 });
    els.forEach((el) => cio.observe(el));
  })();

  /* ═══ WORLD 0 — hero ══════════════════════════════════════════════ */
  function startHeroType() {
    const el = $('#heroType');
    if (!el) return;
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
        ci++;
        setTimeout(type, 15 + Math.random() * 26);
      } else {
        out += (li === 0 ? '' : '') + line + '<br>';
        li++; ci = 0;
        setTimeout(type, 380);
      }
    })();
  }

  (function heroScene() {
    const cv = $('#heroStars'); if (!cv) return;
    const ctx = cv.getContext('2d');
    let box = fitCanvas(cv), stars = [];

    function seed() {
      box = fitCanvas(cv);
      const n = clamp(Math.round((box.w * box.h) / 3400), 60, 460);
      stars = [];
      for (let i = 0; i < n; i++) {
        stars.push({
          /* stars thin out towards the horizon so the floor stays readable */
          x: Math.random() * box.w,
          y: Math.pow(Math.random(), 1.5) * box.h * 0.82,
          z: 0.3 + Math.random() * 0.7,
          r: 0.6 + Math.random() * 1.6,
          tw: Math.random() * Math.PI * 2
        });
      }
    }
    seed(); onResize(seed);

    let mx = 0, my = 0, px = 0, py = 0, t = 0;
    if (FINE) {
      window.addEventListener('pointermove', (e) => {
        mx = (e.clientX / vp.w - 0.5) * 2; my = (e.clientY / vp.h - 0.5) * 2;
      }, { passive: true });
    }

    const grid = $('#heroGrid');
    loop.add((dt) => {
      const r = cv.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vp.h + 200) return;   /* offscreen: skip */
      t += dt * 0.001;
      px = lerp(px, mx, 0.06); py = lerp(py, my, 0.06);

      ctx.setTransform(box.s, 0, 0, box.s, 0, 0);
      ctx.clearRect(0, 0, box.w, box.h);
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const x = s.x - px * 26 * s.z;
        const y = s.y - py * 20 * s.z;
        const a = 0.3 + 0.62 * (0.5 + 0.5 * Math.sin(t * 1.7 + s.tw)) * s.z;
        ctx.beginPath();
        ctx.arc(x, y, s.r * s.z, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(242,235,221,' + a.toFixed(3) + ')';
        ctx.fill();
      }
      if (grid) grid.style.setProperty('--gy', (py * 14).toFixed(1) + 'px');
    });
  })();

  /* ═══ WORLD 1 — Pac-Man ═══════════════════════════════════════════ */
  (function pacScene() {
    const cv = $('#pacMaze'); if (!cv) return;
    const ctx = cv.getContext('2d');
    let box, cells = [];
    const CELL = 46;

    function seed() {
      box = fitCanvas(cv);
      const cols = Math.ceil(box.w / CELL) + 1;
      const rows = Math.ceil(box.h / CELL) + 1;
      cells = [];
      /* A maze read as a grid of quarter-arcs and bars — the classic look
         without shipping a hand-drawn level. */
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const seedv = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453;
          const f = seedv - Math.floor(seedv);
          cells.push({ x: c * CELL, y: r * CELL, k: f < 0.22 ? 1 : f < 0.44 ? 2 : f < 0.56 ? 3 : 0, f });
        }
      }
    }
    seed(); onResize(seed);

    let prog = 0;
    loop.add((dt) => {
      const r = cv.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vp.h + 100) return;
      /* the maze paints itself in proportion to how far the section is in view */
      const seen = clamp((vp.h - r.top) / (vp.h + r.height), 0, 1);
      prog = lerp(prog, seen, 0.08);

      ctx.setTransform(box.s, 0, 0, box.s, 0, 0);
      ctx.clearRect(0, 0, box.w, box.h);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';

      const shown = Math.floor(cells.length * clamp(prog * 1.35, 0, 1));
      for (let i = 0; i < shown; i++) {
        const c = cells[i];
        if (!c.k) continue;
        ctx.strokeStyle = 'rgba(43,59,255,' + (0.16 + c.f * 0.18).toFixed(2) + ')';
        ctx.beginPath();
        if (c.k === 1) { ctx.moveTo(c.x + 8, c.y + CELL / 2); ctx.lineTo(c.x + CELL - 8, c.y + CELL / 2); }
        else if (c.k === 2) { ctx.moveTo(c.x + CELL / 2, c.y + 8); ctx.lineTo(c.x + CELL / 2, c.y + CELL - 8); }
        else { ctx.arc(c.x + CELL / 2, c.y + CELL / 2, CELL / 2 - 8, 0, Math.PI * 0.5); }
        ctx.stroke();
        if (c.f > 0.9) {
          ctx.beginPath();
          ctx.arc(c.x + CELL / 2, c.y + CELL / 2, 2.4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,212,38,.38)'; ctx.fill();
        }
      }
    });

    /* Pac-Man runs the width of the section as you scroll through it. */
    const runner = $('#pacRunner'), sec = $('#about');
    if (runner && sec) {
      loop.add(() => {
        const r = sec.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vp.h) return;
        const p = clamp((vp.h * 0.9 - r.top) / (r.height + vp.h * 0.5), 0, 1);
        runner.style.setProperty('--px', (p * (r.width + 60) - 50).toFixed(1) + 'px');
      });
    }
  })();

  /* symptoms → verdict */
  (function symptoms() {
    const picked = new Set();
    const nEl = $('#pacN'), vEl = $('#pacVerdict'), cEl = $('#pacCosts');
    const pellets = $$('#pacPellets i');

    function render() {
      const n = picked.size;
      nEl.textContent = n;
      vEl.textContent = D.VERDICT[n];
      pellets.forEach((p, i) => p.classList.toggle('is-gone', i < n));
      cEl.innerHTML = '';
      let i = 0;
      picked.forEach((k) => {
        const row = document.createElement('div');
        row.className = 'pac-cost';
        row.style.animationDelay = (i * 70) + 'ms';
        row.innerHTML = '<i aria-hidden="true"></i><span></span>';
        row.lastChild.textContent = D.SYM[k].cost;
        cEl.appendChild(row);
        i++;
      });
      $('#pacCta').querySelector('span').textContent =
        n === 0 ? 'Посмотреть, как это чинится' : n < 3 ? 'Показать, как это чинится' : 'Показать, во что это обойдётся исправить';
      store.set('baza-sym', Array.from(picked));
      window.dispatchEvent(new CustomEvent('baza:sym', { detail: Array.from(picked) }));
    }

    $$('.ghost').forEach((b) => {
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        const k = b.dataset.sym;
        const on = !picked.has(k);
        if (on) { picked.add(k); score.add(200); } else { picked.delete(k); }
        b.classList.toggle('is-eaten', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        render();
      });
    });

    /* restore a previous visit's answers */
    (store.get('baza-sym', []) || []).forEach((k) => {
      const b = $('.ghost[data-sym="' + k + '"]');
      if (b) { picked.add(k); b.classList.add('is-eaten'); b.setAttribute('aria-pressed', 'true'); }
    });
    render();
  })();

  /* ═══ WORLD 2 — VS select ═════════════════════════════════════════ */
  (function versus() {
    const pick = $('#vsPick'), stat = $('#vsStat'), pros = $('#vsPros'), cons = $('#vsCons');
    if (!pick) return;
    let cur = 3;

    D.HIRE.forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'vs-card';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', i === cur ? 'true' : 'false');
      b.innerHTML = '<span class="vs-card__num" aria-hidden="true">' + (i + 1) + '</span><b></b><span></span>';
      b.querySelector('b').textContent = o.name;
      b.querySelector('b + span').textContent = o.cost;
      b.addEventListener('click', () => select(i));
      pick.appendChild(b);
    });

    function list(box, arr, kind) {
      box.innerHTML = '';
      arr.forEach((x, i) => {
        const el = document.createElement('span');
        el.className = 'vs-li vs-li--' + kind;
        el.style.animationDelay = (i * 60) + 'ms';
        el.innerHTML = '<i aria-hidden="true">' + (kind === 'pro' ? '✓' : '✕') + '</i><span></span>';
        el.lastChild.textContent = x;
        box.appendChild(el);
      });
    }

    function select(i) {
      cur = i;
      const o = D.HIRE[i];
      $$('.vs-card', pick).forEach((c, j) => {
        c.classList.toggle('is-on', j === i);
        c.setAttribute('aria-selected', j === i ? 'true' : 'false');
      });
      stat.innerHTML = '<span class="vs-stat__cost"></span><span class="vs-stat__unit"></span><p class="vs-stat__line"></p>';
      stat.querySelector('.vs-stat__cost').textContent = o.cost;
      stat.querySelector('.vs-stat__unit').textContent = o.unit;
      stat.querySelector('.vs-stat__line').textContent = o.line;
      list(pros, o.pros, 'pro');
      list(cons, o.cons, 'con');
    }
    select(cur);
  })();

  /* ═══ pipe seam ═══════════════════════════════════════════════════ */
  (function pipe() {
    const seam = $('#seamPipe'), hero = $('#pipeHero');
    if (!seam || !hero) return;
    loop.add(() => {
      const r = seam.getBoundingClientRect();
      if (r.bottom < -80 || r.top > vp.h + 80) return;
      /* the little guy drops into the pipe exactly as the seam crosses centre */
      const p = clamp((vp.h * 0.72 - r.top) / (r.height + vp.h * 0.4), 0, 1);
      hero.style.setProperty('--hero-y', (-140 + p * 260) + '%');
    });
  })();

  /* ═══ WORLD 3 — Mario ═════════════════════════════════════════════ */
  (function marioSky() {
    const cv = $('#marioSky'); if (!cv) return;
    const ctx = cv.getContext('2d');
    let box, clouds = [], hills = [];

    function seed() {
      box = fitCanvas(cv);
      clouds = [];
      for (let i = 0; i < 7; i++) {
        clouds.push({ x: Math.random() * box.w, y: 40 + Math.random() * (box.h * 0.42), s: 0.5 + Math.random() * 0.8, v: 4 + Math.random() * 9 });
      }
      hills = [];
      for (let i = 0; i < 6; i++) {
        hills.push({ x: (i / 5) * box.w + (Math.random() - 0.5) * 90, r: 90 + Math.random() * 140 });
      }
    }
    seed(); onResize(seed);

    function cloud(x, y, s) {
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.beginPath();
      ctx.arc(x, y, 20 * s, 0, Math.PI * 2);
      ctx.arc(x + 22 * s, y - 8 * s, 26 * s, 0, Math.PI * 2);
      ctx.arc(x + 48 * s, y, 20 * s, 0, Math.PI * 2);
      ctx.rect(x, y, 48 * s, 22 * s);
      ctx.fill();
    }

    let t = 0, off = 0;
    loop.add((dt) => {
      const r = cv.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vp.h + 100) return;
      t += dt * 0.001;
      off = (window.scrollY - (r.top + window.scrollY)) * 0.04;

      ctx.setTransform(box.s, 0, 0, box.s, 0, 0);
      ctx.clearRect(0, 0, box.w, box.h);

      /* far hills */
      ctx.fillStyle = 'rgba(63,174,74,.34)';
      hills.forEach((h) => {
        ctx.beginPath();
        ctx.arc(h.x + off * 0.5, box.h + 40, h.r, Math.PI, 0);
        ctx.fill();
      });
      ctx.fillStyle = 'rgba(46,140,58,.38)';
      hills.forEach((h, i) => {
        if (i % 2) return;
        ctx.beginPath();
        ctx.arc(h.x - 120 + off, box.h + 70, h.r * 1.3, Math.PI, 0);
        ctx.fill();
      });

      /* clouds scale with the canvas so they don't become blobs on a phone */
      const cs = clamp(box.w / 1200, 0.5, 1.15);
      clouds.forEach((c) => {
        c.x += (c.v * dt) / 1000;
        if (c.x - 80 * cs > box.w) c.x = -90 * cs;
        cloud(c.x, c.y + Math.sin(t * 0.7 + c.x * 0.01) * 4, c.s * cs);
      });
    });
  })();

  (function marioBlocks() {
    const wrap = $('#blocks'), panel = $('#marioPanel');
    if (!wrap) return;
    let cur = 0;
    const hit = new Set();

    D.SERVICES.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'qblock';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', s.label);
      b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      b.innerHTML = '<span class="qblock__q" aria-hidden="true">?</span><span class="qblock__lbl">' + s.short + '</span>';
      b.addEventListener('click', () => bump(i, b));
      wrap.appendChild(b);
    });

    function bump(i, b) {
      b.classList.remove('is-hit');
      void b.offsetWidth;                       /* restart the keyframe */
      b.classList.add('is-hit');
      if (!hit.has(i)) { hit.add(i); score.add(100); }
      b.classList.add('is-used');
      const coin = document.createElement('span');
      coin.className = 'coin-pop';
      b.appendChild(coin);
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
        '<div class="mario-panel__txt">' +
          '<span class="mario-panel__tag"></span>' +
          '<h3></h3><p></p>' +
          '<ul class="mario-panel__list"></ul>' +
        '</div>' +
        '<div class="mario-panel__side"></div>';
      panel.querySelector('.mario-panel__tag').textContent = s.label;
      panel.querySelector('h3').textContent = s.title;
      panel.querySelector('p').textContent = s.desc;
      const ul = panel.querySelector('.mario-panel__list');
      s.inc.forEach((x) => {
        const li = document.createElement('li');
        li.innerHTML = '<i aria-hidden="true">✓</i><span></span>';
        li.lastChild.textContent = x;
        ul.appendChild(li);
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
      a.className = 'btn btn--solid';
      a.href = '#brief';
      a.dataset.warp = 'World 8 · Контакты';
      a.style.cssText = 'background:#12233d;border-color:#12233d;color:#fffaf0';
      a.innerHTML = '<span>Обсудить это направление</span>';
      side.appendChild(a);
    }
    show(0);

    /* the runner keeps pace with the scroll along the brick floor */
    const runner = $('#marioRunner'), sec = $('#services');
    if (runner && sec) {
      loop.add(() => {
        const r = sec.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vp.h) return;
        const p = clamp((vp.h * 0.9 - r.top) / (r.height + vp.h * 0.4), 0, 1);
        runner.style.setProperty('--mx', (p * (r.width - 40)).toFixed(1) + 'px');
      });
    }
  })();

  /* ═══ tetris line-clear seam ══════════════════════════════════════ */
  (function clearSeam() {
    const seam = $('#seamClear'), row = $('#seamClearRow');
    if (!seam || !row) return;
    const COLORS = ['--t-i', '--t-o', '--t-t', '--t-s', '--t-z', '--t-j', '--t-l'];
    for (let i = 0; i < 22; i++) {
      const b = document.createElement('i');
      b.style.setProperty('--i', i);
      b.style.setProperty('--c', 'var(' + COLORS[i % COLORS.length] + ')');
      row.appendChild(b);
    }
    const cio = new IntersectionObserver((ens) => {
      ens.forEach((en) => {
        if (en.isIntersecting) {
          seam.classList.add('is-in');
          /* fill the row, hold a beat, then clear it like a completed line */
          setTimeout(() => seam.classList.add('is-cleared'), 1400);
          setTimeout(() => seam.classList.remove('is-cleared'), 2300);
        }
      });
    }, { threshold: 0.5 });
    cio.observe(seam);
  })();

  /* ═══ WORLD 4 — Tetris pricing ════════════════════════════════════ */
  const pricing = (function tetris() {
    const input = $('#forkInput'), fill = $('#forkFill'), stops = $('#forkStops');
    const rows = $('#forkRows'), tiersBox = $('#tiers');
    const cap = $('#forkCap'), nm = $('#forkName'), tm = $('#forkTerm'), cut = $('#forkCut');
    const lvlEl = $('#tetLevel'), nameEl = $('#tetName');
    if (!input) return { set() {} };

    let cur = 0;

    D.FORK.forEach((f, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fork__stop';
      b.innerHTML = '<span></span><b></b>';
      b.querySelector('span').textContent = f.short;
      b.querySelector('b').textContent = f.name.replace(/^Сделать /, '').replace(/^Сначала /, '');
      b.addEventListener('click', () => set(i, true));
      stops.appendChild(b);
    });

    D.TIERS.forEach((t, i) => {
      const c = document.createElement('div');
      c.className = 'tier';
      c.innerHTML =
        '<span class="tier__flag" hidden>советуем</span>' +
        '<div class="tier__nm"></div><div class="tier__pr"></div><div class="tier__tm"></div>' +
        '<p class="tier__ds"></p><ul class="tier__inc"></ul>' +
        '<a class="btn" href="#brief" data-warp="World 8 · Контакты"><span></span></a>';
      c.querySelector('.tier__nm').textContent = t.name;
      c.querySelector('.tier__pr').textContent = t.price;
      c.querySelector('.tier__tm').textContent = t.term;
      c.querySelector('.tier__ds').textContent = t.desc;
      const ul = c.querySelector('.tier__inc');
      t.inc.forEach((x) => {
        const li = document.createElement('li');
        li.innerHTML = '<i aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></i><span></span>';
        li.lastChild.textContent = x;
        ul.appendChild(li);
      });
      c.querySelector('.btn span').textContent = t.cta;
      c.dataset.tier = t.k;
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

      /* everything up to the chosen level is included — that IS the fork */
      rows.innerHTML = '';
      D.TIERS.forEach((tt, ti) => {
        tt.inc.forEach((x) => {
          const on = ti <= cur;
          const r = document.createElement('span');
          r.className = 'fork__row' + (on ? ' is-on' : '');
          r.innerHTML = '<i aria-hidden="true">' + (on ? '✓' : '') + '</i><span></span>';
          r.lastChild.textContent = x;
          rows.appendChild(r);
        });
      });

      $$('.tier', tiersBox).forEach((c, j) => {
        c.classList.toggle('is-reco', j === cur);
        c.querySelector('.tier__flag').hidden = j !== cur;
      });

      well.target(cur);
      if (fromClick) score.add(50);
    }

    input.addEventListener('input', () => set(parseInt(input.value, 10), false));
    input.addEventListener('change', () => score.add(50));

    /* ── the well: pieces fall and stack to the chosen level ──────── */
    const well = (function () {
      const cv = $('#tetCanvas');
      if (!cv) return { target() {} };
      const ctx = cv.getContext('2d');
      const COLS = 10, ROWS = 16;
      const PALETTE = ['#31e0c8', '#f7c948', '#b45cff', '#3fae4a', '#ff4d2e', '#3d7bff', '#ff9e2c'];
      let box = fitCanvas(cv);
      onResize(() => { box = fitCanvas(cv); });

      let stack = [];                 /* settled rows, bottom-up */
      let want = 4;                   /* how many rows the level asks for */
      let piece = null;

      function newPiece() {
        const c = PALETTE[Math.floor(Math.random() * PALETTE.length)];
        const w = 1 + Math.floor(Math.random() * 3);
        piece = { x: Math.floor(Math.random() * (COLS - w)), y: -1, w, c, v: 0.011 + Math.random() * 0.007 };
      }
      /* one gap per row, walked deterministically so the stack looks played,
         not random, and stays identical across repaints */
      function settle(pc, i) {
        const gap = (pc.x + pc.w + 2 + i * 3) % COLS;
        return { w: pc.w, x: pc.x, c: pc.c, gap: gap === pc.x ? (gap + 4) % COLS : gap,
                 fill: 'rgba(255,255,255,.16)' };
      }
      function targetRows(level) { return [4, 7, 11, 15][clamp(level, 0, 3)]; }
      function target(level) { want = targetRows(level); }

      newPiece();
      loop.add((dt) => {
        const r = cv.getBoundingClientRect();
        if (r.bottom < -60 || r.top > vp.h + 60) return;

        if (stack.length > want) { stack.length = want; }

        /* Rows more than three below the target snap in — waiting 15 seconds
           to watch the well fill is not an animation, it's a delay. */
        while (stack.length < want - 3) {
          const n = stack.length;
          stack.push(settle({ w: 1 + ((n * 3) % 3), x: (n * 4) % (COLS - 3),
                              c: PALETTE[n % PALETTE.length] }, n));
        }

        if (stack.length < want) {
          if (!piece) newPiece();
          piece.y += piece.v * dt * 2.4;
          if (piece.y >= ROWS - stack.length - 1) {
            stack.push(settle(piece, stack.length));
            piece = null;
            if (stack.length < want) newPiece();
          }
        } else if (piece) { piece = null; }

        const cw = box.w / COLS, chh = box.h / ROWS;
        ctx.setTransform(box.s, 0, 0, box.s, 0, 0);
        ctx.clearRect(0, 0, box.w, box.h);

        /* Settled rows read as a real stack: filled across, with the landing
           piece still visible as its own colour and one gap left open. */
        for (let i = 0; i < stack.length; i++) {
          const row = stack[i];
          const y = box.h - (i + 1) * chh;
          for (let c = 0; c < COLS; c++) {
            if (c === row.gap) continue;
            const inPiece = c >= row.x && c < row.x + row.w;
            ctx.fillStyle = inPiece ? row.c : row.fill;
            ctx.fillRect(c * cw + 1, y + 1, cw - 2, chh - 2);
            ctx.fillStyle = 'rgba(255,255,255,.16)';
            ctx.fillRect(c * cw + 1, y + 1, cw - 2, 2.5);
            ctx.fillStyle = 'rgba(0,0,0,.26)';
            ctx.fillRect(c * cw + 1, y + chh - 5, cw - 2, 4);
          }
        }
        /* the piece in flight */
        if (piece) {
          ctx.fillStyle = piece.c;
          for (let c = 0; c < piece.w; c++) {
            ctx.fillRect((piece.x + c) * cw + 1, piece.y * chh + 1, cw - 2, chh - 2);
          }
          ctx.fillStyle = 'rgba(255,255,255,.18)';
          ctx.fillRect(piece.x * cw + 1, piece.y * chh + 1, piece.w * cw - 2, 3);
        }
      });

      return { target };
    })();

    set(0, false);
    return { set };
  })();

  /* ═══ WORLD 5 — swamp ═════════════════════════════════════════════ */
  (function swamp() {
    const cv = $('#swampScene');
    if (cv) {
      const ctx = cv.getContext('2d');
      let box, flies = [], reeds = [], vines = [];
      function seed() {
        box = fitCanvas(cv);
        /* density scales with the section's real area, so a tall section on a
           narrow phone gets the same visual richness as a wide desktop one */
        const n = clamp(Math.round((box.w * box.h) / 26000), 26, 130);
        flies = [];
        for (let i = 0; i < n; i++) {
          flies.push({ x: Math.random() * box.w, y: Math.random() * box.h, r: 1 + Math.random() * 2.2,
                       a: Math.random() * Math.PI * 2, s: 0.15 + Math.random() * 0.5, tw: Math.random() * 6 });
        }
        reeds = [];
        for (let i = 0; i < 46; i++) {
          reeds.push({ x: Math.random() * box.w, h: 40 + Math.random() * 130, w: 2 + Math.random() * 2.6, p: Math.random() * 6 });
        }
        /* hanging canopy so the top of the section is swamp too, not just void */
        vines = [];
        for (let i = 0; i < 26; i++) {
          vines.push({ x: Math.random() * box.w, h: 60 + Math.random() * 220, p: Math.random() * 6, leaf: 2 + Math.floor(Math.random() * 4) });
        }
      }
      seed(); onResize(seed);

      let t = 0;
      loop.add((dt) => {
        const r = cv.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vp.h + 100) return;
        t += dt * 0.001;
        ctx.setTransform(box.s, 0, 0, box.s, 0, 0);
        ctx.clearRect(0, 0, box.w, box.h);

        /* layered bog hills */
        for (let l = 0; l < 3; l++) {
          ctx.beginPath();
          ctx.moveTo(0, box.h);
          const amp = 26 + l * 16, base = box.h * (0.62 + l * 0.13);
          for (let x = 0; x <= box.w; x += 24) {
            ctx.lineTo(x, base + Math.sin(x * 0.006 + l * 2.2 + t * 0.12) * amp);
          }
          ctx.lineTo(box.w, box.h);
          ctx.closePath();
          ctx.fillStyle = 'rgba(' + [30 + l * 14, 60 + l * 22, 20 + l * 10].join(',') + ',.62)';
          ctx.fill();
        }

        /* canopy: vines drop from the top edge and sway with the same wind */
        ctx.strokeStyle = 'rgba(90,140,50,.3)';
        ctx.lineWidth = 2;
        vines.forEach((v) => {
          const sway = Math.sin(t * 0.6 + v.p) * 12;
          ctx.beginPath();
          ctx.moveTo(v.x, 0);
          ctx.quadraticCurveTo(v.x + sway * 0.6, v.h * 0.55, v.x + sway, v.h);
          ctx.stroke();
          for (let k = 1; k <= v.leaf; k++) {
            const ly = (v.h / (v.leaf + 1)) * k;
            const lx = v.x + sway * (ly / v.h) * 0.9;
            ctx.beginPath();
            ctx.ellipse(lx + (k % 2 ? 7 : -7), ly, 8, 3.4, k % 2 ? 0.5 : -0.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(110,168,62,.26)';
            ctx.fill();
          }
        });

        /* reeds swaying in the same wind as the hills */
        ctx.strokeStyle = 'rgba(139,195,74,.22)';
        ctx.lineWidth = 2;
        reeds.forEach((rd) => {
          const sway = Math.sin(t * 0.9 + rd.p) * 9;
          ctx.beginPath();
          ctx.moveTo(rd.x, box.h);
          ctx.quadraticCurveTo(rd.x + sway * 0.5, box.h - rd.h * 0.6, rd.x + sway, box.h - rd.h);
          ctx.stroke();
        });

        /* fireflies */
        flies.forEach((f) => {
          f.a += f.s * dt * 0.002;
          const x = f.x + Math.cos(f.a) * 26;
          const y = f.y + Math.sin(f.a * 1.4) * 18;
          const al = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2.4 + f.tw));
          ctx.beginPath();
          ctx.arc(x, y, f.r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(214,232,138,' + al.toFixed(2) + ')';
          ctx.shadowColor = 'rgba(190,230,110,.9)'; ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        });
      });
    }

    /* the trail fills as you scroll past the stops */
    const route = $('#route'), rfill = $('#routeFill');
    if (route && rfill) {
      loop.add(() => {
        const r = route.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vp.h) return;
        const p = clamp((vp.h * 0.62 - r.top) / r.height, 0, 1);
        rfill.style.height = (p * 100).toFixed(1) + '%';
      });
    }
  })();

  /* ═══ WORLD 6 — arcade cabinet ════════════════════════════════════ */

  /* Stylised UI mock-ups drawn on canvas. Deliberately abstract wireframes,
     not fake screenshots — they show the shape of the work without
     pretending to be a real client screen. */
  const MOCK = (function () {
    /* Guards the geometry: a short canvas can produce a negative box, and
       arcTo throws on a negative radius rather than degrading. */
    const rr = (ctx, x, y, w, h, r) => {
      if (!(w > 0) || !(h > 0)) { ctx.beginPath(); return false; }
      const k = Math.max(0, Math.min(r, w / 2, h / 2));
      ctx.beginPath();
      ctx.moveTo(x + k, y);
      ctx.arcTo(x + w, y, x + w, y + h, k);
      ctx.arcTo(x + w, y + h, x, y + h, k);
      ctx.arcTo(x, y + h, x, y, k);
      ctx.arcTo(x, y, x + w, y, k);
      ctx.closePath();
      return true;
    };
    /* p is 0→1 entrance progress; each element eases in on its own offset */
    const at = (p, i, n) => clamp((p - (i / n) * 0.55) / 0.45, 0, 1);
    const ease = (v) => 1 - Math.pow(1 - v, 3);

    function chrome(ctx, x, y, w, h, c) {
      if (!(w > 40) || !(h > 40)) return;
      ctx.fillStyle = 'rgba(255,255,255,.07)'; rr(ctx, x, y, w, h, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.12)'; rr(ctx, x, y, w, 20, 10); ctx.fill();
      ['#ff5f57', '#febc2e', '#28c840'].forEach((d, i) => {
        ctx.beginPath(); ctx.arc(x + 12 + i * 12, y + 10, 3.4, 0, Math.PI * 2);
        ctx.fillStyle = d; ctx.fill();
      });
      ctx.fillStyle = 'rgba(255,255,255,.14)'; rr(ctx, x + 56, y + 5, w - 70, 10, 5); ctx.fill();
    }
    function bar(ctx, x, y, w, h, c, a) {
      if (!(w > 0) || !(h > 0)) return;
      ctx.fillStyle = c; ctx.globalAlpha = a;
      rr(ctx, x, y, w, h, Math.min(6, h / 2)); ctx.fill();
      ctx.globalAlpha = 1;
    }

    return function draw(ctx, w, h, kind, color, p, t) {
      ctx.clearRect(0, 0, w, h);
      const pad = Math.max(16, w * 0.06);

      if (kind === 'app') {
        const ph = h * 0.86, pw = ph * 0.49, px = (w - pw) / 2, py = (h - ph) / 2;
        ctx.fillStyle = 'rgba(0,0,0,.4)'; rr(ctx, px, py, pw, ph, pw * 0.11); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; ctx.stroke();
        bar(ctx, px + pw * 0.32, py + 8, pw * 0.36, 5, 'rgba(255,255,255,.3)', 1);
        for (let i = 0; i < 6; i++) {
          const a = ease(at(p, i, 6)); if (!a) continue;
          const y = py + 30 + i * (ph - 44) / 6;
          const off = (1 - a) * 26;
          bar(ctx, px + 10 + off, y, pw - 20, (ph - 52) / 6 - 6, i === 0 ? color : 'rgba(255,255,255,.13)', a * (i === 0 ? .9 : 1));
        }
        return;
      }

      if (kind === 'chat') {
        for (let i = 0; i < 7; i++) {
          const a = ease(at(p, i, 7)); if (!a) continue;
          const mine = i % 2 === 1;
          const bw = w * (0.3 + ((i * 37) % 23) / 100);
          const y = pad + i * ((h - pad * 2) / 7);
          const x = mine ? w - pad - bw : pad;
          ctx.globalAlpha = a;
          ctx.fillStyle = mine ? color : 'rgba(255,255,255,.13)';
          rr(ctx, x + (1 - a) * (mine ? 22 : -22), y, bw, (h - pad * 2) / 7 - 8, 10);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        /* typing dots on the newest bubble */
        const bx = pad + 14, by = pad + 6.4 * ((h - pad * 2) / 7) + 12;
        for (let d = 0; d < 3; d++) {
          ctx.beginPath();
          ctx.arc(bx + d * 11, by + Math.sin(t * 5 + d) * 2.2, 3, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill();
        }
        return;
      }

      if (kind === 'crm') {
        chrome(ctx, pad, pad, w - pad * 2, h - pad * 2, color);
        const ix = pad + 14, iy = pad + 32, iw = w - pad * 2 - 28;
        const cols = 4, cw = (iw - 24) / cols;
        for (let c = 0; c < cols; c++) {
          bar(ctx, ix + c * (cw + 8), iy, cw, 9, c === cols - 1 ? color : 'rgba(255,255,255,.24)', 1);
        }
        const rows = 7, rh = (h - pad * 2 - 60) / rows;
        for (let r = 0; r < rows; r++) {
          const a = ease(at(p, r, rows)); if (!a) continue;
          for (let c = 0; c < cols; c++) {
            const done = c < 1 + ((r * 3) % cols);
            bar(ctx, ix + c * (cw + 8) + (1 - a) * 18, iy + 20 + r * rh, cw * (0.6 + ((r + c) % 4) * 0.1), rh - 9,
                done ? color : 'rgba(255,255,255,.12)', a * (done ? .8 : 1));
          }
        }
        return;
      }

      if (kind === 'editorial') {
        chrome(ctx, pad, pad, w - pad * 2, h - pad * 2, color);
        const ix = pad + 16, iy = pad + 36, iw = w - pad * 2 - 32;
        [0.72, 0.5, 0.62].forEach((f, i) => {
          const a = ease(at(p, i, 6)); if (!a) return;
          bar(ctx, ix, iy + i * 26, iw * f * a, 17, i === 1 ? color : 'rgba(255,255,255,.3)', 1);
        });
        const gy = iy + 96, gh = h - pad - 16 - gy;
        for (let i = 0; i < 3; i++) {
          const a = ease(at(p, 3 + i, 6)); if (!a) continue;
          const gw = (iw - 20) / 3;
          bar(ctx, ix + i * (gw + 10), gy + (1 - a) * 20, gw, gh, i === 1 ? color : 'rgba(255,255,255,.14)', a);
        }
        return;
      }

      /* default: a marketing site */
      chrome(ctx, pad, pad, w - pad * 2, h - pad * 2, color);
      const ix = pad + 16, iy = pad + 36, iw = w - pad * 2 - 32;
      const heroH = (h - pad * 2 - 40) * 0.46;
      const a0 = ease(at(p, 0, 5));
      if (a0) { bar(ctx, ix, iy + (1 - a0) * 18, iw, heroH, color, a0 * .82); }
      const a1 = ease(at(p, 1, 5));
      if (a1) {
        bar(ctx, ix + 18, iy + heroH * 0.36, iw * 0.44 * a1, 14, 'rgba(255,255,255,.9)', 1);
        bar(ctx, ix + 18, iy + heroH * 0.36 + 22, iw * 0.3 * a1, 9, 'rgba(255,255,255,.5)', 1);
      }
      for (let i = 0; i < 3; i++) {
        const a = ease(at(p, 2 + i, 5)); if (!a) continue;
        const cw = (iw - 20) / 3;
        const cy = iy + heroH + 14;
        bar(ctx, ix + i * (cw + 10), cy + (1 - a) * 18, cw, h - pad - 16 - cy, 'rgba(255,255,255,.15)', a);
      }
    };
  })();

  (function cabinet() {
    const screen = $('#crtScreen'), dots = $('#crtDots'), carts = $('#carts'), rev = $('#rev');
    if (!screen) return;
    let cur = 0, timer = 0, shownAt = performance.now();

    D.CASES.forEach((c, i) => {
      const s = document.createElement('article');
      s.className = 'crt__slide';
      s.innerHTML =
        '<span class="crt__art" aria-hidden="true"></span>' +
        '<canvas class="crt__mock" aria-hidden="true"></canvas>' +
        '<span class="crt__tag"></span>' +
        '<h3 class="crt__t"></h3>' +
        '<div class="crt__wasnow">' +
          '<div class="crt__wn"><span>было</span><b></b></div>' +
          '<div class="crt__wn crt__wn--now"><span>стало</span><b></b></div>' +
        '</div>';
      s.querySelector('.crt__art').style.background = c.art;
      s.querySelector('.crt__tag').textContent = c.tag;
      s.querySelector('.crt__t').textContent = c.title;
      s.querySelectorAll('.crt__wn b')[0].textContent = c.was;
      s.querySelectorAll('.crt__wn b')[1].textContent = c.now;
      screen.appendChild(s);

      const d = document.createElement('button');
      d.type = 'button'; d.setAttribute('role', 'tab');
      d.setAttribute('aria-label', 'Кейс ' + (i + 1) + ': ' + c.tag);
      d.addEventListener('click', () => go(i, true));
      dots.appendChild(d);

      const ct = document.createElement('button');
      ct.type = 'button'; ct.className = 'cart'; ct.setAttribute('role', 'tab');
      ct.innerHTML = '<span class="cart__chip" aria-hidden="true"></span><span class="cart__txt"><b></b><span></span></span>';
      ct.querySelector('.cart__chip').style.setProperty('--cc', c.color);
      ct.querySelector('b').textContent = c.svc;
      ct.querySelector('b + span').textContent = c.tag;
      ct.addEventListener('click', () => go(i, true));
      carts.appendChild(ct);
    });

    const slides = $$('.crt__slide', screen);
    const dotEls = $$('button', dots);
    const cartEls = $$('.cart', carts);

    function go(i, manual) {
      cur = (i + D.CASES.length) % D.CASES.length;
      shownAt = performance.now();
      slides.forEach((s, j) => s.classList.toggle('is-on', j === cur));
      dotEls.forEach((d, j) => { d.classList.toggle('is-on', j === cur); d.setAttribute('aria-selected', j === cur ? 'true' : 'false'); });
      cartEls.forEach((c, j) => { c.classList.toggle('is-on', j === cur); c.setAttribute('aria-selected', j === cur ? 'true' : 'false'); });

      const r = D.CASES[cur].rv;
      rev.innerHTML =
        '<div class="rev__top">' +
          '<span class="rev__ini" aria-hidden="true"></span>' +
          '<span class="rev__who"><b></b><span></span></span>' +
          '<span class="rev__mk"></span>' +
        '</div><div class="rev__body"></div>';
      rev.querySelector('.rev__ini').textContent = r.ini;
      rev.querySelector('.rev__who b').textContent = r.name;
      rev.querySelector('.rev__who span').textContent = r.role;
      rev.querySelector('.rev__mk').textContent = r.mk;
      const body = rev.querySelector('.rev__body');
      r.p.forEach((p) => { const el = document.createElement('p'); el.textContent = p; body.appendChild(el); });

      if (manual) { score.add(75); restart(); }
    }
    function restart() {
      clearInterval(timer);
      if (REDUCED) return;
      timer = setInterval(() => go(cur + 1, false), 7000);
    }

    $('#crtPrev').addEventListener('click', () => go(cur - 1, true));
    $('#crtNext').addEventListener('click', () => go(cur + 1, true));
    screen.addEventListener('pointerenter', () => clearInterval(timer));
    screen.addEventListener('pointerleave', restart);

    /* the mock UI redraws only for the visible slide */
    const mocks = $$('.crt__mock', screen);
    let mockT = 0;
    loop.add((dt) => {
      const r = screen.getBoundingClientRect();
      if (r.bottom < -40 || r.top > vp.h + 40) return;
      mockT += dt * 0.001;
      const cv = mocks[cur]; if (!cv) return;
      const b = fitCanvas(cv);
      const ctx = cv.getContext('2d');
      ctx.setTransform(b.s, 0, 0, b.s, 0, 0);
      const p = clamp((performance.now() - shownAt) / 900, 0, 1);
      MOCK(ctx, b.w, b.h, D.CASES[cur].mock, D.CASES[cur].color, p, mockT);
    });

    go(0, false);
    /* only run the carousel while the cabinet is actually on screen */
    new IntersectionObserver((ens) => {
      ens.forEach((en) => (en.isIntersecting ? restart() : clearInterval(timer)));
    }, { threshold: 0.25 }).observe(screen);
  })();

  /* ═══ high-score belt ═════════════════════════════════════════════ */
  (function belt() {
    const row = $('#hiscoreRow'); if (!row) return;
    const make = () => D.METRICS.map((m) => {
      const s = document.createElement('span');
      s.className = 'hiscore__it';
      s.innerHTML = '<span></span><b class="' + (m[2] ? 'up' : 'down') + '"></b>';
      s.firstChild.textContent = m[0];
      s.lastChild.textContent = m[1];
      return s;
    });
    /* two identical passes so the -50% translate loops seamlessly */
    make().forEach((s) => row.appendChild(s));
    make().forEach((s) => row.appendChild(s));
  })();

  /* ═══ WORLD 7 — radar map ═════════════════════════════════════════ */
  (function geo() {
    const cv = $('#geoCanvas'); if (!cv) return;
    const ctx = cv.getContext('2d');
    const cityEl = $('#geoCity');
    let box, pts = [], hot = -1, sweep = 0;

    /* equirectangular, framed to the span the client list actually covers */
    const LON0 = -128, LON1 = 96, LAT0 = 66, LAT1 = 18;

    /* Very coarse coastlines (lon, lat). Not a real basemap — a readable
       backdrop so the arcs land on something instead of empty grid. */
    const LAND = [
      /* North America */
      [[-125,49],[-124,42],[-120,34],[-117,32],[-110,30],[-104,26],[-97,26],[-93,29],[-88,30],[-84,30],[-81,25],[-80,29],[-76,35],[-70,42],[-67,45],[-71,47],[-79,44],[-84,46],[-90,47],[-95,49],[-105,49],[-115,49]],
      /* Europe */
      [[-10,43],[-9,39],[-6,36],[0,39],[4,43],[8,44],[12,45],[16,42],[19,40],[24,40],[26,41],[29,41],[28,45],[31,46],[34,45],[38,46],[40,44],[44,42],[48,45],[50,47],[46,50],[40,52],[34,55],[28,57],[24,60],[22,63],[26,65],[30,66],[21,66],[15,65],[12,62],[10,59],[8,58],[4,52],[0,51],[-4,50],[-6,48],[-2,46],[-4,44]],
      /* Africa (north) + Middle East */
      [[-17,21],[-16,26],[-10,30],[-5,34],[3,36],[10,34],[15,32],[20,31],[25,32],[30,31],[34,31],[35,28],[38,24],[43,20],[48,20],[52,25],[56,26],[58,24],[57,20],[52,18],[45,19],[40,20],[36,22],[33,25],[30,25],[25,23],[20,22],[14,20],[8,20],[0,20],[-8,20]],
      /* Asia (schematic) */
      [[50,47],[56,50],[62,54],[68,55],[74,54],[80,52],[88,50],[95,50],[92,45],[86,44],[80,42],[74,40],[70,40],[66,42],[60,44],[54,45]]
    ];
    function project(c) {
      return {
        x: ((c.lon - LON0) / (LON1 - LON0)) * box.w,
        y: ((LAT0 - c.lat) / (LAT0 - LAT1)) * box.h
      };
    }

    function seed() {
      box = fitCanvas(cv);
      pts = D.CITIES.map((c) => {
        const p = project(c);
        return { l: c.l, x: p.x, y: p.y, ph: Math.random() * Math.PI * 2 };
      });
    }
    seed(); onResize(seed);

    cv.addEventListener('pointermove', (e) => {
      const r = cv.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      let best = -1, bd = 34 * 34;
      pts.forEach((p, i) => {
        const d = (p.x - mx) * (p.x - mx) + (p.y - my) * (p.y - my);
        if (d < bd) { bd = d; best = i; }
      });
      if (best !== hot) {
        hot = best;
        cityEl.textContent = hot < 0 ? 'Москва — отсюда всё началось'
          : (hot === 0 ? 'Москва — отсюда всё началось' : 'Москва → ' + pts[hot].l);
      }
    }, { passive: true });
    cv.addEventListener('pointerleave', () => { hot = -1; cityEl.textContent = 'Москва — отсюда всё началось'; });

    /* Москва, Дубай, Кремниевая долина, Нью-Йорк, Алматы */
    const ANCHOR = [0, 13, 15, 18, 7];

    let t = 0;
    loop.add((dt) => {
      const r = cv.getBoundingClientRect();
      if (r.bottom < -60 || r.top > vp.h + 60) return;
      t += dt * 0.001;
      sweep = (sweep + dt * 0.00016) % 1;

      ctx.setTransform(box.s, 0, 0, box.s, 0, 0);
      ctx.clearRect(0, 0, box.w, box.h);

      /* graticule */
      ctx.strokeStyle = 'rgba(49,224,200,.09)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 12; i++) {
        const x = (i / 12) * box.w;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, box.h); ctx.stroke();
      }
      for (let i = 0; i <= 6; i++) {
        const y = (i / 6) * box.h;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(box.w, y); ctx.stroke();
      }

      /* schematic coastlines — enough landmass for the blips to read as a map */
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = 'rgba(49,224,200,.2)';
      ctx.fillStyle = 'rgba(49,224,200,.045)';
      LAND.forEach((poly) => {
        ctx.beginPath();
        poly.forEach((c, i) => {
          const q = project({ lon: c[0], lat: c[1] });
          if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });

      /* the sweep bar */
      const sx = sweep * box.w;
      const g = ctx.createLinearGradient(sx - 160, 0, sx, 0);
      g.addColorStop(0, 'rgba(49,224,200,0)');
      g.addColorStop(1, 'rgba(49,224,200,.16)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 160, 0, 160, box.h);
      ctx.strokeStyle = 'rgba(49,224,200,.5)';
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, box.h); ctx.stroke();

      /* arcs out of Moscow */
      const m = pts[0];
      pts.forEach((p, i) => {
        if (i === 0) return;
        const near = Math.abs(p.x - sx) < 190 || i === hot;
        ctx.strokeStyle = i === hot ? 'rgba(49,224,200,.75)' : (near ? 'rgba(49,224,200,.24)' : 'rgba(49,224,200,.09)');
        ctx.lineWidth = i === hot ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.quadraticCurveTo((m.x + p.x) / 2, Math.min(m.y, p.y) - Math.abs(p.x - m.x) * 0.22, p.x, p.y);
        ctx.stroke();
      });

      /* blips */
      pts.forEach((p, i) => {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2 + p.ph);
        const isHot = i === hot, isHome = i === 0;
        const rad = isHome ? 6 : 4;
        if (isHot || isHome) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, rad + 8 + pulse * 6, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(49,224,200,' + (0.34 - pulse * 0.2).toFixed(2) + ')';
          ctx.lineWidth = 1.5; ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.fillStyle = isHome ? '#f7c948' : (isHot ? '#31e0c8' : 'rgba(49,224,200,.66)');
        ctx.shadowColor = isHome ? 'rgba(247,201,72,.8)' : 'rgba(49,224,200,.7)';
        ctx.shadowBlur = isHot || isHome ? 16 : 7;
        ctx.fill();
        ctx.shadowBlur = 0;

        /* anchors keep their name on screen; the rest light up on hover */
        if (isHot || ANCHOR.indexOf(i) >= 0) {
          ctx.font = '600 12px JetBrains Mono, ui-monospace, monospace';
          const w = ctx.measureText(p.l).width;
          const lx = clamp(p.x + 11, 4, box.w - w - 9);
          ctx.fillStyle = isHot ? 'rgba(4,10,12,.9)' : 'rgba(4,10,12,.55)';
          ctx.fillRect(lx - 5, p.y - 20, w + 10, 19);
          ctx.fillStyle = isHot ? '#eafffb' : 'rgba(180,232,220,.72)';
          ctx.fillText(p.l, lx, p.y - 7);
        }
      });
    });
  })();

  /* ═══ credits starfield ═══════════════════════════════════════════ */
  (function creditStars() {
    const cv = $('#creditStars'); if (!cv) return;
    const ctx = cv.getContext('2d');
    let box, st = [];
    function seed() {
      box = fitCanvas(cv);
      st = [];
      for (let i = 0; i < 90; i++) {
        st.push({ x: Math.random() * box.w, y: Math.random() * box.h, r: 0.5 + Math.random() * 1.4, v: 4 + Math.random() * 16 });
      }
    }
    seed(); onResize(seed);
    loop.add((dt) => {
      const r = cv.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vp.h) return;
      ctx.setTransform(box.s, 0, 0, box.s, 0, 0);
      ctx.clearRect(0, 0, box.w, box.h);
      st.forEach((s) => {
        s.y -= (s.v * dt) / 1000;
        if (s.y < -4) { s.y = box.h + 4; s.x = Math.random() * box.w; }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(242,235,221,.5)';
        ctx.fill();
      });
    });
  })();

  /* ═══ WORLD 8 — brief terminal ════════════════════════════════════ */
  (function brief() {
    const DRAFT = 'baza-brief-v2';
    const st = Object.assign(
      { task: [], when: '', pain: [], lvl: 1, name: '', contact: '', msg: '' },
      store.get(DRAFT, {}) || {}
    );

    const qTask = $('#qTask'), qWhen = $('#qWhen'), qPain = $('#qPain');
    const lvls = $('#calcLvls'), sumEl = $('#calcSum'), termEl = $('#calcTerm'), noteEl = $('#calcNote');
    const promptEl = $('#termPrompt');
    const form = $('#briefForm');
    if (!form) return;

    function chip(label, on) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (on ? ' is-on' : '');
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
          say(key, label, i < 0);
          calc(); save();
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
          say(key, label, !!st[key]);
          calc(); save();
        });
        box.appendChild(b);
      });
    }

    /* the terminal answers as you tick things — this is the "NPC" */
    let typing = 0;
    function say(key, label, added) {
      if (!added) return;
      const t = D.TIP[key];
      let line = '';
      if (key === 'task') line = (st.task.length > 1 ? D.TIP.task.__multi : (t[label] || 'Записал 📌'));
      else if (key === 'when') line = t[label] || 'Сроки понятны ⏱';
      else line = (st.pain.length > 1 ? t.__multi : t.__any);
      write(line);
    }
    function write(text) {
      clearInterval(typing);
      if (REDUCED) { promptEl.innerHTML = ''; promptEl.textContent = text; return; }
      let i = 0;
      promptEl.textContent = '';
      typing = setInterval(() => {
        i++;
        promptEl.innerHTML = text.slice(0, i) + '<span class="hero__caret"></span>';
        if (i >= text.length) clearInterval(typing);
      }, 16);
    }

    D.LVL.forEach((l, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'calc__lvl' + (i === st.lvl ? ' is-on' : '');
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

    const fmt = (n) => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');

    function calc() {
      const picks = st.task.length ? st.task : [];
      if (!picks.length) {
        sumEl.textContent = '—';
        termEl.textContent = 'выберите направление';
        noteEl.textContent = D.LVL[st.lvl].note;
        return;
      }
      let lo = 0, hi = 0, w0 = 0, w1 = 0;
      picks.forEach((p) => {
        const c = D.CALC[p]; if (!c) return;
        lo += c.lo; hi += c.hi;
        w0 = Math.max(w0, c.w[0]); w1 = Math.max(w1, c.w[1]);
      });
      /* the level moves the point inside the fork — it is not a markup */
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
    $('#fName').value = st.name || '';
    $('#fContact').value = st.contact || '';
    $('#fMsg').value = st.msg || '';
    ['fName', 'fContact', 'fMsg'].forEach((id) => $('#' + id).addEventListener('input', save));
    calc();

    /* symptoms ticked in World 1 pre-fill the brief */
    window.addEventListener('baza:sym', (e) => {
      let touched = false;
      (e.detail || []).forEach((k) => {
        const m = D.SYM[k]; if (!m) return;
        if (st.task.indexOf(m.task) < 0) { st.task.push(m.task); touched = true; }
        if (st.pain.indexOf(m.pain) < 0) { st.pain.push(m.pain); touched = true; }
      });
      if (!touched) return;
      multi(qTask, D.TASKS, 'task');
      multi(qPain, D.PAIN, 'pain');
      calc(); save();
    });

    /* ── submit ───────────────────────────────────────────────────── */
    function err(id, msg) { $('#' + id).textContent = msg || ''; return !msg; }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      save();
      const okName = err('eName', st.name.trim().length < 2 ? 'Как к вам обращаться?' : '');
      const okCont = err('eContact', st.contact.trim().length < 4 ? 'Оставьте телеграм, телефон или почту' : '');
      const okAgr  = err('eAgree', $('#fAgree').checked ? '' : 'Без согласия мы не сможем ответить');
      if (!okName || !okCont || !okAgr) {
        (!okName ? $('#fName') : !okCont ? $('#fContact') : $('#fAgree')).focus();
        return;
      }

      const lines = [
        'Заявка с сайта БАЗА',
        'Имя: ' + st.name,
        'Контакт: ' + st.contact,
        st.task.length ? 'Задача: ' + st.task.join(', ') : '',
        st.when ? 'Сроки: ' + st.when : '',
        st.pain.length ? 'Боль: ' + st.pain.join(', ') : '',
        'Уровень: ' + D.LVL[st.lvl].name,
        sumEl.textContent !== '—' ? 'Вилка: ' + sumEl.textContent + ' · ' + termEl.textContent : '',
        st.msg ? 'Комментарий: ' + st.msg : ''
      ].filter(Boolean);

      /* No endpoint is committed to a public repo, so the lead is queued
         locally and handed to Telegram — nothing can silently vanish. */
      const queue = store.get('baza-leads', []) || [];
      queue.push({ ts: Date.now(), text: lines.join('\n') });
      store.set('baza-leads', queue.slice(-20));

      $('#tgDup').href = 'https://t.me/lllbaza?text=' + encodeURIComponent(lines.join('\n'));
      $('#briefDone').classList.add('is-on');
      $('#briefDone').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
      write('Заявка записана. Ответим в течение рабочего дня 🤝');
      score.add(1000);
      toast('Заявка у нас — ответим в течение рабочего дня');
      store.del(DRAFT);
    });
  })();

  /* ═══ legal modal ═════════════════════════════════════════════════ */
  (function legal() {
    const m = $('#modal'), t = $('#modalT'), b = $('#modalB');
    let lastFocus = null;

    function open(key) {
      const doc = D.LEGAL[key]; if (!doc) return;
      lastFocus = document.activeElement;
      t.textContent = doc.t;
      b.innerHTML = '';
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

  /* ═══ cookie ══════════════════════════════════════════════════════ */
  (function cookie() {
    const el = $('#cookie');
    const KEY = 'baza-cookie-v1';
    function hide() { el.classList.remove('is-on'); }
    if (!store.get(KEY, null)) setTimeout(() => el.classList.add('is-on'), 2400);
    $('#cookieYes').addEventListener('click', () => { store.set(KEY, 'all'); hide(); toast('Спасибо 🍪'); });
    $('#cookieNo').addEventListener('click', () => { store.set(KEY, 'min'); hide(); });
    $('#cookieOpen').addEventListener('click', (e) => { e.preventDefault(); el.classList.add('is-on'); });
  })();

  /* ═══ konami — because of course ══════════════════════════════════ */
  (function konami() {
    const SEQ = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let i = 0;
    document.addEventListener('keydown', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      i = (k === SEQ[i]) ? i + 1 : (k === SEQ[0] ? 1 : 0);
      if (i === SEQ.length) {
        i = 0;
        document.documentElement.animate(
          [{ filter: 'hue-rotate(0deg)' }, { filter: 'hue-rotate(360deg)' }],
          { duration: 2400, iterations: 1 }
        );
        score.add(9999);
        toast('30 жизней выдано. Пользуйтесь аккуратно 🎮');
      }
    });
  })();

  /* ═══ go ══════════════════════════════════════════════════════════ */
  document.body.classList.add('is-locked');
  watch(document);
  /* elements rendered after boot still need the reveal observer */
  setTimeout(() => watch(document), 400);
})();
