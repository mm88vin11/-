---
name: motion
description: Reference for Motion (motion.dev, v13.2.0) — the animation library formerly called Framer Motion — covering the React API (motion components, variants, AnimatePresence, layout animations, motion values, hooks) and the vanilla JS API (animate, scroll, inView, hover, press, stagger, springs). Use this whenever animation comes up in a web project: entrance and exit transitions, hover and tap states, scroll-linked or scroll-triggered effects, shared-element and layout transitions, drag interactions, gesture handling, spring physics, staggered lists, or page transitions. Also use it when reviewing or debugging animation code, when someone imports from `motion`, `motion/react`, or `framer-motion`, or when they ask how to make something "animate", "slide in", "fade", "spring", "feel smoother", or "move on scroll" — even if they never name the library.
license: MIT
---

# Motion

Motion is the animation library at `motion.dev`. It is the same project that
was published as Framer Motion; since v11 the package is `motion`, and
`framer-motion` remains as a maintained alias. This reference tracks **v13.2.0**.

## Picking the entry point

The single most common source of confusion is which package path to import from.
The React API and the vanilla API are *different surfaces of the same library*,
and mixing them up produces import errors that look mysterious.

| Import from | Gives you | Use when |
| --- | --- | --- |
| `motion/react` | `motion.div`, hooks, `AnimatePresence` | React / Next.js |
| `motion` | `animate`, `scroll`, `inView`, `hover`, `press` | Vanilla JS, Vue, Svelte |
| `motion/react-client` | Same as `motion/react`, pre-marked `"use client"` | Next.js App Router, to avoid writing the directive yourself |
| `motion/mini` | A ~2.5kb `animate` built on WAAPI only | Hard bundle-size limits |
| `framer-motion` | Alias of `motion/react` | Existing codebases; no need to migrate urgently |

Install with `npm install motion`. In React, `import { motion } from "motion/react"`
— **not** from `"motion"`, which is the vanilla entry and has no `motion.div`.

## Choosing an approach

Reach for the simplest tool that expresses the intent:

1. **A state change should animate** → put the values in the `animate` prop and
   let Motion interpolate. This covers the majority of real cases.
2. **Several elements share choreography** → use `variants`, so a parent can
   orchestrate children by name instead of each child managing its own state.
3. **An element leaves the tree** → wrap in `AnimatePresence`, because React
   would otherwise unmount it before any exit animation could run.
4. **Position or size changes because of layout, not a known value** → use the
   `layout` prop. You cannot animate to a value you don't know; layout
   animations measure before and after and interpolate the difference.
5. **The animation is driven by something continuous** (scroll, pointer, time)
   → use motion values and `useTransform`, which update outside React's render
   cycle and so avoid re-rendering on every frame.
6. **Imperative sequencing, or you're not in React** → use `animate()` directly.

## The core mental model: motion values

A `MotionValue` holds an animatable value and notifies subscribers when it
changes, **without triggering a React render**. This is why Motion stays smooth
where `useState` would stutter: a scroll handler that calls `setState` re-renders
the component 60+ times a second, while a motion value writes straight to the DOM.

```jsx
const x = useMotionValue(0)
const opacity = useTransform(x, [-200, 0, 200], [0, 1, 0])
return <motion.div drag="x" style={{ x, opacity }} />
```

`useTransform` maps one value's range onto another. `useSpring` smooths a value
with physics. `useScroll` gives you scroll progress as a motion value. They
compose, and the chain never touches React state.

Anything passed through `style` as a motion value updates directly. Anything in
`animate` goes through the animation system. Both are fine; the difference is
who drives the value.

## Quick recipes

**Entrance**
```jsx
<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} />
```

**Exit** — the `key` is what tells React (and Motion) that the identity changed:
```jsx
<AnimatePresence>
  {open && <motion.div key="panel" initial={{ opacity: 0 }}
    animate={{ opacity: 1 }} exit={{ opacity: 0 }} />}
</AnimatePresence>
```

