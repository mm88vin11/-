# Project configurator — how to edit prices and services

The configurator lives in `index.html`, in the `#brief` section. It replaced the
old two-step lead form: the form is still there, but as the last step of a build
rather than the entry to the conversation. The anchor is unchanged (`#brief`), so
every existing link — header CTA, menu, service cards, pricing block — still lands
in the right place.

**Nothing about prices lives in the markup.** Everything below is edited in one
block near the top of the component class in `index.html`, marked:

```
╔══════════════════════════════════════════════════════════════════════╗
║  КОНФИГУРАТОР ПРОЕКТА — ВСЯ ЭКОНОМИКА В ОДНОМ МЕСТЕ                  ║
╚══════════════════════════════════════════════════════════════════════╝
```

Search the file for `CFGD = [` to jump straight to it. Change a number there and
the range, the term, the team, the summary panel, the shared link, the exported
spec and the text of the lead that reaches Telegram all follow. No other file
needs touching.

## Units, once

| Field | Unit |
| --- | --- |
| `lo`, `hi`, `add`, `per`, `mo` | thousands of roubles (`180` = 180 000 ₽) |
| `w`, `perW` | weeks of work, `[low, high]` |
| `hrs`, `hrsPer` | hours per month the client currently spends doing this by hand |

`hrs` is what feeds the "cost of doing nothing" screen: hours × `CFGRATE`.
Set it only for options that actually remove manual work.

## Top-level knobs

```js
CFGRATE  = 1200;   // ₽ per hour of manual staff work
CFGEXPRESS = 25;   // express audit, thousands of ₽ (credited against the project)
CFGPACK  = [0, 0, 0.06, 0.10, 0.13, 0.15, 0.15];  // package discount by direction count
CFGSPEED           // normal / rush: price multiplier and term multiplier
CFGSUP             // support tiers, monthly range
CFGSTART           // start format: express audit first, or straight to work
CFGPRE             // presets: pain → ready-made draft build
CFGT               // every string the configurator prints
```

## Adding a direction

Append an entry to `CFGD`:

```js
{
  k: 'shop',                       // unique key, also used in the shared link
  name: 'Интернет-магазин',
  legacy: 'Сайт',                  // maps onto the page's old category vocabulary
  why: 'Одна строка: что это даёт бизнесу.',
  lo: 300, hi: 1400, w: [4, 9], hrs: 8,
  team: ['дизайнер', 'фронтенд', 'бэкенд'],
  stage1: 'Что клиент получает на руки в конце первого этапа',
  opts: [ /* see below */ ]
}
```

`legacy` keeps the rest of the page consistent — the pricing block, the tier
recommendation and the lead payload read those old category names. Use one of
`Сайт`, `Приложение`, `ИИ-бот`, `Автоматизация`, `Брендинг`, `Соцсети`.

## Option types

Four control types, picked by what the data actually is — not for variety:

```js
// toggle — on/off
{ k: 'seo', t: 'sw', name: '…', why: '…', add: [35, 125], w: [0.5, 1.5], hrs: 0 }

// segmented — base / plus / max, exactly one value
{ k: 'design', t: 'seg', name: '…', why: '…', d: 0, v: [
  { n: 'На базе системы', s: 'подпись', add: [0, 0], w: [0, 0] },
  { n: 'Авторский',       s: 'подпись', add: [85, 250], w: [1, 2] }
]}

// set — several at once (platforms); terms run in parallel, prices add up
{ k: 'plat', t: 'multi', name: '…', why: '…', d: ['web'], v: [
  { k: 'ios', n: 'iOS', add: [180, 620], w: [2, 4] }
]}

// counter + slider — a quantity above a free minimum
{ k: 'sys', t: 'num', name: '…', why: '…',
  min: 1, max: 8, step: 1, unit: 'сист.', d: 2,
  per: [38, 120], perW: [0.4, 0.9], hrsPer: 6 }
```

For `num`, `min` is the free baseline: cost starts accruing above it.

`why` is a promise to the business, not a technical description. It is the line
the client actually reads, so write it as an outcome ("Заявка попадает в систему
сама"), never as a feature list.

### Linked and incompatible options

```js
{ k: 'ab', t: 'sw', …, need: ['site.ana'] }   // turns the other one on and says why
{ k: 'x',  t: 'sw', …, excl: ['site.y'] }     // turns the other one off and says why
```

Both explain themselves in a sentence instead of silently blocking a click. The
sentence templates are `CFGT.needFmt` / `CFGT.exclFmt`.

## Presets

`CFGPRE` maps a pain to a ready-made build. `SYMPRE` maps the symptoms a visitor
ticks on the first screen to those same presets, so someone who checked "всё
держится на мне" arrives at the configurator with a draft already assembled.

```js
{ k: 'leads', n: 'Мне нужны заявки', s: 'подпись',
  pain: 'Теряем заявки и клиентов',          // fills the old pain field in the lead
  d: ['site'],                                // directions
  o: { 'site.design': 1, 'site.crm': true },  // options, keyed "direction.option"
  speed: 0, sup: 1, start: 0 }
```

## How the maths works

- Each direction: base range plus every selected option.
- Several directions run in parallel — the longest sets the term, the others add
  45 % of theirs. Prices add up in full.
- Rush mode multiplies price by `CFGSPEED[1].mult` and term by `.fast`.
- The package discount from `CFGPACK` applies to the project price only.
- Support is quoted separately, per month, scaled by `1 + 0.22 × (directions − 1)`.
- Everything is rounded to a step a person can repeat from memory (`cfgRound`).

## Checking your edit

Open the page and run this in the browser console:

```js
__baza.cfgSelfTest()
```

It exercises the empty build, the minimum, the maximum with every option at its
ceiling, rush vs. normal, the package discount, the cost-of-inaction total, and
a round trip through the shared-link codec. An empty array means the calculator
agrees with itself; anything else is printed as a list of mismatches.

Worth eyeballing after a price change:

- the minimum build stays inside the studio's stated 150 000 – 2 000 000 ₽ range;
- a package of two is cheaper than the two bought separately;
- rush is more expensive and genuinely shorter.

## Where a submitted build goes

Unchanged from before — `LEAD` at the top of the class (`endpoint`, `tgToken`,
`tgChat`). The payload now carries a `build` object (range, term, per-direction
composition, support, package discount, manual hours, and a link that reopens the
exact build), and the Telegram message renders it as a readable spec so a manager
sees the whole configuration at a glance.

## Open item

The figures currently in `CFGD`, `CFGRATE` and `CFGSUP` were derived from the
prices already published on the page and the studio's stated 150 000 – 2 000 000 ₽
range. They are marked `TODO: подтвердить` in the file and should be walked
through with the studio before this goes live.
