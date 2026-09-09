/**
 * 09 · СВЕТЛЫЙ МИР — the brief.
 *
 * The only section with a form in it, so the only one where getting the small
 * things wrong actually costs the business something. The rules it follows,
 * all of them from the brief's list of prohibitions: no "well, are you buying
 * then?", no countdown, no discount, no answering questions nobody asked, and
 * the estimate stays a range because a range is a decision.
 *
 * There is no backend behind a static site, so the brief is put on the
 * clipboard and Telegram is opened. Nothing anybody typed is lost.
 */
import type { World } from '../core/world';
import { LOOKS } from '../core/world';
import { clock, type Job } from '../core/ticker';
import { audio } from '../core/audio-bus';
import { $$, el, esc, need } from '../core/dom';
import { copy, toast } from '../ui/toast';
import { store } from '../ui/store';
import { CITIES, NO_LIST, BRIEF_WHAT, BRIEF_WHEN, BRIEF_PAIN } from '../data/content';

class Brief implements World {
  readonly id = 'brief' as const;
  readonly look = LOOKS.brief;

  private section!: HTMLElement;
  private job: Job | null = null;
  private pick: { what: string[]; when: string | null; pain: string[] } = { what: [], when: null, pain: [] };
  private cityTimer = 0;

  mount(section: HTMLElement): void {
    this.section = section;
    this.buildCities();
    this.buildFilter();
    this.buildForm();

    let x = 0;
    let half = 0;
    const run = need('#cityRun', section);
    const measure = (): void => { half = run.scrollWidth / 2; };
    this.job = clock.add(({ k }) => {
      if (!half) { measure(); return; }
      x -= 0.3 * k;
      if (x <= -half) x += half;
      run.style.transform = `translate3d(${x}px,0,0)`;
    }, { always: true, resize: measure });
    clock.once(measure);
  }

  private buildCities(): void {
    const run = need('#cityRun', this.section);
    const localTime = (offset: number): string => {
      const d = new Date();
      const utc = d.getTime() + d.getTimezoneOffset() * 60000;
      const l = new Date(utc + offset * 3600000);
      return `${String(l.getHours()).padStart(2, '0')}:${String(l.getMinutes()).padStart(2, '0')}`;
    };
    const fill = (): void => {
      const html = CITIES.map(([c, off]) => `<span class="city">${esc(c)}<time>${localTime(off)}</time></span>`).join('');
      run.innerHTML = html + html;
    };
    fill();
    this.cityTimer = window.setInterval(fill, 60_000);
  }

  private buildFilter(): void {
    const x = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';
    need('#filterList', this.section).innerHTML =
      NO_LIST.map((n) => `<li>${x}<span>${esc(n)}</span></li>`).join('');
  }

