/**
 * 04 · ЛЕНТА — the feed.
 *
 * The credibility of this section is the gesture, so the scrolling is the
 * platform's own: CSS scroll-snap with `scroll-snap-stop: always`, not a
 * hand-written scroller. A bespoke inertia curve here would be one more thing
 * that feels almost right, and almost right is what makes a feed feel fake.
 *
 * The card art is generated — a three-stop field with a drifting grid — so five
 * cases look like five places without five photographs to download. Every third
 * card is a question rather than a case, and the answers go into the summary
 * the visitor can take away.
 */
import type { World } from '../core/world';
import { LOOKS } from '../core/world';
import { clock, type Job } from '../core/ticker';
import { quality } from '../core/quality';
import { audio } from '../core/audio-bus';
import { $$, clamp, el, esc, need } from '../core/dom';
import { copy } from '../ui/toast';
import { store } from '../ui/store';
import { CASES, FEED_QUESTIONS } from '../data/content';

class Cases implements World {
  readonly id = 'cases' as const;
  readonly look = LOOKS.cases;

  private section!: HTMLElement;
  private job: Job | null = null;
  private arts: { cv: HTMLCanvasElement; c: readonly string[]; seed: number }[] = [];
  private current = 0;
  private saved: string[] = [];

  mount(section: HTMLElement): void {
    this.section = section;
    this.build();
    this.job = clock.add(() => { /* the feed is CSS-driven; the job exists to
      own the resize repaint and to be pausable like every other world */ },
      { resize: () => this.repaint() });
    clock.once(() => this.repaint());
  }

