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
| Animation loops | 10 `requestAnimationFrame` call sites. Two are the shared clock; the other eight are private: the loader's pour, the leak counter, the coin's parabola, the tetromino drop, the price tween, and three "run once after layout" deferrals |

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
10. **The reel primes a cushion, not a window.** It used to decode thirty
    frames as fast as its lanes allowed the moment it mounted — while nobody
    was scrolling and nothing beyond frame 0 was on screen. It now primes what
    the first screen needs plus enough to absorb a flick, and earns the rest of
    its lookahead once the scrub actually moves, by which point the decodes are
    spread across the scroll instead of stacked against the load.

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

**Quality is a ladder, and the ladder reaches the worlds.** Tier from cores,
memory, WebGL2 and a 200 ms shader benchmark at boot. A short first window then
asks whether that guess was wrong and a long one asks whether anything has
changed since; a step down needs both a mean over 22 ms and most of the frames
in the window over it, so a single chunk-parse cannot fake one, and a mean far
enough past budget skips a rung rather than making the device earn the second
one over another second of jank. Low tier means no WebGL at all, and all eleven
seams collapse into one 250 ms crossfade that was written before the seams were.

The part that took measuring to find: a tier change has to reach canvases that
already exist. Backing stores are allocated in resize handlers and nowhere
else, which is the right rule right up until the tier changes under a mounted
world — so a tier change now schedules `clock.refit()`, shader layers take
their DPR as a function rather than a number, and the three.js renderers
re-read the pixel ratio when they resize. Without that the downgrade changed
every setting and none of the cost.

**Copy is data.** Every sentence is in `src/data/content.ts`. The price stayed
a range.

**The rules are executable, not advisory.** `scripts/perf-guard.mjs` is the
half of the performance contract a machine can check — one rAF, the world
contract, GPU disposal, transform/opacity-only in scroll-linked animation, no
layout reads inside a tick, the named z-scale, the deduplicated font budget, no
base64, a declared box on every image, built weight — and it currently reports
0 failures and 0 warnings. The half a machine cannot check is written down for
the next person instead: `.claude/skills/perf-guard/` (the contract) and
`.claude/skills/world-spec/` (the design system), plus three agents in
`.claude/agents/` — `perf-auditor` measures against the budgets and is
forbidden to report impressions, `visual-qa` looks at every width and samples
pixels rather than trusting a thumbnail, `world-builder` builds a section to
the world contract. Each of them encodes a specific defect from this rebuild's
history, so they are worth reading even by someone who never invokes them.

---

## 5 · What measuring found that reading did not

These are in the report because they are the argument for measuring at all.
Every one of them survived writing the code, reading it back, and looking at
the page.

**From the trace**

1. **The hero reel decoded on the main thread.** 56 long tasks of 110–153 ms
   and 25 fps on mobile, all of it WebP decode. Frames now go through
   `createImageBitmap`, which decodes off-thread, inside a window that
   `close()`s the bitmaps it passes — 91 frames of 1216×684 is otherwise about
   300 MB of decoded pixels against a 180 MB budget for the whole page. Long
   tasks after the fix: none.
2. **Worlds randomly never mounted.** Two IntersectionObservers fire in the
   same batch — one to preload a chunk, one to mount it. The preloader set a
   `loading` boolean; the mounter saw it, awaited a promise that resolved
   before the import did, found no world, and gave up. Symptom: the hero was
   blank about one load in three. `load()` now returns the in-flight promise.

**From sampling pixels out of screenshots**

3. **Every seam painted flat white.** The seam canvas asked for premultiplied
   alpha; the shaders emit straight alpha. At a glance the frame looked
   "washed out"; the pixels were 255,255,255.
4. **The wrong seam, in the wrong place.** `content-visibility: auto` means a
   section that has never been on screen reports its `contain-intrinsic-size`
   placeholder, so every offset below it moves the moment it renders.
   Boundaries measured once at boot were wrong by hundreds of pixels and the
   engine painted the portal→brief white-out over the middle of the site.
   Section geometry now lives in `core/layout.ts` behind a ResizeObserver, and
   the engine picks the *nearest* boundary rather than the first in document
   order.
