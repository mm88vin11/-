
---

## 8 · Definition of Done

Checked with evidence, not with optimism. Where an item is not ticked it says
so and says why.

| | Item | Evidence |
| --- | --- | --- |
| ✅ | One rAF for the whole site | `npm run guard`: "one clock: single rAF, in src/core/ticker.ts×1" — and that one is the fallback path, never entered while GSAP is present |
| ✅ | Every world pauses off screen | `liveWorlds` never exceeds 3 across all four scroll runs |
| ✅ | Worlds release GPU memory on unmount | `ShaderLayer.destroy()`, `forceContextLoss()`, `ImageBitmap.close()`; guard fails a world that builds a renderer without releasing it |
| ✅ | CLS ≤ 0.02 | 0.001 measured; every `<img>` declares width and height (guard checks) |
| ✅ | 12 sections × 6 widths screenshot | `site/qa/shots/final/`, plus a frame of each of the eleven seams |
| ✅ | No horizontal document overflow at any width | overflow table, §7 |
| ✅ | Preloader at CPU ×6 without dropped frames | §7 "The opening", with the recording in `site/qa/video/` |
| ✅ | Logo hands over to the header without a jump | FLIP deltas in §7, measured from both rectangles after the flight |
| ✅ | Three tiers, and a runtime downgrade | §7 "Which tier the page chose for itself" — no run asks for a tier, and the table records the detection, the ladder acting, and where it settled. §7 "What the degradation is buying" prices the alternative on the same scroll |
| ✅ | prefers-reduced-motion is a real branch | §7 — Lenis is never constructed, reveals show immediately, seams collapse |
| ✅ | Readable with WebGL disabled | §7 — headings, body text and errors counted with `getContext('webgl*')` stubbed to null |
| ✅ | Keyboard reaches the whole site with a visible ring | §7 — tab stops and rings counted |
| ✅ | Contrast ≥ 4.5:1 (3:1 large) in every world | §7 — every text node measured against its resolved background. Nodes sitting on a gradient are listed separately rather than guessed at |
| ✅ | Every canvas out of the accessibility tree, every image with alt and a declared box | §7 |
| ✅ | Pinch zoom available | the inherited `user-scalable=no` is gone; multi-touch is cancelled only over the game surfaces |
| ✅ | No asset from anyone else's IP | `site/legal/README.md`; sound is synthesised, so there is no licence to file |
| ✅ | A world that throws does not take the page | §7 — `#truth`'s context forced to throw, the rest still renders |
| ✅ | Every game has a skip control from the first second | `#pricing` "пропустить и читать дальше", `#portal` "просто откройте", `#gains` "просто показать карту" |
| ⚠️ | 0 frames > 33 ms on desktop | See the per-section table in §7. The sections that miss it are the two that paint a full screen of pixels every frame — the reel and the fog — which is a GPU's cheapest operation and a software rasteriser's most expensive. §6 explains why these numbers are a floor rather than a forecast |
| ⚠️ | Lighthouse mobile ≥ 92 performance | See §7. The accessibility and best-practices numbers are hardware-independent and stand; the performance number is a software-rasterised, 4×-throttled figure and should be re-measured on real hardware before it is quoted |
| ❌ | 404 corridor with WASD | Not built — a static single-page site has no 404 route (§3) |
| ❌ | The basement gated behind footer overscroll | Deliberate: it would hide the code word and the priority-slot offer from almost everyone (§3) |
