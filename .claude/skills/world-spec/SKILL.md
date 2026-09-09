---
name: world-spec
description: The design system and world-by-world specification for the БАЗА site in site/ — token architecture, the type-per-world mapping, the seam catalogue, the visual-defect checklist, and the copy rules that must not be broken. Use when building or changing any section, styling anything, adding a transition, or writing user-facing text in this repo. Triggers - new world, restyling a section, adding a seam, "which font", "which colour", "why does this shadow look cut off", writing or editing site copy.
---

# world-spec

Twelve worlds, one system. A world may reach for a token or its own five
surface variables and nothing else — a literal colour or duration inside a
world file is a bug.

## 1 · Token architecture

Three layers, in `src/styles/tokens.css`, in this order:

1. **Primitives** — raw values. `--c-ink`, `--c-gold`, the type scale as
   `clamp()`, the spacing ladder in steps of 4, radii, `--d-fast|base|slow`
   (180 / 420 / 900 ms), `--e-out: cubic-bezier(.16,1,.3,1)` and siblings, and
   the named stacking scale.
2. **Semantics** — what a primitive is *for*: `--bg`, `--fg`, `--dim`,
   `--line`, `--acc`, the shadow recipe, the font stacks.
3. **Per-world surfaces** — every `.uni` sets exactly five: `--w-bg`,
   `--w-fg`, `--w-dim`, `--w-line`, `--w-acc`. The same two colours per world
   are declared once more in `LOOKS` in `src/core/world.ts`, where the seam
   shaders read them.

**The z-scale is closed.** `--z-world: 1`, `--z-seam: 20`, `--z-ui: 50`,
`--z-menu: 90`, `--z-head: 100`, `--z-overlay: 500`, `--z-load: 999`,
`--z-skip: 1000`. No `z-index: 9999`, no arithmetic on the scale. The guard
fails the build on anything else.

## 2 · Type, per world

Four families, not nine. The brief named Monument Extended, General Sans,
Editorial New, Chakra Petch, Space Grotesk and Anton; **none of them ships
Cyrillic**, and this site is entirely in Russian, so every heading would fall
back mid-word. The four below all carry a Cyrillic subset and come to 185 KB.
The worlds are separated by weight, tracking and case instead of by family
count.

| World | Face | Treatment |
| --- | --- | --- |
| hero, gains, brief | Manrope 800 / 500 | display weight, tight tracking, generous measure |
| pain | Press Start 2P (HUD only) + Manrope | pixel type is for the HUD; body copy stays readable |
| truth | JetBrains Mono | monospace body, sans headings — a terminal that can still be read |
| craft | Russo One + Manrope | condensed, engineering label feel |
| cases | Manrope | deliberately the system-UI register: it is part of the credibility |
| pricing, route | Russo One | wide display, tabular numerals mandatory |
| portal, basement | Manrope + JetBrains Mono | thin caps for atmosphere, mono for counters |
| credits | Russo One + Manrope | classic crawl |

Budget: **≤ 220 KB after subsetting, ≤ 5 families.** `npm run guard` checks it.

## 3 · The seam catalogue

Eleven boundaries, one shader each, in `src/transitions/shaders.ts`. A seam is
live only inside 60 vh either side of the join — 1.2 screens of scroll in
total — so nobody has to hunt for it and a fast scroll never shows mush.

| Boundary | Move |
| --- | --- |
| hero → pain | fall down the pipe: circular mask collapsing, chromatic rim, radial drag |
| pain → truth | column disintegration into glyph rain, each column on its own clock |
| truth → craft | voxelisation: cells grow 1 → 26 px, then stack into the bench |
| craft → cases | swipe: two parallax layers with a horizontal smear |
| cases → pricing | the card breaks into blocks that fall and stack |
| pricing → route | directional blur along X; the strips become lanes |
| route → gains | the horizon sags on a sine and two fbm fog layers settle |
| gains → portal | a ring of sparks opens outward, next world inside it |
| portal → brief | exposure climbs to white, cut at the peak, back down |
| brief → basement | the world turns over on X with an LUT inversion, grain, chromatic split |
| basement → credits | spores become stars as the camera pulls back |

**Every one of them degrades to the same thing** on the low tier and under
reduced motion: a 250 ms crossfade with a small vertical shift. That path is in
the engine from the start, not promised for later.

## 4 · The visual-defect checklist

This is the pass that fixes what is visible to the eye rather than to a
profiler. Work it whenever a section changes.

- **Nothing that glows lives inside `overflow: hidden`.** A halo is a
  pseudo-element outside the clip, an inset shadow, or padding equal to the
  blur radius plus the offset. Never a child of a clipping box.
- **Nested radii are arithmetic**: inner = outer − padding. A 40 px phone body
  with 10 px padding has a 30 px screen. Concentric or wrong.
- **Every `<img>` and `<video>` declares width and height** (or
  `aspect-ratio`) and sets a deliberate `object-position`. The default is
  centre, and centre crops the subject in half the compositions on this site.
- **Shadows in dark worlds are tinted with the world's own ground**, via
  `--shadow-tint`, never black-with-alpha — black over a coloured dark surface
  reads as dirt.
- **On coarse pointers a glow is a pre-rendered radial gradient.** A large
  blur radius is the single most expensive thing a phone compositor does.
- **`transform` or `filter` on an ancestor creates a containing block**, which
  silently breaks `position: fixed` inside it. If a fixed child stops being
  fixed, look up the tree for a transform.
- Check all six widths: 390, 430, 768, 1024, 1440, 1920. `npm run qa` shoots
  every section at every one of them and reports any element that pushes the
  document sideways.

## 5 · Copy rules — do not "improve" the text

The words were written before the code and they sell. Prohibited, explicitly:

- No "well, are you buying then?" — nothing that demands a yes/no. The only
  ask is *when it suits you to start*.
- No discounts, no countdowns, no "two slots left". Fake urgency breaks the
  moment it is noticed, and it is noticed.
- No answering questions nobody asked: no "don't worry, it pays for itself",
  no "we offer instalments".
- **Never replace a price range with a single number.** The range is a
  decision, not a hedge.
- No game is ever required to continue. Every one has a skip control from the
  first second and a text alternative.
- No "our advantages", "individual approach", "10 years on the market". It is
  not in the copy and it does not get to appear.

## 6 · Intellectual property

The mechanic is the reference, never the character. See `site/legal/` for the
per-reference table of what was kept and what was replaced. Nothing on this
site is lifted from a film, a game or a brand: no sprites, no logos, no
typefaces from a franchise, no soundtrack. Sound is synthesised in
`src/core/audio-bus.ts`, so there is no licence to file and nothing to clear.
