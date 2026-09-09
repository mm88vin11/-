/**
 * 05 · ЦЕНА — two glasses.
 *
 * The first is the estimate: each line of scope is a tetromino that drops into
 * the well, and the height of the stack is the budget. Price is something you
 * build here rather than something a slider reports at you.
 *
 * The second is the one that fills whether you touch it or not — forty-five
 * seconds of an ordinary Tuesday, in matter-js, with the real messages on the
 * blocks. It cannot be won; tapping answers one message while three more
 * arrive. The way out is the autopilot button, which is the argument the whole
 * section is making. Skip is available from the first second and there is a
 * text alternative for anyone who cannot or would rather not play.
 */
import Matter from 'matter-js';
import type { World } from '../core/world';
import { LOOKS } from '../core/world';
import { clock, type Job } from '../core/ticker';
import { quality } from '../core/quality';
import { audio } from '../core/audio-bus';
import { $$, clamp, el, esc, lerp, need, fit } from '../core/dom';
import { invite } from '../ui/toast';
import { store } from '../ui/store';
import { SCOPE, FLOOD_LINES } from '../data/content';

const COLS = 10;
const ROWS = 17;
const GAME_MS = 45_000;

class Pricing implements World {
  readonly id = 'pricing' as const;
  readonly look = LOOKS.pricing;

  private section!: HTMLElement;
  private job: Job | null = null;
  private floodJob: Job | null = null;

  /* ——— the well ——— */
  private cv!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private grid: (string | null)[][] = [];
  private on: Record<string, boolean> = {};
  private falling: { x: number; y: number; cells: readonly (readonly number[])[]; c: string } | null = null;
  private score = 0;
  private lines = 0;
  private shownPrice = 0;

  /* ——— the flood ——— */
  private engine: Matter.Engine | null = null;
  private floodCv: HTMLCanvasElement | null = null;
  private floodCtx: CanvasRenderingContext2D | null = null;
  private msgs: { body: Matter.Body; w: number; h: number; text: string; dying: number }[] = [];
  private started = 0;
  private running = false;
  private auto = false;
  private spawnAt = 0;
  private answered = 0;

  mount(section: HTMLElement): void {
    this.section = section;
    this.cv = need<HTMLCanvasElement>('#ttC', section);
    this.ctx = this.cv.getContext('2d')!;
    this.resetGrid();
    this.buildScope();
    this.buildFlood();

    this.job = clock.add(() => { /* the well repaints on change, not per frame */ },
      { resize: () => { this.sizeWell(); this.paintWell(); } });
    clock.once(() => { this.sizeWell(); this.paintWell(); this.readout(); this.seed(); });
  }

  /* ─────────────────────────────────────────────────────── the estimate ── */
  private resetGrid(): void {
    this.grid = Array.from({ length: ROWS }, () => new Array<string | null>(COLS).fill(null));
  }

  private sizeWell(): void { fit(this.cv, Math.min(quality.dpr, 2)); }

  private paintWell(): void {
    const { width: w, height: h } = this.cv;
    const c = this.ctx;
    const u = Math.min(w / COLS, h / ROWS);
    const ox = (w - u * COLS) / 2;
    const oy = (h - u * ROWS) / 2;
    c.clearRect(0, 0, w, h);
    c.strokeStyle = 'rgba(242,235,221,.055)';
    c.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) { c.beginPath(); c.moveTo(ox + x * u, oy); c.lineTo(ox + x * u, oy + ROWS * u); c.stroke(); }
    for (let y = 0; y <= ROWS; y++) { c.beginPath(); c.moveTo(ox, oy + y * u); c.lineTo(ox + COLS * u, oy + y * u); c.stroke(); }

