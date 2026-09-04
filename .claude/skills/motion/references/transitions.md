# Motion — Transitions

Everything here applies to both APIs: the `transition` prop in React and the
third argument to `animate()` in vanilla JS.

## Contents

- [Choosing a type](#choosing-a-type)
- [Spring](#spring)
- [Tween and easing](#tween-and-easing)
- [Repeat](#repeat)
- [Per-value transitions](#per-value-transitions)
- [stagger](#stagger)
- [Inertia](#inertia)

## Choosing a type

Motion infers the type from what you animate, and the defaults are deliberately
chosen — physical properties get physics, everything else gets a curve:

- **Transforms** (`x`, `y`, `scale`, `rotate`) → spring
- **Everything else** (`opacity`, `color`, `backgroundColor`) → tween,
  `easeOut` over 0.3s
- **Layout animations** → a spring tuned for layout

Setting `duration` on a transform implicitly switches it to a tween. To keep a
spring while specifying how long it should feel, use `visualDuration` instead
(below). Set `type` explicitly when you want to be unambiguous.

## Spring

Springs are defined one of two ways. Mixing the two vocabularies is the usual
source of confusion, so pick one.

**Physical** — you describe the spring itself:

| Option | Default | Meaning |
| --- | --- | --- |
| `stiffness` | 100 | Higher is snappier |
| `damping` | 10 | Opposing force; 0 oscillates forever |
| `mass` | 1 | Heavier overshoots more and settles slower |
| `velocity` | inherited | Initial velocity |

**Perceptual** — you describe how it should feel, which is usually easier to tune:

| Option | Meaning |
| --- | --- |
| `visualDuration` | Seconds until the value *visually* arrives, ignoring the settling tail |
| `bounce` | 0 = no overshoot, 1 = very bouncy |
| `duration` | Total duration including settling |

```js
{ type: "spring", stiffness: 300, damping: 30 }
{ type: "spring", visualDuration: 0.4, bounce: 0.25 }
```

`visualDuration` is the more predictable of the two for UI work: a spring's total
`duration` includes an imperceptible tail, so two springs with the same `duration`
can look like they arrive at different times, while `visualDuration` matches what
the eye actually sees.

A rough starting point: `stiffness: 400, damping: 30` feels responsive for
buttons and small controls; `stiffness: 100, damping: 20` feels softer, for
panels and larger surfaces.

## Tween and easing

```js
{ type: "tween", duration: 0.5, ease: "easeInOut" }
```

Built-in easings, all exported as functions too: `linear`, `easeIn`, `easeOut`,
`easeInOut`, `circIn`, `circOut`, `circInOut`, `backIn`, `backOut`, `backInOut`,
`anticipate`.

Custom curves:

```js
{ ease: [0.17, 0.67, 0.83, 0.67] }   // cubic bezier as an array
{ ease: cubicBezier(0.17, 0.67, 0.83, 0.67) }
{ ease: steps(5) }                    // stepped
```

Modifiers `mirrorEasing` and `reverseEasing` transform an existing easing function.

**Keyframe timing.** With multiple keyframes, `times` positions each one from 0 to
1, and `ease` may be an array with one entry per transition *between* keyframes:

```js
animate("#box", { x: [0, 100, 50] }, {
  duration: 1,
  times: [0, 0.3, 1],
  ease: ["easeOut", "easeIn"],
})
```

## Repeat

```js
{ repeat: 3, repeatType: "reverse", repeatDelay: 0.5 }
{ repeat: Infinity, ease: "linear", duration: 2 }   // continuous spin
```

`repeatType` is `"loop"` (restart from the beginning, the default), `"reverse"`
(play back and forth), or `"mirror"` (reverse with the easing mirrored too).

## Per-value transitions

Give each property its own transition by nesting it under its name. `default`
covers the rest:

```jsx
<motion.div
  animate={{ x: 100, opacity: 1 }}
  transition={{
    default: { duration: 0.3 },
    x: { type: "spring", stiffness: 300 },
    opacity: { duration: 0.8, ease: "linear" },
  }}
/>
```

Other shared options: `delay` (seconds), `repeat`, `repeatDelay`, and the
orchestration options `staggerChildren`, `delayChildren`, `staggerDirection`,
`when` — the last group only meaningful on a variant, since they coordinate
children.

## stagger

`stagger(duration = 0.1, { startDelay = 0, from = 0, ease })` returns a function
Motion calls per element, so it goes in the `delay` slot rather than being applied
directly:

```js
import { animate, stagger } from "motion"

animate("li", { opacity: 1 }, { delay: stagger(0.1) })
animate("li", { opacity: 1 }, { delay: stagger(0.1, { from: "center" }) })
animate("li", { opacity: 1 }, { delay: stagger(0.1, { startDelay: 0.5, ease: "easeOut" }) })
```

`from` accepts `"first"`, `"last"`, `"center"`, or an index — the delay grows with
each element's distance from that origin, so `"center"` ripples outward.
An `ease` distributes the delays along a curve instead of linearly.

In React, `stagger` works the same way inside `useAnimate` sequences. For
declarative variants, use `staggerChildren` instead — it does the equivalent job
through variant propagation.

## Inertia

For momentum after a gesture; this is what `dragMomentum` uses internally.

```js
{ type: "inertia", velocity: 500, power: 0.8, timeConstant: 700,
  min: 0, max: 100, bounceStiffness: 500, bounceDamping: 10 }
```

`power` and `timeConstant` shape how far and how long it coasts; `min`/`max` add
boundaries it springs back from.