  private buildForm(): void {
    const chips = (host: HTMLElement, items: readonly { k: string }[] | readonly string[], multi: boolean, key: 'what' | 'when' | 'pain'): void => {
      if (host.childElementCount) return;
      for (const raw of items) {
        const label = typeof raw === 'string' ? raw : raw.k;
        const b = el('button', 'chip');
        b.type = 'button';
        b.textContent = label;
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', () => {
          audio.click();
          if (multi) {
            const on = b.getAttribute('aria-pressed') === 'true';
            b.setAttribute('aria-pressed', on ? 'false' : 'true');
            const picked = $$('.chip[aria-pressed="true"]', host).map((c) => c.textContent ?? '');
            if (key === 'what') this.pick.what = picked;
            if (key === 'pain') this.pick.pain = picked;
          } else {
            $$('.chip', host).forEach((c) => c.setAttribute('aria-pressed', 'false'));
            b.setAttribute('aria-pressed', 'true');
            this.pick.when = label;
          }
          this.calc();
        });
        host.appendChild(b);
      }
    };
    chips(need('#bWhat', this.section), BRIEF_WHAT, true, 'what');
    chips(need('#bWhen', this.section), BRIEF_WHEN, false, 'when');
    chips(need('#bPain', this.section), BRIEF_PAIN, true, 'pain');
    this.calc();

    const s1 = need('#bs1', this.section);
    const s2 = need<HTMLFormElement>('#bs2', this.section);
    const done = need('#bsDone', this.section);
    const agree = need('#bAgree', this.section);

    need('#bNext', this.section).addEventListener('click', () => {
      if (!this.pick.what.length) { toast('Отметьте хотя бы одну задачу'); return; }
      s1.classList.remove('is-on');
      s2.classList.add('is-on');
      (s2.querySelector('input') as HTMLInputElement | null)?.focus();
    });
    need('#bBack', this.section).addEventListener('click', () => {
      s2.classList.remove('is-on');
      s1.classList.add('is-on');
    });
    agree.addEventListener('click', () => {
      agree.setAttribute('aria-pressed', agree.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    });

    s2.addEventListener('submit', (e) => {
      e.preventDefault();
      const to = need<HTMLInputElement>('#fTo', this.section);
      if (!to.value.trim()) {
        to.closest('.field')?.classList.add('is-bad');
        to.focus();
        toast('Оставьте, куда вам ответить');
        return;
      }
      to.closest('.field')?.classList.remove('is-bad');
      if (agree.getAttribute('aria-pressed') !== 'true') {
        toast('Нужно согласие на обработку данных');
        return;
      }
      copy(this.summary(), 'Заявка скопирована — вставьте её в Telegram');
      s2.classList.remove('is-on');
      done.classList.add('is-on');
      audio.clear();
      window.setTimeout(() => window.open('https://t.me/lllbaza', '_blank', 'noopener'), 700);
    });

    need('#bFwd', this.section).addEventListener('click', () => copy(this.letter(), 'Текст для руководства скопирован'));
  }

  private calc(): void {
    let base = 0;
    let weeks = 0;
    for (const k of this.pick.what) {
      const it = BRIEF_WHAT.find((x) => x.k === k);
      if (it) { base += it.p; weeks += it.w; }
    }
    const when = BRIEF_WHEN.find((x) => x.k === this.pick.when);
    base = Math.round(base * (when?.m ?? 1));
    base += this.pick.pain.length * 12;

    const priceEl = need('#bPrice', this.section);
    const termEl = need('#bTerm', this.section);
    if (!base) { priceEl.textContent = '—'; termEl.textContent = 'срок ≈ —'; return; }
    const lo = Math.round((base * 0.88) / 10) * 10;
    const hi = Math.round((base * 1.3) / 10) * 10;
    priceEl.textContent = `${lo}–${hi} тыс ₽`;
    termEl.textContent = `срок ≈ ${Math.max(2, Math.round(weeks * 0.6))} нед.`;
    store.set('brief.price', `${lo}–${hi} тыс ₽`);
  }

  private summary(): string {
    const lines = ['Заявка в БАЗУ'];
    lines.push(`Задача: ${this.pick.what.join(', ') || 'не выбрано'}`);
    if (this.pick.when) lines.push(`Старт: ${this.pick.when}`);
    if (this.pick.pain.length) lines.push(`Больно сейчас: ${this.pick.pain.join(', ')}`);
    lines.push(`Ориентир: ${need('#bPrice', this.section).textContent}, ${need('#bTerm', this.section).textContent}`);
    const name = need<HTMLInputElement>('#fName', this.section).value.trim();
    const to = need<HTMLInputElement>('#fTo', this.section).value.trim();
    const more = need<HTMLTextAreaElement>('#fMore', this.section).value.trim();
    if (name) lines.push(`Имя: ${name}`);
    if (to) lines.push(`Связь: ${to}`);
    if (more) lines.push(`Детали: ${more}`);
    /* Everything the visitor already told the other worlds travels with it. */
    const losses = store.losses();
    if (losses.length) { lines.push('', 'Что уже отметили на сайте:', ...losses.map((l) => `— ${l}`)); }
    lines.push('', 'Источник: lllbaza.ru');
    return lines.join('\n');
  }

  private letter(): string {
    const what = this.pick.what.join(', ') || 'сайт и автоматизация';
    const price = need('#bPrice', this.section).textContent ?? '—';
    const term = (need('#bTerm', this.section).textContent ?? '').replace('срок ≈ ', '');
    return [
      'Коротко, зачем это нам.',
      '',
      'Сейчас заявки приходят в несколько разных мест, отвечает человек, и скорость ответа зависит от его расписания. Часть обращений теряется, посчитать их невозможно.',
      '',
      `Что предлагается: ${what}.`,
      `Ориентир по бюджету: ${price === '—' ? 'уточняется после разбора' : price}.`,
      `Срок: ${term || 'уточняется'}.`,
      '',
      ...(store.losses().length ? ['Из того, что уже посчитали:', ...store.losses().map((l) => `— ${l}`), ''] : []),
      'Начинаем с разбора: это отдельная небольшая работа со своей ценой, её стоимость уходит в счёт проекта. По итогам разбора будет точная цифра, которая дальше не меняется.',
      '',
      'Подрядчик: БАЗА, lllbaza.ru',
    ].join('\n');
  }

  pause(): void { if (this.job) this.job.live = false; }
  resume(): void { if (this.job) { this.job.live = true; this.job.dirty = true; } }

  unmount(): void {
    if (this.job) clock.remove(this.job);
    this.job = null;
    window.clearInterval(this.cityTimer);
  }
}

let instance: Brief | null = null;
export function create(): World { instance ??= new Brief(); return instance; }