    const cell = (cx: number, cy: number, col: string): void => {
      const px = ox + cx * u;
      const py = oy + cy * u;
      c.fillStyle = col; c.fillRect(px, py, u, u);
      c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(px, py, u, u * 0.16); c.fillRect(px, py, u * 0.16, u);
      c.fillStyle = 'rgba(0,0,0,.32)'; c.fillRect(px, py + u * 0.84, u, u * 0.16); c.fillRect(px + u * 0.84, py, u * 0.16, u);
    };
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const g = this.grid[y]![x]; if (g) cell(x, y, g); }
    if (this.falling) {
      for (const cc of this.falling.cells) {
        const cy = cc[1]! + this.falling.y;
        if (cy >= 0 && cy < ROWS) cell(cc[0]! + this.falling.x, cy, this.falling.c);
      }
    }
  }

  private fitRow(sh: readonly (readonly number[])[], col: number): number | null {
    let last: number | null = null;
    for (let row = 0; row < ROWS; row++) {
      let ok = true;
      for (const s of sh) {
        const cx = s[0]! + col;
        const cy = s[1]! + row;
        if (cy >= ROWS || cx >= COLS || (cy >= 0 && this.grid[cy]![cx])) { ok = false; break; }
      }
      if (ok) last = row; else break;
    }
    return last;
  }

  private place(item: typeof SCOPE[number]): { x: number; y: number } | null {
    const width = Math.max(...item.sh.map((s) => s[0]!)) + 1;
    let best: { col: number; top: number } | null = null;
    for (let col = 0; col + width <= COLS; col++) {
      const top = this.fitRow(item.sh, col);
      if (top === null) continue;
      if (!best || top > best.top) best = { col, top };
    }
    return best ? { x: best.col, y: best.top } : null;
  }

  private drop(item: typeof SCOPE[number]): void {
    const p = this.place(item);
    if (!p) return;
    this.falling = { x: p.x, y: -4, cells: item.sh, c: item.c };
    const t0 = performance.now();
    const dur = quality.reducedMotion ? 1 : 340;
    const step = (): void => {
      const k = clamp((performance.now() - t0) / dur, 0, 1);
      if (this.falling) this.falling.y = Math.round(lerp(-4, p.y, k * k));
      this.paintWell();
      if (k < 1) { clock.once(step); return; }
      for (const cc of item.sh) {
        const cy = cc[1]! + p.y;
        if (cy >= 0) this.grid[cy]![cc[0]! + p.x] = item.c;
      }
      this.falling = null;
      audio.lock();
      this.clearLines();
      this.paintWell();
    };
    step();
  }

  private clearLines(): void {
    const full: number[] = [];
    for (let y = 0; y < ROWS; y++) if (this.grid[y]!.every(Boolean)) full.push(y);
    if (!full.length) return;
    for (const y of full) { this.grid.splice(y, 1); this.grid.unshift(new Array<string | null>(COLS).fill(null)); }
    this.lines += full.length;
    this.score += full.length * 100;
    const flash = need('#ttFlash', this.section);
    flash.classList.add('is-on');
    window.setTimeout(() => flash.classList.remove('is-on'), 360);
    audio.clear();
  }

  private rebuild(added: typeof SCOPE[number] | null): void {
    if (added) { this.drop(added); return; }
    this.resetGrid();
    this.lines = 0;
    for (const s of SCOPE) {
      if (!this.on[s.id]) continue;
      const p = this.place(s);
      if (!p) continue;
      for (const cc of s.sh) {
        const cy = cc[1]! + p.y;
        if (cy >= 0) this.grid[cy]![cc[0]! + p.x] = s.c;
      }
    }
    this.clearLines();
    this.paintWell();
  }

  private buildScope(): void {
    const host = need('#ttScope', this.section);
    if (host.childElementCount) return;
    for (const s of SCOPE) {
      const b = el('button', 'scope');
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.style.setProperty('--pc', s.c);
      b.innerHTML =
        `<span class="scope__box"></span>` +
        `<span><b>${esc(s.n)}</b><span>${esc(s.d)}</span></span>` +
        `<u>+${s.p} тыс</u>`;
      b.addEventListener('click', () => {
        this.on[s.id] = !this.on[s.id];
        b.setAttribute('aria-pressed', this.on[s.id] ? 'true' : 'false');
        audio.click();
        this.rebuild(this.on[s.id] ? s : null);
        this.readout();
      });
      host.appendChild(b);
    }
    invite($$('.scope', host), 1);
  }

  private readout(): void {
    const picked = SCOPE.filter((s) => this.on[s.id]);
    const base = picked.reduce((a, s) => a + s.p, 0);
    const weeksRaw = picked.reduce((a, s) => a + s.w, 0);
    const weeks = picked.length ? Math.max(2, Math.round(Math.sqrt(weeksRaw) * 1.6)) : 0;
    const lo = Math.round(base * 0.9);
    const hi = Math.round(base * 1.28);

    const priceEl = need('#ttPrice', this.section);
    const miniP = need('#ttMiniPrice', this.section);
    const from = this.shownPrice;
    const t0 = performance.now();
    const anim = (): void => {
      const k = clamp((performance.now() - t0) / (quality.reducedMotion ? 1 : 460), 0, 1);
      const v = Math.round(lerp(from, lo, 1 - Math.pow(1 - k, 3)));
      const txt = picked.length ? `${v}–${Math.round(v * 1.42)}` : '0';
      priceEl.textContent = txt;
      miniP.textContent = txt;
      if (k < 1) clock.once(anim);
    };
    anim();
    this.shownPrice = lo;

    need('#ttTerm', this.section).textContent = picked.length ? `≈ ${weeks} нед.` : '—';
    need('#ttMiniTerm', this.section).textContent = picked.length ? `срок ≈ ${weeks} нед.` : 'выберите работы';
    need('#ttTeam', this.section).textContent = picked.length
      ? `${Math.min(5, Math.max(2, Math.ceil(picked.length / 2) + 1))} чел.` : '—';

    this.score = Math.max(this.score, base * 10);
    need('#ttScore', this.section).textContent = String(this.score).padStart(6, '0');
    need('#ttLines', this.section).textContent = String(this.lines);
    need('#ttLevel', this.section).textContent = String(1 + Math.floor(picked.length / 3));

    const say = need('#ttSay', this.section);
    if (!picked.length) say.textContent = 'Ничего не выбрано. Включите хотя бы одну работу — стакан начнёт заполняться.';
    else if (base < 90) say.textContent = 'Нижняя граница: проверенные решения и готовые механики. Работать будет. Запоминаться — не обязано.';
    else if (base < 220) say.textContent = 'Рабочая середина — сюда мы и советуем ставить ручку. Хватает и на смысл, и на исполнение.';
    else say.textContent = 'Верх вилки: уникальная механика, съёмка, сложные интеграции. Берём такое, когда есть за счёт чего окупить.';
    if (picked.length) {
      say.textContent += ` Вилка ${lo}–${hi} тыс ₽; точную цифру называем после разбора, и дальше она не меняется.`;
      store.set('pricing.scope', picked.map((p) => p.n));
      store.set('pricing.price', `${lo}–${hi} тыс ₽, ≈ ${weeks} нед.`);
    }
  }

  /** Two lines are in from the start, so the well is never an empty box. */
  private seeded = false;
  private seed(): void {
    if (this.seeded) return;
    const io = new IntersectionObserver((rows, o) => {
      if (!rows[0]?.isIntersecting || this.seeded) return;
      this.seeded = true;
      o.disconnect();
      const host = need('#ttScope', this.section);
      ['design', 'front'].forEach((id, i) => {
        const idx = SCOPE.findIndex((s) => s.id === id);
        window.setTimeout(() => $$('.scope', host)[idx]?.click(), 240 + i * 420);
      });
    }, { threshold: 0.3 });
    io.observe(this.section);
  }

  /* ────────────────────────────────────────────────────────── the flood ── */
  private buildFlood(): void {
    this.floodCv = need<HTMLCanvasElement>('#floodC', this.section);
    this.floodCtx = this.floodCv.getContext('2d');
    const go = need<HTMLButtonElement>('#floodGo', this.section);
    const autoBtn = need<HTMLButtonElement>('#floodAuto', this.section);
    const skip = need<HTMLButtonElement>('#floodSkip', this.section);
    const over = need('#floodOver', this.section);

    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.0014 } });
    this.engine = engine;

    const walls = (): void => {
      if (!this.floodCv) return;
      fit(this.floodCv, Math.min(quality.dpr, 1.5));
      const w = this.floodCv.width;
      const h = this.floodCv.height;
      Matter.Composite.clear(engine.world, false, true);
      Matter.Composite.add(engine.world, [
        Matter.Bodies.rectangle(w / 2, h + 20, w * 2, 40, { isStatic: true }),
        Matter.Bodies.rectangle(-20, h / 2, 40, h * 3, { isStatic: true }),
        Matter.Bodies.rectangle(w + 20, h / 2, 40, h * 3, { isStatic: true }),
      ]);
      this.msgs = [];
    };
    walls();

    go.addEventListener('click', () => this.start(false));
    autoBtn.addEventListener('click', () => this.start(true));
    skip.addEventListener('click', () => {
      this.stop();
      over.hidden = false;
      over.textContent = 'Пропущено. Короткая версия: сообщений всегда больше, чем рук.';
      need('#flood', this.section).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });

    /* Tap answers one message. Three more arrive while you do it. */
    this.floodCv.addEventListener('pointerdown', (e) => {
      if (!this.running || !this.floodCv) return;
      const r = this.floodCv.getBoundingClientRect();
      const sx = this.floodCv.width / r.width;
      const x = (e.clientX - r.left) * sx;
      const y = (e.clientY - r.top) * sx;
      for (let i = this.msgs.length - 1; i >= 0; i--) {
        const m = this.msgs[i]!;
        const p = m.body.position;
        if (Math.abs(p.x - x) < m.w / 2 + 8 && Math.abs(p.y - y) < m.h / 2 + 8) {
          m.dying = 1;
          this.answered++;
          audio.tap();
          navigator.vibrate?.(8);
          break;
        }
      }
    });

    this.floodJob = clock.add(({ dt, t }) => {
      if (!this.engine || !this.floodCtx || !this.floodCv) return;
      if (this.running) this.step(t);
      Matter.Engine.update(this.engine, Math.min(dt * 1000, 24));
      this.paintFlood();
    }, { always: true, resize: walls });
  }

  private start(auto: boolean): void {
    const over = need('#floodOver', this.section);
    over.hidden = true;
    this.auto = auto;
    this.answered = 0;
    if (!this.running) {
      this.running = true;
      this.started = performance.now();
      this.spawnAt = 0;
    }
    if (auto) {
      /* The autopilot takes the stack apart by itself. Five seconds, and the
         visitor does nothing — which is the entire product in one gesture. */
      const total = this.msgs.length || 1;
      this.msgs.forEach((m, i) => {
        window.setTimeout(() => { m.dying = 1; audio.tap(); }, (i / total) * 4600);
      });
      window.setTimeout(() => {
        this.running = false;
        over.hidden = false;
        over.textContent = 'Стакан разобрал себя сам. Это и есть автоматизация: те же сообщения, но отвечает не вы.';
        audio.clear();
      }, 5000);
    }
  }

  private stop(): void {
    this.running = false;
    if (!this.engine) return;
    for (const m of this.msgs) Matter.Composite.remove(this.engine.world, m.body);
    this.msgs = [];
  }

  private step(t: number): void {
    if (!this.engine || !this.floodCv) return;
    const elapsed = performance.now() - this.started;
    const timeEl = need('#floodTime', this.section);
    const countEl = need('#floodCount', this.section);
    timeEl.textContent = `0:${String(Math.floor(elapsed / 1000)).padStart(2, '0')}`;
    countEl.textContent = `${this.msgs.length + this.answered} сообщений`;

    if (!this.auto) {
      /* Non-linear: the rate is fine for ten seconds and impossible by forty. */
      const rate = 900 / (1 + Math.pow(elapsed / 12_000, 2.1) * 6);
      if (t > this.spawnAt) {
        this.spawnAt = t + rate;
        this.spawn();
      }
      if (elapsed > GAME_MS) this.lose(elapsed);
      /* Or earlier, if the pile reaches the top. */
      const top = this.msgs.reduce((a, m) => Math.min(a, m.body.position.y), Infinity);
      if (top < this.floodCv.height * 0.12 && this.msgs.length > 8) this.lose(elapsed);
    }
  }

  private lose(elapsed: number): void {
    this.running = false;
    const over = need('#floodOver', this.section);
    over.hidden = false;
    over.textContent = `Вы продержались ${Math.round(elapsed / 1000)} секунд. В жизни это идёт третий год.`;
    audio.bump();
  }

  private spawn(): void {
    if (!this.engine || !this.floodCv) return;
    const w = this.floodCv.width;
    const text = FLOOD_LINES[Math.floor(Math.random() * FLOOD_LINES.length)]!;
    const scale = this.floodCv.width / 600;
    const bw = clamp(text.length * 7.4 * scale, 90 * scale, w * 0.72);
    const bh = 26 * scale;
    const body = Matter.Bodies.rectangle(
      w * 0.16 + Math.random() * w * 0.68, -bh * 2, bw, bh,
      { restitution: 0.05, friction: 0.7, chamfer: { radius: bh / 2 } },
    );
    Matter.Composite.add(this.engine.world, body);
    this.msgs.push({ body, w: bw, h: bh, text, dying: 0 });
  }

  private paintFlood(): void {
    const c = this.floodCtx;
    const cv = this.floodCv;
    if (!c || !cv) return;
    c.clearRect(0, 0, cv.width, cv.height);
    const scale = cv.width / 600;
    c.font = `${Math.round(12 * scale)}px ${getComputedStyle(document.body).fontFamily}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let i = this.msgs.length - 1; i >= 0; i--) {
      const m = this.msgs[i]!;
      if (m.dying > 0) {
        m.dying -= 0.06;
        if (m.dying <= 0) {
          Matter.Composite.remove(this.engine!.world, m.body);
          this.msgs.splice(i, 1);
          continue;
        }
      }
      const p = m.body.position;
      c.save();
      c.globalAlpha = m.dying > 0 ? m.dying : 1;
      c.translate(p.x, p.y);
      c.rotate(m.body.angle);
      c.fillStyle = m.dying > 0 ? 'rgba(95,176,242,.5)' : 'rgba(242,235,221,.9)';
      const r = m.h / 2;
      c.beginPath();
      c.roundRect(-m.w / 2, -m.h / 2, m.w, m.h, r);
      c.fill();
      c.fillStyle = '#0c0c10';
      c.fillText(m.text, 0, 1, m.w - 14 * scale);
      c.restore();
    }
  }

  pause(): void {
    if (this.job) this.job.live = false;
    if (this.floodJob) this.floodJob.live = false;
  }

  resume(): void {
    if (this.job) { this.job.live = true; this.job.dirty = true; }
    if (this.floodJob) { this.floodJob.live = true; this.floodJob.dirty = true; }
  }

  unmount(): void {
    if (this.job) clock.remove(this.job);
    if (this.floodJob) clock.remove(this.floodJob);
    this.job = this.floodJob = null;
    this.stop();
    if (this.engine) { Matter.Engine.clear(this.engine); this.engine = null; }
  }
}

let instance: Pricing | null = null;
export function create(): World { instance ??= new Pricing(); return instance; }
