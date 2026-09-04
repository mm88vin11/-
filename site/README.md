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
  build/set-lead.py  points the form at Telegram or your own handler
  build/worker.js    Cloudflare Worker that keeps the bot token off the client
  build/genmap.mjs   regenerates the pre-projected world map
  build/mapdata.json the map paths that genmap.mjs produced
```

## Before publishing — where the leads go

**Until this is set, the form only stores the lead in the visitor's browser
and offers to forward it to Telegram by hand.** One command does the whole
setup; it writes `baza.local.html`, and that configured file is the one you
publish (it is gitignored — a live token must not reach a public repo).

```bash
# Telegram, no backend. Open the bot in Telegram and send it any message
# first, then run this — it finds the chat id itself and sends a test message.
python3 build/set-lead.py --token 1234567890:AA…

# Your own handler (CRM, Make, n8n, the worker below). Nothing on the client.
python3 build/set-lead.py --endpoint https://relay.example.workers.dev

python3 build/set-lead.py --check    # what is the current file pointed at?
```

Rotating a token is the same command again. `--chat` overrides the discovered
chat id, `--user` changes the account behind the "just write to us" buttons.

### About hiding the token

`set-lead.py` does not write the token into the page as a string — it stores
it XOR'd, so a scanner grepping pages for `<digits>:AA…` finds nothing. That
is the whole benefit, and it is worth having: those scanners are the thing
that actually steals client-side bot tokens. It does **not** hide anything
from a person who opens the console.

If that matters, deploy **`build/worker.js`** — a Cloudflare Worker that holds
the token as a secret and relays the lead. Deployment steps are in the file's
header; it takes about three minutes on the free plan. Then:

```bash
python3 build/set-lead.py --endpoint https://<name>.workers.dev
```

and the token is off the client entirely. After that, rotating it means
changing one secret in the Cloudflare dashboard — the published page does not
change and does not need rebuilding.

Whichever route: use a bot that exists only for this, and never give it admin
rights anywhere. `/revoke` in @BotFather invalidates a leaked token instantly.

Leads are written to `localStorage` **before** the network call and removed
only after a confirmed delivery. Anything undelivered is retried on the
visitor's next visit, so a dead webhook loses nothing.

Analytics sits next to it in `component.dc.html`:

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
python3 build/bundle.py                  # baza.html in place
node build/genmap.mjs                    # only when the city list changes
```

`genmap.mjs` needs `d3-geo` and `topojson-client` plus `world-atlas`
`countries-110m.json`. It projects the countries with Natural Earth 1 and
writes plain SVG paths, which is why the page ships no map libraries.

## What the page does not need

No CDN, no external fonts, no analytics until consent, no network at all after
the HTML lands. It runs from `file://`, from a bucket, from anywhere.
