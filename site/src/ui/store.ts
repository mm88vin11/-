/**
 * What the visitor has told us, gathered from every world.
 *
 * The brief asks for several things that only make sense if the worlds share
 * one memory: the feed's questions "go into a personal summary", the map of
 * losses is "already collected" by the time you try to leave, and the letter
 * for whoever signs off the budget has to contain what was actually chosen.
 * So the answers live here rather than inside the section that collected them.
 *
 * Persisted per tab, not per browser: a summary that survives a week is a
 * profile, and nobody asked us to keep one.
 */
type Answers = Record<string, string | string[] | number>;

const KEY = 'baza.summary';
const listeners = new Set<() => void>();

function read(): Answers {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Answers; }
  catch { return {}; }
}
let data: Answers = read();

export const store = {
  get<T extends string | string[] | number>(k: string, fallback: T): T {
    return (data[k] as T) ?? fallback;
  },
  set(k: string, v: string | string[] | number): void {
    data[k] = v;
    try { sessionStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode */ }
    for (const l of listeners) l();
  },
  bump(k: string, by = 1): number {
    const v = (typeof data[k] === 'number' ? (data[k] as number) : 0) + by;
    this.set(k, v);
    return v;
  },
  all(): Readonly<Answers> { return data; },
  onChange(fn: () => void): void { listeners.add(fn); },

  /** The map of losses, in the words the visitor picked. */
  losses(): string[] {
    const out: string[] = [];
    const pains = this.get<string[]>('pain.hit', []);
    if (pains.length) out.push(`Узнали себя в: ${pains.join(', ')}`);
    const leak = this.get<number>('pain.leak', 0);
    if (leak) out.push(`Оценка утечки: ${leak.toLocaleString('ru-RU')} тыс ₽/мес`);
    const bottleneck = this.get<string>('truth.leak', '');
    if (bottleneck) out.push(`Узкое место: ${bottleneck}`);
    const craft = this.get<string>('craft.pick', '');
    if (craft) out.push(`Собрали на верстаке: ${craft}`);
    const scope = this.get<string[]>('pricing.scope', []);
    if (scope.length) out.push(`Объём работ: ${scope.join(', ')}`);
    const price = this.get<string>('pricing.price', '');
    if (price) out.push(`Ориентир: ${price}`);
    const saved = this.get<string[]>('cases.saved', []);
    if (saved.length) out.push(`Отложили кейсы: ${saved.join('; ')}`);
    const feed = this.get<string[]>('cases.answers', []);
    if (feed.length) out.push(`Ответы по ходу: ${feed.join('; ')}`);
    const road = this.get<string[]>('route.answers', []);
    if (road.length) out.push(`Решения по маршруту: ${road.join('; ')}`);
    return out;
  },
};
