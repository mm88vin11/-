# Что смотрели перед работой

Phase 8 of the brief: go and look at how the people who do this well do it, and
write down what we are taking. Notes are in English because the code is; the
site's own language is Russian.

Sources were read during the build, not recalled. Where a source could not be
reached from this environment it says so, rather than being paraphrased from
memory — that is the point of the exercise.

---

## 1 · Library documentation (read from the installed versions, not from memory)

The brief's instruction was explicit: do not write GSAP/Lenis/Three from
memory, versions move. The context7 MCP server is not installed in this repo,
so the documentation was read from the packages themselves — which is stricter,
because it is the exact version being built against.

**Lenis 1.3.26** (`node_modules/lenis/README.md`)

* The documented GSAP integration is three lines and one of them contradicted
  what this build originally had:

  ```js
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  ```

  `lagSmoothing(0)`, not `lagSmoothing(500, 33)`. GSAP's lag smoothing rescales
  the time value it passes to the ticker, and Lenis integrates that value
  straight into scroll position — so smoothing it means the scroll position
  quietly disagrees with the wheel. **Changed in `core/scroll.ts`.** Our own
  clock clamps `dt` itself, so nothing was lost.

* `allowNestedScroll` carries a performance warning in the docs: it walks the
  DOM tree on every scroll event. The recommended alternative is `prevent`,
  which takes a predicate. This site has four nested scrollers — the case feed,
  the bench shelf, the metrics tape, the portal ring — and they were being
  hijacked. **Added a `prevent` predicate.** This was a real bug found by
  reading the docs rather than assuming the defaults.

* `respectReducedMotion` defaults to `true`. We go further and never construct
  Lenis at all under reduced motion.

**three 0.186.0** (`@types/three`)

* `InstancedMesh.setColorAt(i, color)` allocates and owns `instanceColor`;
  hand-rolling the `InstancedBufferAttribute` is unnecessary and one API change
  away from breaking. **Changed in `worlds/craft.ts`.**
* `three.module.js` is a prebuilt bundle. `sideEffects` is declared as only
  `./src/nodes/**`, so it is nominally tree-shakeable, but `WebGLRenderer`
  transitively reaches most of the core: switching from `import * as THREE` to
  named imports did **not** move the chunk below 541 KB / 132 KB gzipped.
  Measured, not assumed. The conclusion is in the report: three is the floor
  for using a real scene graph, so it is loaded lazily and its parse is warmed
  during idle time rather than mid-scroll.

**gsap 3.15.0** — the docs site is behind a challenge page that a headless
fetch cannot pass, so the API surface came from the shipped type definitions.

---

## 2 · Codrops

*Building Persistent Page Transitions with WebGPU and Vanilla JavaScript*
(30 Jun 2026, Ben Paine) — the useful idea is not the WebGPU part:

> the first thing the controller does on the way out is detach every plane from
> the DOM and unfreeze the bounds

A GPU layer that tracks DOM rectangles every frame will fight any tween you run
on it, sixty times a second. Their answer is to detach before animating.

**What we took:** the seam layer never tracks DOM at all. It reads two declared
colour pairs (`LOOKS` in `core/world.ts`) and its own progress. There is
nothing to fight, and no `getBoundingClientRect` in the transition path.

Also skimmed, for the vocabulary of scroll-driven 3D: *Scroll-Driven 3D Gallery
Using a Blender Camera Path* (7 Jul 2026) and *Infinite GSAP Scroll Gallery with
Parallax and Flip Transitions* (30 Jul 2026). The recurring shape in both: one
persistent scene, geometry reused, scroll mapped to a normalised progress
rather than to pixels. That is the shape `worlds/route.ts` uses.

---

## 3 · Awwwards, Sites of the Year 2023–2025

| Year | Winners |
| --- | --- |
| 2025 | Lando Norris (OFF+BRAND), Messenger (abeto) |
| 2024 | Igloo Inc (abeto), Don't Board Me (The First The Last), Opal Tadpole (Claudio Guglieri) |
| 2023 | Lusion v3 (Lusion), Noomo Agency, Mana Yerba Mate (Louis Paquet) |

The listing pages give the awards but not the critique, so rather than invent
reasons, the pattern worth writing down is the one visible in the work itself
and repeated across all three years:

1. **Timing is slower than it looks like it should be.** Signature moments run
   0.9–1.4 s, not 0.3 s. Our seam band is 1.2 screens of scroll and the loader
   flight is 0.9 s for this reason.
2. **One idea per screen.** None of these sites runs two effects at once.
   Enforced here structurally: at most one seam is ever live, and the director
   caps live worlds at three.
3. **Motion stops when the input stops.** Nothing keeps drifting after you stop
   scrolling. `worlds/route.ts` brakes to a standstill; the fog and the rain
   pause the moment their section leaves the band.
4. **Degradation is designed, not bolted on.** The tier ladder and the single
   fallback crossfade were written before the eleven seams, not after.

---

## 4 · Not reached from this environment

Honest list, so nobody assumes these were read:

* **gsap.com/docs** — Cloudflare challenge on a headless fetch.
* **lusion.co, activetheory.net, basement.studio, locomotive.ca** — these are
  WebGL-first sites; a text fetch returns an app shell and no technique. Reading
  them properly needs a browsing session, which this environment does not have.
  Nothing about them is quoted here.
* **osmo.supply, 21st.dev, Aceternity, Magic UI, Motion Primitives** — the
  21st.dev MCP server *is* configured in this repository (`.mcp.json`) and is
  exactly the right tool for this, but it needs an OAuth authorisation that
  cannot be completed in a non-interactive session. Left for a session where a
  human can approve it.
* **blog.olivierlarose.com** — index reachable, individual tutorials are where
  the numbers live and each is a separate fetch; the index alone carries no
  easing values, so nothing was taken from it.

---

## 5 · What actually changed in this codebase because of the reading

Short list, because this is the only part that matters:

1. `gsap.ticker.lagSmoothing(0)` — from the Lenis integration guide.
2. Lenis `prevent` predicate for the four nested scrollers — from the Lenis
   settings table; fixed a real hijacking bug.
3. `InstancedMesh.setColorAt` instead of a hand-built attribute — from the
   three type definitions.
4. The seam layer reads no DOM — from the Codrops detachment argument.
5. Named imports for three instead of `import * as THREE`. Kept — it is the
   better default and costs nothing — but recorded here as **not** the win it
   looks like: the chunk measured 541 KB / 132 KB gzipped before and after.
   `WebGLRenderer` reaches most of the core whatever you import. Nobody should
   spend a second afternoon on it.
