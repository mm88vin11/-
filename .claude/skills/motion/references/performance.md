# Motion — Performance, accessibility, SSR

## Contents

- [What is actually cheap to animate](#what-is-actually-cheap-to-animate)
- [Bundle size and LazyMotion](#bundle-size-and-lazymotion)
- [Avoiding re-renders](#avoiding-re-renders)
- [Hardware acceleration and will-change](#hardware-acceleration-and-will-change)
- [Reduced motion](#reduced-motion)
- [SSR and Next.js](#ssr-and-nextjs)
- [Debugging](#debugging)

## What is actually cheap to animate

The browser can composite `transform` and `opacity` on the GPU without touching
layout or paint. Everything else costs more, and the difference is the single
biggest factor in whether an animation holds 60fps.

| Instead of | Use |
| --- | --- |
| `width`, `height` | `scaleX`, `scaleY`, or the `layout` prop |
| `top`, `left`, `right`, `bottom` | `x`, `y` |
| `margin`, `padding` | `x`/`y`, or `layout` |
| `filter: blur()` on a large area | A smaller blurred element, or accept the cost |

`layout` exists precisely so you can animate real layout changes without paying
per-frame layout cost: Motion measures before and after, then interpolates with
transforms and corrects the distortion.

Animating `boxShadow` and `backgroundColor` is fine in small doses but triggers
paint; on long lists, prefer opacity on a pre-painted overlay.

## Bundle size and LazyMotion

The full `motion` component bundles every feature — drag, layout, gestures — even
if a page only fades things in. `LazyMotion` plus the `m` component splits that
apart:

```jsx
import { LazyMotion, domAnimation, m } from "motion/react"

<LazyMotion features={domAnimation}>
  <m.div animate={{ opacity: 1 }} />
</LazyMotion>
```

`m` has the identical API to `motion` but ships no features of its own — the
`LazyMotion` provider supplies them.

These are the size budgets the repository enforces on itself in v13.2.0
(`bundlesize` in `framer-motion/package.json`), so they are the real numbers
rather than estimates:

| What | Size |
| --- | --- |
| Full `motion` component | 34.9 kB |
| `m` component alone | 6 kB |
| `domAnimation` features | 17.85 kB |
| `domMax` features | 29.8 kB |
| `animate` (vanilla) | 19.1 kB |
| `scroll` (vanilla) | 5.2 kB |
| `motion/mini` animate | 2.26 kB |

So `m` + `domAnimation` lands near 24 kB against 34.9 kB for the full component —
worthwhile, and more so when the features are loaded asynchronously. A third
bundle, `domMin`, provides animations only and sits below `domAnimation`.

Load them on demand by passing a function, so the features arrive after first paint:

```jsx
<LazyMotion features={() => import("./features").then((m) => m.default)} strict>
```

`strict` makes using `motion` (rather than `m`) inside the provider throw, which
is worth turning on — it is otherwise easy to silently reintroduce the full bundle
with one stray import.

If you need less than any of this, `motion/mini` is ~2.5kb; see `vanilla.md`.

## Avoiding re-renders

The reason motion values exist is that React state is the wrong tool for
per-frame updates. This re-renders the component on every scroll event:

```jsx
const [y, setY] = useState(0)
useEffect(() => {
  const h = () => setY(window.scrollY)
  window.addEventListener("scroll", h)
  return () => window.removeEventListener("scroll", h)
}, [])
<div style={{ transform: `translateY(${y}px)` }} />
```

This does not re-render at all — the value writes straight to the DOM:

```jsx
const { scrollY } = useScroll()
const y = useTransform(scrollY, [0, 300], [0, -50])
<motion.div style={{ y }} />
```

Use `useMotionValueEvent` only when you genuinely need React state (toggling a
class, say), and derive a boolean rather than subscribing to raw values.

Other things that help on large lists: hoist `variants` objects out of the
component so they aren't recreated each render, and give `AnimatePresence`
children stable keys so Motion doesn't tear down and rebuild animations.

## Hardware acceleration and will-change

Motion sets `will-change` automatically while animating and removes it afterwards.
That removal matters — a permanent `will-change` on many elements costs memory and
can make things slower overall, which is why setting it by hand in CSS is usually
counterproductive.

`useWillChange()` gives you a managed value if you need to bind it yourself.

## Reduced motion

Respect the OS setting. The cheapest correct approach is global:

```jsx
<MotionConfig reducedMotion="user">
  <App />
</MotionConfig>
```

With `"user"`, Motion disables transform and layout animations for users who ask
for reduced motion, while still allowing opacity and colour changes — so
interfaces stay legible rather than becoming static.

For per-component decisions, `useReducedMotion()` returns a boolean:

```jsx
const shouldReduce = useReducedMotion()
<motion.div animate={{ x: shouldReduce ? 0 : 100 }} />
```

`reducedMotion` also accepts `"always"` and `"never"`.

## SSR and Next.js

Motion components are client-side. In the App Router either mark the file
`"use client"` or import from `motion/react-client`, which is the same API with
the directive already applied:

```jsx
import * as motion from "motion/react-client"
```

`initial` is rendered as the server-side style, so the markup matches the first
frame and there is no flash. Setting `initial={false}` skips the mount animation
entirely — useful for content that should appear settled on load.

Layout animations need real measurements and cannot run on the server; they begin
after hydration.

## Debugging

`motion/debug` exposes `recordStats`, which collects frame-loop statistics you can
inspect while an animation runs:

```js
import { recordStats } from "motion/debug"
```

When an animation misbehaves, the usual causes, in rough order of likelihood:
an exit animation whose element isn't a direct `AnimatePresence` child or lacks a
stable key; `layout` competing with a manual transform on the same element; a
`duration` set on a transform silently converting a spring to a tween; or a value
animating from `"auto"`, which has no numeric start — animate `height` from a
measured pixel value, or use `layout` instead.
