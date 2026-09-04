# БАЗА — landing page

The single-file site for the БАЗА studio, reworked against the sales audit
(`Законы продаж`). Everything ships in one HTML file: markup, logic, fonts,
the scroll-driven laptop sequence and the world map.

```
site/
  baza.html          the deliverable — open it, host it, send it
  component.dc.html  the source: dc-runtime template + Component logic
  og.jpg             1200×630 link preview, upload to <site>/og.jpg
  build/bundle.py    re-packs component.dc.html into baza.html
  build/genmap.mjs   regenerates the pre-projected world map
  build/mapdata.json the map paths that genmap.mjs produced
```

## Before publishing — three fields to fill in

Open `component.dc.html` and find `LEAD` near the top of `class Component`.
**Until one of these is set, the form only stores the lead in the visitor's
browser and offers to forward it to Telegram by hand.**

```js
LEAD = { endpoint: '', tgToken: '', tgChat: '', tgUser: 'lllbaza' };
```

| Field | What it does |
| --- | --- |
| `endpoint` | Your own handler (CRM, Make, n8n, a serverless function). Receives `POST application/json` with the object `leadPayload()` builds. Tried first. |
| `tgToken` + `tgChat` | Direct Telegram Bot API send, for when there is no backend at all. Tried if `endpoint` is missing or fails. |
| `tgUser` | The account behind the "just write to us" buttons. |

The Telegram token is readable by anyone who opens the page source. Use a bot
that can only post into one chat, and never give it admin rights anywhere.

Leads are written to `localStorage` **before** the network call and removed only
after a confirmed delivery. Anything undelivered is retried on the visitor's
next visit, so a dead webhook loses nothing.

Analytics sits next to it:

```js
ANALYTICS = { ym: 0, ga: '' };   // Yandex.Metrika counter id / GA4 id
```

Counters load only after the visitor accepts cookies, on idle. Goals fire on
their own: `quiz_started`, `quiz_pick`, `quiz_completed`, `pricing_viewed`,
`tier_clicked`, `entry_clicked`, `form_step1`, `form_step2`, `form_sent`,
`form_delivered`, `form_undelivered`, `tg_click`, `cookie_consent`. With no
counter configured they still accumulate in `window.__lb.trail`.

## Other things to fill in

* **Prices.** `TIERS` holds four tiers. The numbers are placeholders from the
  audit — replace them, but keep the shape: the top tier exists to make the
  working one look reasonable, and the recommendation below the grid must stay
  a single suggestion with a reason, not a "pick a plan".
* **Case screenshots.** Each feed card carries an `<image-slot>`. Drag a real
  screenshot onto it in a browser and it sticks (a `.image-slots.state.json`
  sidecar next to the HTML). `FEEDD[].was` / `.now` are the before → after
  lines shown on the card — confirm them with the clients before publishing.
* **Reviews.** `RV[]` has empty `co` and `url` fields. Fill them with the
  company name and a link and the review becomes checkable; leave them empty
  and only the name and role render.
* **Domain.** `SITE` in `build/bundle.py` sets `canonical`, `og:url` and the
  JSON-LD ids. Change it, re-run the build, and upload `og.jpg` to
  `<site>/og.jpg` so link previews resolve.

## Rebuilding

`bundle.py` takes the original packed bundle as its input (assets live in its
manifest), re-packs `component.dc.html` into it, converts the logo PNGs to
lossless WebP, patches the loader and injects the static `<head>`.

```bash
python3 build/bundle.py baza.html        # SRC at the top of the file
node build/genmap.mjs                    # only when the city list changes
```

`genmap.mjs` needs `d3-geo` and `topojson-client` plus `world-atlas`
`countries-110m.json`. It projects the countries with Natural Earth 1 and
writes plain SVG paths, which is why the page ships no map libraries.

## What the page does not need

No CDN, no external fonts, no analytics until consent, no network at all after
the HTML lands. It runs from `file://`, from a bucket, from anywhere.
