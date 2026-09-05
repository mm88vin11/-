# lllbaza.ru — audit and redesign pass

Source of truth for the page is `site/index.html` — the same `<x-dc>` template that
the builder exports, with the original asset UUIDs left intact so it can be pasted
straight back. Everything below was verified in a headless Chromium at 1440×900,
820×1180 and 390×844.

The reference for every content decision is the 133-law sales codex supplied with the
brief; law numbers below point at it.

---

## 1. What was broken

### Chrome collisions

| # | Finding | Evidence |
| --- | --- | --- |
| 1.1 | The floating header pods sat on transparent background. Page content scrolled through the gaps between them, so headings and chips were readable *behind* the navigation. | Every screenshot past the hero |
| 1.2 | The bottom metrics ticker faded its marquee straight into its own static label — the two collided and read as a rendering fault. | `metricsMaskStyle` faded over 64px starting at the label's right edge |
| 1.3 | Anchor jumps and manual scrolling landed sections under the fixed header; the brief form lost its step bar entirely. | No `scroll-margin-top` anywhere |

### Scroll and rhythm

| # | Finding |
| --- | --- |
| 1.4 | A full black screen of dead scroll between the end of the laptop sequence and the first headline. 540vh of stage for 96 frames, with the last ~120vh spent fading to black. |
| 1.5 | Several sections used only the left half of the viewport; the right half was empty for a full screen at a time (diagnostic quiz, route timeline). |

### Content holes

| # | Finding |
| --- | --- |
| 1.6 | Every case in the work feed rendered an empty `<image-slot>` drop target — a grey dashed tile with a placeholder caption. The single most visible defect on the page. |
| 1.7 | The quiz verdict card was ~70% empty until all four boxes were ticked, and on mobile it rendered *above* the questions it was summarising. |
| 1.8 | The world map was drawn at 5.5% fill / 16% stroke on near-black — effectively invisible, occupying a whole screen. |

### Mobile

| # | Finding |
| --- | --- |
| 1.9 | The "пропустить" pill overlapped the service filter chips. |
| 1.10 | The header CTA collapsed from "Показать, где теряете" to a bare "Показать" — the promise was gone, the button said nothing. |
| 1.11 | The feed's dot pager sat flush against the left edge, overlapping the card caption. |

### The Telegram lead

| # | Finding |
| --- | --- |
| 1.12 | One flat `Ключ: значение` list, plain text, no priority signal, no structure. Reading it meant reading all of it. The raw ISO timestamp and full user-agent were in the body. |

---

## 2. What was changed

### Chrome

- **Top scrim** (`topScrimStyle`, `scrimRef`) — a gradient shade under the header pods,
  driven from the existing header rAF loop by scroll depth, not by a state flip. Content
  never collides with navigation again.
- **Ticker separation** — a hairline divider between the label and the marquee, and the
  left fade widened from 64px to 96px.
- **`scroll-margin-top`** on every `section[id]`, so anchors and manual scrolling land
  below the header.

### Scroll

- Stage cut from **540vh → 460vh**, the closing beat tightened (`P_SHUT` 0.96 → 0.93,
  hero fade-out moved up), and the content pulled up from −52vh to −62vh. The dead
  screen is gone; the page lost ~660px of nothing without losing a frame of the sequence.
- Section gap tightened from `clamp(112px, 15vh, 208px)` to `clamp(94px, 12vh, 168px)`.

### Diagnostic quiz (Laws 45, 48, 71, 84)

- Mobile order fixed: questions first, verdict after. Law 30/33 — he formulates the
  problem before he's told anything.
- New **«во что это обходится»** block. Each ticked box gets one consequence line,
  written as a scene rather than a diagnosis (Law 48), staggered in. No invented
  numbers — the codex is explicit that fabricated loss figures read as fraud (Laws 11,
  43, 49); the honest figure is what the paid разбор produces.

### Case feed

- Each card gets a designed backplate behind the slot: per-case gradient, rotated grid,
  outlined index numeral, ghosted service name. The empty drop-target chrome is now
  hidden until hover — a visitor sees a finished card, and the client can still drag a
  real screenshot in (it paints over the plate).
- The dot pager moved off the edge and onto a blurred track; hidden entirely on mobile,
  where swiping is the interaction.

### Pricing (Laws 50–55, 78)

- New **scale rail** above the cards: 25 000 ₽ → от 2 500 000 ₽ with the recommended
  point marked. The visitor sees the range before the first number, so he stops
  comparing against his card balance (Law 50) — and the recommendation still narrows it
  to one (Law 78). The existing per-situation recommendation copy was already correct
  and was left alone.
