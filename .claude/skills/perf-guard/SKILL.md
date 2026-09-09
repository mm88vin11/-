---
name: perf-guard
description: The performance contract for the БАЗА site in site/ — hard budgets, render architecture rules, and the degradation ladder. Use before writing or reviewing any animation, canvas, WebGL or scroll code in this repo, and before every commit that touches site/src. Triggers - adding a world or effect, touching the ticker or scroll, changing assets or fonts, "is this fast enough", "why is it janky", reviewing a diff under site/.
---

# perf-guard

The previous build of this site failed on performance, not on ideas. Every rule
below exists because something specific broke. Beauty that stutters is not
beauty, it is a defect: **if the choice is between an effect and 60 fps, take
the 60 fps and find a cheaper way to get the same effect.**

Run `npm run guard` in `site/` before every commit. It checks the mechanical
half of this document and exits non-zero on a breach.

## 1 · Budgets

These are thresholds, not aspirations. A change that crosses one does not land.

| Metric | Threshold | How it is measured |
| --- | --- | --- |
| LCP (mobile, Fast 4G, CPU ×4) | ≤ 2.0 s | `npm run qa`, cold-load pass |
| INP | ≤ 150 ms | same |
| CLS | ≤ 0.02 | same |
| First-screen weight | ≤ 350 KB | resources finished before LCP |
| Total after every lazy load | ≤ 3.5 MB | one reel cut, not both |
| Desktop scroll FPS | ≥ 58 average, **0 frames > 33 ms** | scroll pass, per section |
| Mobile scroll FPS | ≥ 55 average, ≤ 3 frames > 50 ms per page | scroll pass |
| Long tasks after load | none > 120 ms | PerformanceObserver, per section |
| Fonts | ≤ 220 KB, ≤ 5 families | guard |
| Live worlds at any scroll position | ≤ 3 | scroll pass, `liveWorlds` |

Report numbers or do not report. "It feels smoother" is not a measurement.

## 2 · Render architecture

**One clock.** Exactly one animation loop exists: `gsap.ticker`, driven from
`src/core/ticker.ts`. Lenis is advanced from it, ScrollTrigger updates from it,
every canvas world is a job on it. `src/` contains **zero** raw
`requestAnimationFrame` calls — use `clock.add()` for continuous work and
`clock.once()` for "after the next layout". The guard enforces this.

**A world off screen costs nothing.** Every world implements
`mount / unmount / pause / resume`. The director pauses at ±50 vh and unmounts
two sections out. Pausing means the tick stops *and* heavy textures go:
`ShaderLayer.destroy()`, `renderer.forceContextLoss()`, canvas backing stores
sized down to 1×1.

**Transform and opacity only.** Nothing scroll-linked animates width, height,
top, left, margin, box-shadow or `filter: blur()`. Blur is baked into a shader
or pre-rendered as a gradient layer. On coarse pointers a glow is a
`radial-gradient` pseudo-element, never a large `box-shadow` blur.

**No layout thrash.** `getBoundingClientRect`, `offsetTop`, `offsetWidth` and
friends are read in a `resize` callback and cached. Never inside a tick — a
read after a write in the same frame forces a synchronous layout, every frame.
The guard looks for this shape.

**will-change is temporary.** Set it before an animation, clear it after.
Leaving it on forty elements costs the compositor real memory.

**Canvas discipline.** DPR capped at `Math.min(devicePixelRatio, 2)`, 1.5 on
coarse pointers. Resize debounced 150 ms. Full stop on `document.hidden`.

**WebGL discipline.** `powerPreference: 'high-performance'`, `antialias: false`
on mobile, render from the shared ticker and never from a loop of your own.
Geometry and materials are reused; `dispose()` on unmount; instancing for
anything repeated. `precision mediump float` on coarse pointers. No loops with
a variable iteration count and no `pow` on a full-screen quad if a cheaper
function will do.

**Far sections do not paint.** `content-visibility: auto` with
`contain-intrinsic-size`, except on the three sections that are pinned or
measured (`#hero`, `#route`, `#credits`), where it would break the scrub.

**Fonts.** `font-display: swap`, Cyrillic + Latin subsets only, two faces
preloaded, everything else on demand. Never nine weights.

## 3 · Degradation is part of the feature

`src/core/quality.ts` decides a tier at boot from
`hardwareConcurrency`, `deviceMemory`, WebGL2 support, a 200 ms shader
micro-benchmark, `prefers-reduced-motion` and `saveData`.

| Tier | What changes |
| --- | --- |
| high | everything on, particles 100%, post effects allowed |
| mid | particles 50%, no post, DPR 1.5 |
| low | no WebGL at all — static gradients and CSS, seams become a crossfade |
| reduced-motion | every transition becomes a 200 ms crossfade, games offer their outcome as text, nothing autoplays |

Plus the runtime ladder: sixty consecutive frames averaging over 22 ms drops
the tier a step and logs why. **The visitor may see a simpler picture. They may
not see a stuttering one.**

## 4 · Verification

After any change to `site/src`:

```bash
npm run build && npm run guard && npm run qa
```

`npm run qa` writes `qa/report-<phase>.json` and screenshots of twelve sections
at six widths into `qa/shots/<phase>/`. Compare per-section FPS and long tasks
against the previous phase's report, not against memory.

The container running CI has no GPU, so Chromium falls back to SwiftShader.
Software rasterisation makes WebGL an order of magnitude more expensive than on
real hardware: treat those numbers as a floor, quote them as software-rendered,
and never present them as phone numbers.