5. **A downgraded device got a white sheet over everything.** On a runtime
   downgrade the seam engine released its WebGL context and asked the same
   canvas for a 2D one — which returns null, because a canvas only ever has one
   context type, and a released context leaves the canvas white. The fallback
   crossfade is now its own element.
6. **The hero reel was invisible.** `#heroC` is gated on `body.reel-ready` and
   nothing had set that class since the rewrite. The poster carried the first
   screen, so it looked right and the scrub did nothing.

**From the screenshot sweep**

7. **The pricing block slid over its own list on phones.** `position: sticky`
   in a one-column grid: the well and the running total drew straight through
   the transparent scope rows.
8. **The primary button in the brief was black on black.** `.btn` set its text
   to `--c-ink` while its background was `--w-acc`; in the light world both are
   near-black. Accents now carry a `--w-on-acc` foreground.
9. **`[hidden]` was losing to `display: grid`.** "Отложено 0" and the game-over
   line were on screen before either had anything to say.
10. **The credits crawl had no runway.** The footer's static position is one
    viewport into a three-viewport section, so it rode up over the pinned
    stage; and `perspective: 340px` crushed the copy into an unreadable stamp.

**From the accessibility pass**

11. **The inherited viewport locked zoom.** `user-scalable=no, maximum-scale=1`
    is a WCAG 1.4.4 failure, and it was never what fixed the "page twitches
    under a finger" complaint — that was `touch-action: manipulation` and not
    measuring in `vh`, both of which stay. Multi-touch is now cancelled only
    over the game surfaces.
12. **Thirteen canvases were in the accessibility tree**, and an `aria-label`
    sat on a plain `<div>`, which is prohibited. Contrast failures went from 46
    to 5 to 0 across two passes.
13. **The contrast checker was itself wrong.** It resolved the background
    behind an element's *parent*, so every filled button read as
    cream-on-cream — which is exactly the shape of the black-on-black bug it
    would then have hidden. It now starts at the element, and lists nodes
    sitting on a gradient separately instead of guessing at them.

**From reading the harness instead of its output**

14. **"Frames over 50 ms: 0" was an artefact of the clock.** The ticker clamps
    its delta to 50 ms so a tab returning from the background cannot teleport
    every particle across the screen in one step — and the frame accounting was
    reading that clamped value. Every stall, however long, was recorded as one
    50 ms frame. So the worst-frame column was a description of the clamp, the
    over-50 counter could not go above zero by construction, and the one budget
    in the brief that counts 50 ms frames was unfalsifiable. The clock now
    carries the real interval alongside the clamped one; animation uses the
    clamp, the counters and the degradation ladder use the truth. The number
    that had been "0 by definition" is 2 for a whole desktop page.
15. **Every performance run was forcing a quality tier the site would never
    choose.** The harness loaded `?tier=high` so the full picture would be on
    screen — which meant the headline figures came from a configuration the
    page's own detection rejects on this hardware, with the ladder fighting it
    the whole way. That is where the ugly numbers came from: 20 fps in `#pain`,
    78 long tasks, one of them 2451 ms. Profiling that run puts 2572 ms of a
    6.5-second window in V8's `(program)` bucket — native time, no JavaScript
    frame — which on a GPU-less container means SwiftShader rasterising three
    full-screen fragment shaders at 1440×900. Not a regression: the cost of
    refusing to degrade. The runs the report quotes now pass no `?tier=` at
    all, and the forced-high run is kept as a separate, labelled ceiling.