- New **«Переслать это руководству»** — copies a one-pager to the clipboard: what he
  ticked, what's recommended, what he gets, why this one, and the fact the разбор goes
  against the project. This is Laws 117–121, the only chapter the page did not cover:
  in a company the decision is defended by someone who is not in this conversation, and
  the less work you leave that person, the better your odds.

### Route timeline (Law 37)

- Each of the three rows gained a right-hand deliverable card — *what he physically has
  in hand* after that stage, not what we do inside it. The empty half-screen is now the
  strongest argument in the block.

### Map

- Fill 0.055 → 0.10, stroke 0.16 → 0.28; served countries 0.17 → 0.30 fill, 0.42 → 0.62
  stroke. Cities, arcs and continents are legible now.

### Brief form

- Four numbered group markers (1–4) that flip to a check as each group is answered —
  the four blocks are now distinguishable and progress is visible.
- A fourth row in the left column: **когда ответим** — «в течение рабочего дня»,
  which is what the site already promises in its legal footer. Law 15: the cheapest
  lever is not price, it is reducing the fear of change.
- Group hints drop to their own line on narrow instead of wrapping into the heading.
- Mobile: the chips row now reserves enough width to clear the "пропустить" pill;
  the header CTA reads «Где теряю» instead of a truncated «Показать».

### Telegram lead

Rebuilt as an HTML message with a scored header, blocked layout and a plain-text
fallback if Telegram rejects the markup.

```
🔥 ГОРЯЧАЯ ЗАЯВКА  ·  46JK
➖➖➖➖➖➖➖➖➖➖
👤 Иван
📞 +7 900 123-45-67          ← <code>, one tap to copy
💬 Отвечать: Telegram

🎯 ЗАДАЧА
Сайт · Автоматизация
Лендинг, CRM

⏱ Сроки: Уже горит
💰 Бюджет: 250–900 тыс ₽

🩹 ЧТО БОЛИТ
• Всё держится на мне
• Теряем заявки и клиентов

✅ ОТМЕТИЛ НА САЙТЕ — 3 из 4
• Заявки теряются
• Сайт стыдно показать
• Всё держится на владельце

🧭 Сайт рекомендовал: Экспресс-разбор — 25 000 ₽
➖➖➖➖➖➖➖➖➖➖
📍 yandex / cpc / brand  ·  🕓 05.09.2026, 10:14
```

- **Priority score** from what the person said himself — deadline, budget, count of
  pains and of ticked symptoms — rendered as 🔥 / ⚡ / 🌱. No guessing.
- **Contact first**, because that is what you act on.
- **`Сайт рекомендовал: …`** carries the page's own recommendation into the chat, so
  whoever answers opens the conversation with one recommendation instead of a menu
  (Laws 74–78).
- Short reference code per lead, human date, source collapsed to one line. The
  user-agent stays in the payload for the endpoint but is out of the message body.
- All interpolated values are HTML-escaped.

---

## 3. What was deliberately left alone

- **The recommendation copy in `recoCopy()`.** It already does exactly what Law 78
  prescribes — shows the scale, recommends one, justifies it from *his* situation
  rather than from the product's feature list. Rewriting it would have made it worse.
- **The price ladder itself.** 25k → 250k → 900k → 2.5M spans 100×, which Law 61 warns
  against for a *вилка* — but these are four different products on a ladder, not one
  price quoted as a range, so the warning does not apply.
- **The fourth benefit card being cream while the other three are dark.** Checked; it
  is a deliberate accent (`goal('d', true)`), not a bug.
- **No artificial urgency was added.** Law 70 gives three positions on deadlines and
  recommends the third: build real constraints rather than draw fake ones. The page has
  no real constraint to state, and a painted timer works once per person and costs the
  reputation permanently. The pressure on the page comes from the cost-of-delay block,
  which is about him, not about our Friday (Law 71).
- **No invented numbers anywhere.** Where a figure would have been persuasive, the page
  says what it costs instead and offers to count it in the разбор.

---

## 4. Verification

| Breakpoint | Page height | JS errors |
| --- | --- | --- |
| 1440×900 | 12 828px (was 13 486px) | none |
| 820×1180 | 14 763px | none |
| 390×844 | 15 021px | none |

Full-page scroll at each width, plus interaction runs over the quiz (tick/untick),
the brief (fill step 1 → advance → step 2 recap), the case feed and the pricing
recommendation. The two 404s in the local preview (`assets/logo*.png`,
`.image-slots.state.json`) are preview-path artifacts of unbundling and do not exist
on the deployed page.