**Gestures** — these are props, not event handlers, and they revert automatically:
```jsx
<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} />
```

**Staggered list** via variants, where the parent orchestrates:
```jsx
const list = { visible: { transition: { staggerChildren: 0.07 } } }
const item = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }

<motion.ul variants={list} initial="hidden" animate="visible">
  {items.map((i) => <motion.li key={i.id} variants={item} />)}
</motion.ul>
```
Children inherit the variant name from the parent, so `item` needs no `initial`
or `animate` of its own.

**Animate once on scroll into view**
```jsx
<motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
  viewport={{ once: true, amount: 0.3 }} />
```

**Scroll-linked progress bar**
```jsx
const { scrollYProgress } = useScroll()
return <motion.div style={{ scaleX: scrollYProgress, originX: 0 }} />
```

**Shared element between two components** — same `layoutId`, and Motion animates
between them even though they are different nodes:
```jsx
{items.map((i) => <motion.div key={i.id} layoutId={i.id} />)}
```

**Vanilla JS**
```js
import { animate, inView, scroll } from "motion"

animate("#box", { opacity: 1, x: 100 }, { duration: 0.5 })
inView("#card", () => animate("#card", { opacity: 1 }))
scroll(animate("#bar", { scaleX: [0, 1] }))
```

## Defaults worth knowing

Motion picks a transition for you based on what you animate, and the choice is
usually right — override it only when you have a reason:

- `x`, `y`, `scale`, `rotate` and other transforms animate with a **spring**.
- `opacity`, `color`, and other non-transform values use a **tween** (`ease: "easeOut"`, `duration: 0.3`).
- `layout` animations use a spring tuned for layout.

Transforms and `opacity` are the two things browsers composite on the GPU.
Animating `width`, `height`, `top`, or `left` triggers layout on every frame and
is the usual reason an animation feels heavy — prefer `scale` and `x`/`y`, or use
the `layout` prop, which handles the distortion correction for you.

## Reference files

Read the file that matches the task rather than all of them:

- **`references/react.md`** — the full React surface: `motion` components and
  every prop, variants and propagation, `AnimatePresence` modes, layout and
  shared-element animations, drag, `Reorder`, `useAnimate` scopes, and the
  complete hook list with signatures.
- **`references/vanilla.md`** — `animate`, `scroll`, `scrollInfo`, `inView`,
  `hover`, `press`, sequences, `AnimationPlaybackControls`, and the `motion/mini` API.
- **`references/transitions.md`** — springs (including `visualDuration`/`bounce`),
  tweens, the built-in easings, `repeat` and `repeatType`, `stagger()`, `times`,
  and per-value transitions.
- **`references/performance.md`** — bundle size and `LazyMotion`, hardware
  acceleration, `will-change`, reduced-motion support, SSR and Next.js notes.
- **`references/migration.md`** — Framer Motion → Motion renames, deprecated
  APIs still exported in v13, and the `delay` unit trap.

## Common traps

**Exit animations silently not running.** The element must be a direct child of
`AnimatePresence` and must carry a stable `key`. Conditionally rendering the
`AnimatePresence` itself removes the whole tree at once and there is nothing left
to animate out.

**`layout` and transforms fighting.** An element with `layout` measures its own
box; animating `x`/`y` on the same element at the same time makes the two systems
disagree. Move the transform to a wrapper or an inner element.

**Importing `motion` from `"motion"` in React.** That path is the vanilla API.
React needs `"motion/react"`.

**`delay` means different things.** `delay` from `motion` (vanilla) takes
**seconds**; `delay` exported from `framer-motion`'s root is in **milliseconds**,
kept that way for backwards compatibility with Framer. The `delay` *option*
inside a transition is always seconds.

**Server components.** `motion` components are client-side. In the Next.js App
Router, either add `"use client"` or import from `motion/react-client`.
