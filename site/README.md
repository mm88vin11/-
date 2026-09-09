# БАЗА — сайт

Production rebuild of `lllbaza.ru`. Vite + TypeScript (strict), one animation
clock, twelve worlds, eleven shader seams.

The previous build was a single 13.5 MB HTML file with 286 WebP frames inlined
as base64. It looked expensive and it stuttered, which is the same thing as
looking cheap. This is the rebuild, and the whole of it is organised around one
rule from the brief:

> Если приходится выбирать между эффектом и 60 fps — выбираешь 60 fps и ищешь,
> как сделать тот же эффект дешевле.

## Running it

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # chunked, hashed, cacheable — the deploy target
npm run preview        # serve dist/ on :4173
npm run guard          # the performance contract, as a program
npm run qa             # measure: traces, per-section FPS, 72 screenshots
npm run build:single   # one HTML file, for when it has to travel as a file
```

`npm run assets` regenerates `public/assets/` from the legacy single-file build
and needs `ASSET_SRC` pointing at the extracted originals. The output is
committed, so this is only needed when the source artwork changes.

## Layout

```
index.html            every line of markup and, with src/data/content.ts, every line of copy
src/core/             ticker · quality · scroll · director · audio-bus · perf-monitor · gl
src/worlds/           one file per universe, each { mount, unmount, pause, resume }
src/transitions/      the seam engine and its eleven fragment shaders
src/ui/               loader · header · tape · toast · store · eggs
src/styles/           tokens → base → ui → loader → worlds
src/data/content.ts   all copy, in one place, so a world file never holds a sentence
public/assets/        reel (two cuts), fonts, stills — real files, no data URIs
qa/                   the measurement rig and its reports
research/notes.md     what was read before building, and what changed because of it
legal/                the IP table: what was referenced, what was replaced
```

## The architecture, in five sentences

**One clock.** `gsap.ticker` is the only animation loop on the page. Lenis is
advanced from it, ScrollTrigger updates from it, every canvas world is a job on
it, and `src/` contains zero raw `requestAnimationFrame` calls — the guard
fails the build if that changes.

**A world off screen costs nothing.** `core/director.ts` fetches a world's chunk
at ±150 vh, mounts it at ±50 vh, pauses it on the way out and unmounts it two
sections later. Pausing releases GPU memory, not just CPU time.

**One scroll read per frame.** The ticker samples `scrollY` once and hands it to
every job. Layout reads happen in resize callbacks and are cached; the guard
looks for the shape of the mistake.

**Quality is a ladder, not a switch.** `core/quality.ts` picks a tier at boot
from cores, memory, WebGL2 and a 200 ms shader benchmark, and drops a step if
sixty consecutive frames average over 22 ms. Low tier means no WebGL at all —
static gradients, CSS, and one crossfade in place of eleven seams.

**Copy is data.** Every sentence lives in `src/data/content.ts` and the rules
about it live in the `world-spec` skill. The price is a range on purpose.

## Budgets

Enforced by `npm run guard` and measured by `npm run qa`. Current numbers and
the environment they came from are in `../REPORT.md`.

| | Budget |
| --- | --- |
| LCP, mobile, CPU ×4, Fast 4G | ≤ 2.0 s |
| CLS | ≤ 0.02 |
| First screen | ≤ 350 KB |
| Everything, after every lazy load | ≤ 3.5 MB |
| Desktop scroll | ≥ 58 fps, 0 frames > 33 ms |
| Mobile scroll | ≥ 55 fps, ≤ 3 frames > 50 ms |
| Fonts | ≤ 220 KB, ≤ 5 families |
| Live worlds at once | ≤ 3 |

## Two things that are deliberately not what the brief asked for

Both are argued in full in `../REPORT.md`; in one line each:

* **Sound is synthesised, not a 400 KB sprite.** Zero bytes, nothing to
  license, and pitch-shifting an oscillator on a transition is exact where
  resampling a sprite is not.
* **Nine display faces became four.** None of Monument Extended, General Sans,
  Editorial New, Chakra Petch, Space Grotesk or Anton ships Cyrillic, and the
  site is entirely in Russian.