  private build(): void {
    const feed = need('#feed', this.section);
    if (feed.childElementCount) return;
    const bars = need('#feedBars', this.section);
    const dots = need('#tokDots', this.section);
    const rail = need('#feedRail', this.section);
    const sound = need('#feedSound', this.section);
    const savedBox = need('#tokSaved', this.section);
    const savedN = need('#tokSavedN', this.section);

    let slide = 0;
    const addBar = (): void => { bars.appendChild(el('i')); slide++; };

    CASES.forEach((cs, i) => {
      const card = el('article', 'card');
      card.innerHTML =
        `<div class="card__art"><canvas aria-hidden="true"></canvas></div>` +
        `<p class="card__tag">${esc(cs.tag)}</p>` +
        `<p class="card__num">${esc(cs.num)} <small>${esc(cs.unit)}</small></p>` +
        `<h3 class="card__ttl">${esc(cs.ttl)}</h3>` +
        `<p class="card__note">${esc(cs.note)}</p>` +
        `<p class="card__by"><i>Б</i>@baza · запущено</p>`;
      feed.appendChild(card);
      this.arts.push({ cv: card.querySelector('canvas')!, c: cs.c, seed: i * 2.3 });
      addBar();

      const dot = el('button', 'tok__dot');
      dot.type = 'button';
      dot.setAttribute('role', 'tab');
      dot.innerHTML = `<u>${String(i + 1).padStart(2, '0')}</u><b>${esc(cs.ttl)}</b>`;
      dot.addEventListener('click', () => {
        feed.scrollTo({ top: card.offsetTop, behavior: quality.reducedMotion ? 'auto' : 'smooth' });
      });
      dots.appendChild(dot);

      /* Every third card asks something instead of claiming something. */
      const q = FEED_QUESTIONS.find((x) => x.after === i);
      if (q) {
        const qc = el('article', 'card card--q');
        qc.innerHTML =
          `<h3>${esc(q.q)}</h3><div class="card__ans">` +
          q.a.map((a) => `<button type="button" aria-pressed="false">${esc(a)}</button>`).join('') +
          `</div><p class="card__note">Ответ уходит в вашу сводку, а не в рассылку.</p>`;
        feed.appendChild(qc);
        addBar();
        $$('button', qc).forEach((b) => {
          b.addEventListener('click', () => {
            $$('button', qc).forEach((x) => x.setAttribute('aria-pressed', 'false'));
            b.setAttribute('aria-pressed', 'true');
            const answers = store.get<string[]>('cases.answers', []);
            const line = `${q.q} — ${b.textContent}`;
            store.set('cases.answers', [...answers.filter((a) => !a.startsWith(q.q)), line]);
            audio.click();
          });
        });
      }
    });

    /* The like is a paperclip: this is a business, not a mood board. */
    rail.innerHTML =
      `<button type="button" aria-label="Отложить"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 8v8.5a4.5 4.5 0 0 1-9 0V6.5a3 3 0 0 1 6 0V16a1.5 1.5 0 0 1-3 0V8"/></svg><span id="tokLikes">12,4K</span></button>` +
      `<button type="button" aria-label="Комментарии"><svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c5 0 9 3.3 9 7.4 0 4.1-4 7.4-9 7.4-.9 0-1.8-.1-2.6-.3L4 20l1.2-3.4C3.2 15.2 3 13 3 10.4 3 6.3 7 3 12 3z"/></svg><span>318</span></button>` +
      `<button type="button" aria-label="Поделиться"><svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor"><path d="M14 3v4C7.5 7.6 4.4 12 3 20c2.6-4.4 6-6.2 11-6.2V18l7-7.5z"/></svg><span>1 204</span></button>`;

    const clip = rail.querySelector('button')!;
    clip.addEventListener('click', () => {
      const cs = CASES[Math.min(this.current, CASES.length - 1)]!;
      const at = this.saved.indexOf(cs.ttl);
      if (at >= 0) this.saved.splice(at, 1); else this.saved.push(cs.ttl);
      clip.classList.toggle('is-liked', at < 0);
      store.set('cases.saved', this.saved);
      savedN.textContent = String(this.saved.length);
      savedBox.hidden = this.saved.length < 3;
      audio.click();
    });

    need('#tokLetter', this.section).addEventListener('click', () => {
      copy(this.letter(), 'Письмо для руководства скопировано');
    });

    const setActive = (i: number): void => {
      $$('i', bars).forEach((b, k) => b.classList.toggle('is-on', k <= i));
      $$('.tok__dot', dots).forEach((d, k) => d.classList.toggle('is-on', k === i));
      const cs = CASES[Math.min(i, CASES.length - 1)]!;
      const likes = document.getElementById('tokLikes');
      if (likes) likes.textContent = cs.likes;
      sound.textContent = `оригинальный звук · ${cs.tag} · БАЗА`;
    };
    setActive(0);

    feed.addEventListener('scroll', () => {
      const h = feed.clientHeight || 1;
      const i = clamp(Math.round(feed.scrollTop / h), 0, slide - 1);
      if (i !== this.current) { this.current = i; setActive(i); }
    }, { passive: true });

    feed.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const h = feed.clientHeight;
      feed.scrollTo({ top: (this.current + (e.key === 'ArrowDown' ? 1 : -1)) * h, behavior: 'smooth' });
    });
  }

  private letter(): string {
    const lines = [
      'Коротко, зачем это нам.',
      '',
      'Отложил несколько запусков, которые ближе всего к нашей задаче:',
      ...this.saved.map((s) => `— ${s}`),
      '',
      ...store.losses().map((l) => `— ${l}`),
      '',
      'Подрядчик: БАЗА, lllbaza.ru. Начинаем с разбора: это отдельная небольшая работа со своей ценой, её стоимость уходит в счёт проекта.',
    ];
    return lines.join('\n');
  }

  /** Generated art: a soft three-stop field with a drifting grid over it. */
  private paintArt(cv: HTMLCanvasElement, cs: readonly string[], seed: number): void {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(quality.dpr, 2);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (!r.width || !r.height) return;
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d')!;
    const g = c.createLinearGradient(0, 0, w * 0.3, h);
    g.addColorStop(0, cs[0]!); g.addColorStop(0.55, cs[1]!); g.addColorStop(1, cs[2]!);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const rg = c.createRadialGradient(w * 0.7, h * 0.26, 0, w * 0.7, h * 0.26, w * 0.9);
    rg.addColorStop(0, 'rgba(255,255,255,.16)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = rg; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,.055)';
    c.lineWidth = dpr;
    const step = w / 7;
    for (let i = 1; i < 14; i++) {
      const off = Math.sin(i * 1.7 + seed) * step * 0.34;
      c.beginPath();
      c.moveTo(i * step + off, -20);
      c.lineTo(i * step - off, h + 20);
      c.stroke();
    }
    /* The scrim the card's copy sits on. The art is generated and its lower
       third is not reliably dark, so the scrim carries the contrast rather
       than the palette getting lucky. */
    const scrim = c.createLinearGradient(0, h * 0.45, 0, h);
    scrim.addColorStop(0, 'rgba(0,0,0,0)');
    scrim.addColorStop(1, 'rgba(0,0,0,.62)');
    c.fillStyle = scrim;
    c.fillRect(0, h * 0.45, w, h * 0.55);
  }

  private repaint(): void { for (const a of this.arts) this.paintArt(a.cv, a.c, a.seed); }

  pause(): void { if (this.job) this.job.live = false; }
  resume(): void { if (this.job) { this.job.live = true; this.job.dirty = true; } }

  unmount(): void {
    if (this.job) clock.remove(this.job);
    this.job = null;
    /* The card art is the only memory this world holds. */
    for (const a of this.arts) { a.cv.width = a.cv.height = 1; }
  }
}

let instance: Cases | null = null;
export function create(): World { instance ??= new Cases(); return instance; }