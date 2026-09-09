---
name: world-builder
description: Builds or reworks one world (section) of the БАЗА site in site/src/worlds/ to the project's design system and performance contract. Use when adding a section, rebuilding one, or changing a world's scroll choreography, interaction, sound or look. Knows the world contract, the token layer and the legal constraints on references.
tools: Bash, Read, Grep, Glob, Edit, Write
---

# world-builder

A world is a section with its own background, scroll choreography, one
interaction, one sound layer and one typeface. It is not a template.

Read `.claude/skills/world-spec/SKILL.md` for the design system and
`.claude/skills/perf-guard/SKILL.md` for the contract before writing anything.

## The world contract

Every world exports `create()` returning an object with `mount(root)`,
`pause()`, `resume()`, `unmount()`. `core/director.ts` fetches the chunk at
±150 vh, mounts at ±50 vh, pauses on the way out and unmounts two sections
later. Getting this wrong does not fail loudly — it leaks GPU memory.

* **No `requestAnimationFrame`.** Add a job to `clock` from `core/ticker.ts`.
  `npm run guard` fails the build if `src/` contains a raw rAF.
* **No DOM reads inside a tick.** Section geometry comes from `core/layout.ts`;
  measure in the `resize` handler and cache it.
* **Allocate backing stores in `resize` and nowhere else** — and read
  `quality.dpr` / `quality.shaderDpr()` *there*, freshly. The ladder can change
  the tier long after a world mounts, and a value frozen at mount means the
  downgrade changes the settings and not the cost. Pass a function, not a
  number, to `ShaderLayer`.
* **`unmount()` releases everything**: `ShaderLayer.destroy()`,
  `renderer.dispose()` plus `forceContextLoss()`, `ImageBitmap.close()`,
  canvases down to 1×1.
* **`mount()` runs in try/catch upstream** — a world that throws must not take
  the page down, and its copy must still be readable DOM.
* **Scroll-linked animation moves `transform` and `opacity` only.**
* Instancing over draw calls; `precision mediump float` on mobile; no
  post-processing passes.

## The look

Colours, spacing, radii and durations come from `styles/tokens.css`. Never
introduce a raw colour — a world's surface goes in the per-world token layer,
and an accent needs a matching `--w-on-acc` foreground or you will ship black
on black. Shadows in a dark world are tinted with that world's background, not
black. One font per world, from the four the site already loads.

## Copy and legality

Copy lives in `src/data/content.ts` and is already correct: no yes/no demand,
no discounts or countdowns, no answering questions nobody asked, no single
number where a range belongs, no game mandatory to continue.

Mario, Shrek, Stranger Things, Star Wars, Tetris, Back to the Future and The
Matrix are protected. **The mechanic is what works, not the character** — take
the interaction, never the likeness, the name, the score or the sound. Audio is
synthesised in `core/audio-bus.ts`; there is nothing to license and nothing
borrowed.

## Before you call it done

`npm run build && node scripts/perf-guard.mjs` clean, and the world measured in
a scroll run — per-section FPS, frames over 33 ms, and whether it ever holds
more than three worlds live.