16. **The whole of the blocking time was the opening, and the opening was
    ignoring the ladder.** The cold-load pass showed 57 long tasks between
    1.5 s and 6.1 s on a page standing still with nothing but the hero live.
    Resetting the counters and watching the same page for the next five
    seconds: 60.0 fps, worst frame 19 ms, no long tasks at all. So it was not
    the site — it was the preloader, which opens optimistically because it runs
    before anything is known about the device, and then kept a full-screen
    two-octave noise field alive long after the ladder had decided the machine
    could not hold it. It drops the field at `low` now; the radial gradient
    behind the canvas was already there so nothing flashes before the shader
    compiles, so this costs a texture rather than a picture.
17. **The ladder measured its first window in frames, which is backwards.** The
    slower the device, the longer it took to notice it was slow — at 4.4 fps,
    twenty frames is four and a half seconds of running at full strength on a
    machine that had already proved it could not. The first window now closes
    on whichever comes first, twenty frames or 400 ms, with a floor of four
    frames so one chunk-parse frame cannot spend a tier on its own. And because
    deciding on four frames is unfair to a fast machine whose *startup* was
    slow, a tier taken away by that early call is remembered and handed back if
    a later full window comes back comfortably fast — once, and only for that
    call. Cold load, same machine: hero long tasks 57 → 9, their total 4269 ms
    → 660 ms, frame rate through the opening 25.2 → 49.0 fps.
18. **The LCP image was fetched twice, in two formats.** The `<link
    rel="preload">` named the WebP; the `<picture>` beneath it resolves to
    AVIF on anything built this decade. So 44 KB went down the critical path
    where 22 KB was needed, and the copy carrying `fetchpriority="high"` was
    the one the browser then discarded. The preloads name AVIF now and carry a
    `type`, which is what lets a browser without AVIF skip them and take the
    WebP from the `<picture>`. First screen 170 KB → 148 KB.
19. **"First screen: 483 KB" was the harness measuring four seconds.** It
    filtered resources by `getEntriesByName('largest-contentful-paint')`, which
    returns nothing — LCP entries are delivered to observers and never retained
    in the entry buffer — so the `?? 4000` fallback took over and counted
    eleven reel frames, every font on the site and matter.js as part of the
    first screen. Against the page's own observed LCP the figure is 148 KB, and
    §7 now lists the resources it is made of rather than asking to be believed.

## 5b · Two ideas that measured worse than doing nothing

Recorded so nobody spends an afternoon rediscovering them.

* **Capping the hero canvas at the reel's own width.** The landscape cut is
  1216px; on a 1440px viewport the canvas rasterises 1440. Painting more pixels
  than the source contains is obviously waste — and capping it was **25%
  slower** (30.7 fps against 41.5), because the compositor then scales the
  layer up on every frame.
* **Rendering shader layers below 1×.** Same lesson from the other end: a
  full-screen fragment shader is priced in samples, so 0.7× should be cheaper.
  It is not, for the same reason. `quality.shaderDpr()` therefore floors at 1
  and only ever caps the top.

## 6 · Measurements

See the next section for the numbers, and read this paragraph before quoting
them.

**This container has no GPU.** Chromium runs SwiftShader, so every WebGL call
and every full-screen canvas blit is rasterised on the CPU, and the mobile
profile then throttles that by another 4×. It is a harsh test to pass and a
dishonest number to present as a phone. Treat the absolute figures as a floor,
not a forecast — particularly for the two sections that paint a full screen of
pixels per frame, which is the one operation a GPU does for nothing.

**Nothing below asks for a quality tier.** The page decides for itself, as it
would for a visitor: it detects `mid` from four cores, and the runtime ladder
steps it down to `low` within the first sixty frames because this machine's
frames come back too slow. That decision *is* the product — "пользователь не
должен видеть лаги, он должен видеть чуть более простую картинку" — so
measuring around it would have been measuring a site nobody visits. The forced
`high` run is reported separately, as the ceiling the mechanism exists to
avoid.

**The comparison, though, is fair.** The old build was measured on this same
machine, in this same browser, with the same 25-second scroll and the same
throttling (`qa/legacy.mjs` serves the original 13.5 MB file and instruments it
with the same observers). Both halves of the before/after table were handicapped
identically, so the deltas mean what they say even where the absolutes do not.
