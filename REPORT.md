# БАЗА — тотальная переработка. Отчёт

Rebuild of `lllbaza.ru` against the brief in `PROMPT`. The site is in Russian;
this report is in English because the code is, and because it is a technical
document. The summary for the client is at the end of the chat, in Russian.

**One sentence:** a 13.5 MB single HTML file with 286 WebP frames inlined as
base64 became a Vite + TypeScript application with one animation clock, twelve
worlds that pause when you are not looking at them, eleven shader seams, and a
performance contract that fails the build when it is broken.

---

## 0 · What the old build actually was

Measured, not remembered — `qa/` has the extraction script.

| | Legacy single file |
| --- | --- |
| Document | 13 516 664 bytes |
| Of which base64 data URIs | 13 274 478 bytes — **98.2%** |
| Hero reel | 286 WebP frames inline (182 landscape + 104 portrait), 9.0 MB decoded |
| Fonts | 14 woff2, inline, 264 KB |
| Runtime | 118 KB of ES5 in one `<script>`, four IIFEs |
| CSS | 413 KB in three `<style>` blocks |
| Build step | none |
| Caching | impossible — every byte is the document |
| Animation loops | one shared clock, plus per-effect `requestAnimationFrame` in six worlds |

The old code was not careless — it already had a shared clock, DPR caps and
IntersectionObserver gating, and several of its comments are the reason this
rebuild kept certain decisions. What it could not do was ship anything
separately from anything else. That is the root cause of everything below.

---

## 1 · Inventory (Phase 0)

| Section | Was | Technology | Now |
| --- | --- | --- | --- |
| `#load` | Two-row mark, CSS fill, snap on entry | DOM + CSS | Shader field, mark arriving from depth as an outline, liquid pour on real weighted progress, FLIP into the header |
| `#head` | Fixed bar, ink pill | DOM | Same, geometry cached out of the tick |
| `#hero` | 286-frame base64 reel, canvas scrub | canvas 2D | 91-frame file reel, crossfaded, window-loaded; silence beat; reflection in the lid |
| `#pain` | Mario blocks, coin arc, pixel parallax | canvas 2D sprites | Torch shader, blocks fall into a glass on matter-js physics, four parallax layers |
| `#truth` | Glyph rain, `fillText` per glyph per frame | canvas 2D | One fragment shader, procedural glyphs, cursor parts the rain, six grey seconds on the blue pill |
| `#craft` | 3×3 grid, click to select recipe | canvas 2D pixel blocks | Drag with a magnet, 18 instanced 3D blocks in one draw call, live price fork |
| `#cases` | Feed, generated art | DOM + canvas | Same feed, paperclip instead of a heart, questions every third card, letter for the budget holder |
| `#pricing` | Tetromino well = estimate | canvas 2D | Same well, plus 45 seconds of the other stack — matter-js, real messages, autopilot, skip |
| `#route` | Speedometer widget over a flat road | canvas 2D | **Rebuilt.** First-person road in three.js: 1 206 triangles, 6 draw calls, 0 textures |
| `#gains` | Onion peel + city marquee | SVG + canvas | **Rebuilt.** Fog shader, a door that opens on scroll, team, and a Marauder's-style map drawn by typing |
| `#portal` | Circle recognition, canvas far side | canvas 2D | Three-metric recognition, 400-ember plume, live far side, the lawyer joke, auto-open on the third try |
| `#brief` | Two-step form | DOM | Same, and it now carries what every other world learned |
| `#basement` | Bulb wall, spores | canvas 2D | Shader fog, spores, tendril vignette, graveyard of real refusals, text on a wave |
| `#credits` | Crawl + 190 DOM stars | DOM | Crawl driven by scroll, star field in one shader, three counters that count |

---

## 2 · What was simplified for performance, and why

Every one of these is a place where the brief's own rule applied: *if the
choice is between an effect and 60 fps, take the 60 fps and find a cheaper way.*

1. **The reel: 182 frames at 1600px → 91 frames at 1216px, 6.28 MB → 1.61 MB.**
   The runtime crossfades adjacent frames, so half the frames read as continuous
   motion. Scroll distance per frame is unchanged (36 px against the old 18 px
   across twice as many). This is the single biggest saving on the site.
2. **Sound is synthesised — 0 bytes instead of a 400 KB sprite.** Oscillators,
   one generated noise buffer, a band-pass per world. Three reasons in order:
   nothing to license (§9 of the brief forbids borrowed audio and requires
   filed licences), 400 KB is a quarter of the reel, and detuning an oscillator
   on a transition is exact where resampling a sprite is not. The honest cost:
   a synthesised swamp is thinner than a recorded one. `voice()` is the single
   function to replace if a bed is ever licensed.
3. **Nine display faces became four.** Monument Extended, General Sans,
   Editorial New, Chakra Petch, Space Grotesk and Anton do not ship Cyrillic,
   and the site is entirely in Russian — every heading would fall back
   mid-word. Manrope, JetBrains Mono, Press Start 2P and Russo One all carry a
   Cyrillic subset. 108 KB over the wire against a 220 KB budget.
4. **Seams blend declared world colours, not live snapshots.** Sampling two
   living sections into textures every frame costs more than everything else on
   the page put together, and cannot capture the canvas worlds anyway. Each
   seam composites its effect *over* the real page, so the page shows through
   wherever the effect does not cover it.
