# Motion — Vanilla JS API

Import from `motion`. Everything here works without a framework, and also inside
Vue, Svelte, or plain HTML pages.

## Contents

- [animate](#animate)
- [Playback controls](#playback-controls)
- [Sequences](#sequences)
- [scroll](#scroll)
- [inView](#inview)
- [hover and press](#hover-and-press)
- [Utilities](#utilities)
- [motion/mini](#motionmini)

## animate

```js
import { animate } from "motion"

animate("#box", { opacity: 1, x: 100 }, { duration: 0.5 })
```

The first argument accepts a CSS selector, an `Element`, an array of elements, a
`MotionValue`, or a plain object. Selectors match all elements, so one call can
drive a whole list.

Keyframes as arrays give you intermediate steps. A leading `null` means "start
from whatever the current value is", which keeps an interrupted animation from
jumping:

```js
animate("#box", { x: [0, 100, 50] })
animate("#box", { opacity: [null, 1] })
```

Independent transforms each animate separately, so you can drive `x` and `scale`
with different springs at the same time. CSS variables and SVG path lengths work
too:

```js
animate("#el", { "--accent": "#f00" })
animate("path", { pathLength: [0, 1] })
```

Animating numbers or objects, rather than elements:

```js
animate(0, 100, { onUpdate: (v) => console.log(v) })
animate(motionValue, 100)
```

## Playback controls

`animate()` returns an `AnimationPlaybackControls` object, which is also
thenable — `await` it to wait for completion.

| Member | Type / meaning |
| --- | --- |
| `play()` `pause()` `stop()` | Playback. `stop()` halts and keeps current values |
| `complete()` | Jump to the end |
| `cancel()` | Halt and revert to the starting values |
| `time` | Current time in seconds, settable for scrubbing |
| `speed` | Playback rate; `-1` plays backwards |
| `duration` | Total duration |
| `iterationDuration` | Duration of a single iteration |
| `startTime` | Start timestamp, or `null` |
| `state` | `"idle"`, `"running"`, `"paused"`, `"finished"` |
| `finished` | Promise resolving on completion |
| `attachTimeline(timeline)` | Drive from a scroll timeline instead of time |

```js
const anim = animate("#box", { x: 100 })
anim.pause()
anim.time = anim.duration / 2   // scrub to halfway
await anim                      // resolves when finished
```

## Sequences

Pass an array to run segments in order. Each segment is
`[target, keyframes, options?]`, and the `at` option controls timing relative to
the sequence: a number is an absolute offset, `"<"` starts alongside the previous
segment, and `"-0.2"` / `"+0.2"` shift relative to the previous end.

```js
animate([
  ["#a", { opacity: 1 }, { duration: 0.3 }],
  ["#b", { x: 100 }, { at: "<" }],
  ["#c", { scale: [0, 1] }, { at: "-0.1" }],
])
```

`stagger()` inside a segment spreads one target's elements apart — see
`transitions.md`.

## scroll

`scroll` links a callback or an animation to scroll position.

```js
import { scroll, animate } from "motion"

// Progress callback
scroll((progress) => console.log(progress))

// Drive an animation directly — this is the scroll-linked case
scroll(animate("#bar", { scaleX: [0, 1] }))

// Track one element through the viewport
scroll(animate("#img", { opacity: [0, 1] }), {
  target: document.querySelector("#section"),
  offset: ["start end", "end start"],
})
```

Options: `axis` (`"x"` or `"y"`, default `"y"`), `container` (defaults to
`document.scrollingElement`), `target`, and `offset`.

`offset` takes two edge pairs, each `"<target edge> <container edge>"`. Common
values: `["start end", "end start"]` (the whole time the element is visible) and
`["start start", "end end"]` (while it fills the viewport).

`scrollInfo` gives raw measurements rather than a bound animation, when you need
the numbers yourself.

Where the browser supports `ScrollTimeline`, `scroll` uses it and runs off the
main thread; otherwise it falls back to a scroll listener transparently.

## inView

Fires when an element enters the viewport. Returning a function from the callback
registers a leave handler:

```js
import { inView, animate } from "motion"

const stop = inView("#card", (element) => {
  animate(element, { opacity: 1, y: 0 })
  return () => animate(element, { opacity: 0 })   // on leave
}, { amount: 0.5 })
```

Options: `root` (`Element | Document`), `margin` (like `rootMargin`), and
`amount` — `"some"`, `"all"`, or a number 0–1. The call returns a function that
stops observing.

Note the default: the callback fires once per entry and stops observing unless
you return a leave handler, which is what makes "animate in once" the easy path.

## hover and press

Gesture helpers that handle the awkward parts — `hover` filters out emulated
touch hovers, `press` handles keyboard activation and pointer cancellation.

```js
import { hover, press } from "motion"

hover("#btn", (element) => {
  animate(element, { scale: 1.1 })
  return () => animate(element, { scale: 1 })
})

press("#btn", (element) => {
  animate(element, { scale: 0.95 })
  return () => animate(element, { scale: 1 })
})
```

Both accept a selector or element and return a cleanup function.

## Utilities

| Function | Purpose |
| --- | --- |
| `transform(input, inputRange, outputRange, opts?)` | Map a value between ranges. Called without `input`, returns a reusable mapper |
| `stagger(duration?, options?)` | Delay function for lists — see `transitions.md` |
| `spring(options)` | Standalone spring generator |
| `mix(from, to)` | Interpolator between two values |
| `wrap(min, max, v)` | Wrap a value into a range |
| `clamp(min, max, v)` | Constrain a value |
| `delay(cb, seconds)` | Frame-accurate delay, **in seconds** |
| `frame` / `cancelFrame` | Motion's frame loop |
| `distance` | Distance between numbers or points |

```js
const toOpacity = transform([0, 100], [0, 1])
toOpacity(50)   // 0.5
```

## motion/mini

`motion/mini` exports an `animate` (internally `animateMini`) built purely on the
browser's Web Animations API — around 2.5kb.

```js
import { animate } from "motion/mini"
animate("#box", { opacity: 1 }, { duration: 0.5 })
```

The trade-off: it can only animate what WAAPI can accelerate, so independent
transforms, springs on arbitrary values, and the more exotic keyframe handling are
not available. Use it when bundle size is a hard constraint and the animations are
simple; use the full `animate` otherwise.