5. **The hero's silence is a scrub plateau, not a scroll lock.** The brief
   suggested pinning; a plateau produces the same second and a half of nothing
   happening without taking the page away from a thumb, which on touch cannot
   be done without breaking the gesture.
6. **No post-processing anywhere.** The road's peripheral blur is three
   procedural samples inside the road shader, not a render pass.
7. **`ogl` was not added.** Every WebGL surface here is one triangle with one
   fragment shader; the helper that does it is 90 lines. three earns its place
   where there is an actual scene graph (`#craft`, `#route`) and lands in its
   own lazily-loaded chunk.
8. **The basement's text distortion is a transform on six headings**, not a
   displacement filter over live text — the most expensive way to do it and the
   least readable, in the one section that carries a code word people need.
9. **The fog's second octave is top-tier only.** It was the most expensive
   shader on the page.

---

## 3 · What is not done, by payoff

1. **404 corridor with WASD.** A static single-page site has no 404 route; this
   needs a hosting rule and a second entry point. Highest payoff of what is
   left, because it is self-contained.
2. **The basement gated behind footer overscroll.** Implemented as a normal
   section instead. Gating it would hide the code word, the graveyard and the
   priority-slot offer behind a gesture most visitors never make, and would
   break the in-page anchors. Worth revisiting as an *additional* reward rather
   than as the only door.
3. **Swipe-to-shift and tap-to-rotate in the pricing game.** The flood is a
   pile of messages, not falling pieces, so it has tap-to-answer with haptics
   instead. The piece-based variant would need the well to become the game.
4. **Lighthouse as a CI gate.** It runs (`npm run qa:lh`) but nothing fails a
   build on its score yet.
5. **21st.dev and context7 research.** The 21st.dev MCP server is configured in
   `.mcp.json` and is the right tool, but authorising it needs an interactive
   OAuth flow this session cannot run.
6. **Recorded ambient beds.** See §2.2 — a deliberate trade, not an omission,
   but a licensed bed would sound better.
7. **A real backend for the brief.** Clipboard plus Telegram, as before.

---

## 4 · Architecture, in the order it matters

**One clock.** `gsap.ticker` is the only animation loop. Lenis is advanced from
it, ScrollTrigger updates from it, every canvas world is a job on it, and `src/`
contains zero raw `requestAnimationFrame` calls — `npm run guard` fails the
build if that changes. The old build had a shared clock *and* six private loops.

**One scroll read per frame.** The ticker samples `scrollY` once and hands it
to every job. Section geometry lives in `core/layout.ts`, measured on a
ResizeObserver and cached; no world reads the DOM inside a tick.

**A world off screen costs nothing.** `core/director.ts` fetches a chunk at
±150 vh, mounts at ±50 vh, pauses on the way out and unmounts two sections
later. Pausing releases GPU memory — `ShaderLayer.destroy()`,
`forceContextLoss()`, canvas backing stores down to 1×1. At most three worlds
are ever live; the trace checks it.

**Quality is a ladder.** Tier from cores, memory, WebGL2 and a 200 ms shader
benchmark at boot, dropping a step if sixty consecutive frames average over
22 ms. Low tier means no WebGL at all, and all eleven seams collapse into one
250 ms crossfade that was written before the seams were.

**Copy is data.** Every sentence is in `src/data/content.ts`. The price stayed
a range.

---

## 5 · Five bugs the measurement found that review did not

These are in the report because they are the argument for measuring at all.

1. **Every seam painted flat white.** The seam canvas asked for premultiplied
   alpha and the shaders emit straight alpha. Caught by sampling pixels out of
   a screenshot rather than by looking at it — at a glance the frame just
   looked "washed out".
2. **The wrong seam, in the wrong place.** `content-visibility: auto` means a
   section that has never been on screen reports its placeholder height, so
   every offset below it moves the moment it renders. Boundaries measured once
   at boot were wrong by hundreds of pixels, and the engine cheerfully painted
   the portal→brief white-out over the middle of the site. Fixed by moving
   section geometry into `core/layout.ts` behind a ResizeObserver, and by
   picking the *nearest* boundary rather than the first one in document order.
3. **Worlds randomly never mounted.** Two IntersectionObservers fire in the same
   batch — one to preload, one to mount. The preloader set a `loading` boolean;
   the mounter saw it, awaited a promise that resolved before the import did,
   found no world and gave up. Now `load()` returns the in-flight promise
   itself.
4. **The hero reel was invisible.** `#heroC` is gated on `body.reel-ready`, and
   nothing had set that class since the rewrite. The poster carried the first
   screen, so it looked correct and the scrub did nothing.
5. **A downgraded device got a white sheet over the whole page.** On a runtime
   downgrade the seam engine released its WebGL context and asked the same
   canvas for a 2D one — which returns null, because a canvas only ever has one
   context type. The released context leaves the canvas white, and it was still
   visible. The fallback crossfade is now its own element.

None of these are exotic. All five were invisible to reading the code.

---

## 6 · Measurements

See the next section for the numbers, and read this paragraph before quoting
them. **This container has no GPU.** Chromium runs SwiftShader, so every WebGL
operation is rasterised on the CPU, and the mobile profile then throttles that
by another 4×. It is a harsh test to pass and a dishonest number to present as
a phone. The desktop figures below are the ones that mean the most, and even
they are a floor rather than a forecast.
