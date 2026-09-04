# Motion — React API

Import everything from `motion/react` (or `motion/react-client` in Next.js App
Router, which is the same surface with `"use client"` already applied).

## Contents

- [motion components](#motion-components)
- [Props](#props)
- [Variants](#variants)
- [AnimatePresence](#animatepresence)
- [Layout animations](#layout-animations)
- [Drag](#drag)
- [Reorder](#reorder)
- [Motion values](#motion-values)
- [Hooks](#hooks)
- [Imperative animation with useAnimate](#imperative-animation-with-useanimate)
- [MotionConfig and LayoutGroup](#motionconfig-and-layoutgroup)

## motion components

`motion` is a proxy: `motion.div`, `motion.button`, `motion.svg`, `motion.circle`
and so on exist for every HTML and SVG element. For your own component, use
`motion.create(Component)` — the component must forward its ref to a DOM node,
otherwise Motion has nothing to animate.

`m` is the identical component with the feature set stripped out, for use with
`LazyMotion`. See `performance.md`.

## Props

**Animation targets**

| Prop | Purpose |
| --- | --- |
| `initial` | Starting state. `initial={false}` skips the mount animation and snaps to `animate`. |
| `animate` | Target state; animates whenever the value changes. |
| `exit` | State to animate to before unmounting. Requires `AnimatePresence`. |
| `transition` | How to animate. See `transitions.md`. |
| `variants` | Named states, referenced by string from `initial`/`animate`/`exit`. |
| `style` | Regular styles, plus motion values and the transform shorthands `x`, `y`, `scale`, `rotate`, `opacity`. |
| `custom` | Arbitrary data passed to dynamic variants. |

**Gesture states** — set while active, reverted automatically on release:

`whileHover`, `whileTap`, `whileFocus`, `whileDrag`, `whileInView`.

Each accepts a target object or a variant name. `whileInView` pairs with
`viewport={{ once, amount, margin, root }}`, where `amount` is `"some"`, `"all"`,
or a number from 0 to 1.

**Event callbacks**

`onAnimationStart`, `onAnimationComplete`, `onHoverStart`, `onHoverEnd`, `onTap`,
`onTapStart`, `onTapCancel`, `onDragStart`, `onDrag`, `onDragEnd`,
`onViewportEnter`, `onViewportLeave`, `onLayoutAnimationStart`,
`onLayoutAnimationComplete`.

**Layout**: `layout`, `layoutId`, `layoutScroll`, `layoutRoot`, `layoutDependency`.

**Drag**: `drag`, `dragConstraints`, `dragElastic`, `dragMomentum`,
`dragSnapToOrigin`, `dragPropagation`, `dragControls`, `dragListener`,
`dragDirectionLock`, `dragTransition`.

## Variants

Variants let a parent drive its children by name. This matters because
orchestration props (`staggerChildren`, `delayChildren`) only work through
variant propagation — they have nothing to coordinate otherwise.

```jsx
const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
}

const child = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

<motion.ul variants={container} initial="hidden" animate="visible">
  {items.map((i) => <motion.li key={i.id} variants={child} />)}
</motion.ul>
```

A child with `variants` and no explicit `animate` inherits the parent's current
variant name. Setting `animate` on the child breaks that inheritance — which is
occasionally what you want, but is more often an accidental cause of "the stagger
isn't working".

Orchestration options, set in a variant's `transition`:

| Option | Effect |
| --- | --- |
| `staggerChildren` | Seconds between each child |
| `staggerDirection` | `1` forwards, `-1` backwards |
| `delayChildren` | Delay before children begin |
| `when` | `"beforeChildren"` or `"afterChildren"` |

**Dynamic variants** are functions receiving the `custom` prop, which is how you
vary a delay per index:

```jsx
const item = {
  hidden: { opacity: 0 },
  visible: (i) => ({ opacity: 1, transition: { delay: i * 0.1 } }),
}

<motion.li custom={index} variants={item} />
```

## AnimatePresence

React removes elements from the DOM immediately. `AnimatePresence` defers that
removal until the `exit` animation finishes.

```jsx
<AnimatePresence mode="wait" initial={false}>
  <motion.div key={page} exit={{ opacity: 0 }} />
</AnimatePresence>
```

| Prop | Meaning |
| --- | --- |
| `mode` | `"sync"` (default), `"wait"` (finish exiting before entering), `"popLayout"` (pop leaving elements out of flow) |
| `initial` | `false` disables animations on first mount |
| `onExitComplete` | Fires once all exits finish |
| `custom` | Passes data to exiting children, which are no longer receiving props |

Requirements that quietly break things when missed: children need stable, unique
`key`s; the animating element must be a **direct** child; and `AnimatePresence`
must itself stay mounted.

For coordinating with your own state, `usePresence()` returns
`[isPresent, safeToRemove]` so you can defer removal manually, and `useIsPresent()`
returns just the boolean.

## Layout animations

`layout` animates any change to position or size that results from layout —
flexbox reflow, grid changes, a class swap — without you knowing the values.

```jsx
<motion.div layout />                    // animate this element's own box
<motion.div layout="position" />         // position only, don't scale contents
<motion.div layout="size" />             // size only
```

`layoutId` links two *different* elements: when one unmounts and another with the
same `layoutId` mounts, Motion animates between their boxes. This is how
shared-element and "magic move" transitions are built.

Practical notes:

- Layout animations use transforms, so children get distorted. Give children
  their own `layout` prop to correct them.
- `borderRadius` and `boxShadow` are scale-corrected automatically **only** when
  set via `style`, not via CSS classes.
- Inside a scrollable container, add `layoutScroll` so measurements account for
  scroll offset. Inside a fixed/transformed ancestor, `layoutRoot` does the same.
- Wrap groups in `LayoutGroup` when elements in separate components must
  re-measure together.

## Drag

```jsx
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 300 }}
  dragElastic={0.2}
  dragMomentum
/>
```

`drag` takes `true`, `"x"`, or `"y"`. `dragConstraints` accepts pixel bounds or a
ref to an element to stay inside. `dragElastic` (0–1) controls pull past the
bounds. `useDragControls()` lets a different element start the drag:

```jsx
const controls = useDragControls()
<div onPointerDown={(e) => controls.start(e)} />
<motion.div drag dragListener={false} dragControls={controls} />
```

## Reorder

Drag-to-reorder lists, exported as a namespace with `Group` and `Item`:

```jsx
<Reorder.Group axis="y" values={items} onReorder={setItems}>
  {items.map((item) => (
    <Reorder.Item key={item.id} value={item}>{item.label}</Reorder.Item>
  ))}
</Reorder.Group>
```

`values` must be the same array you re-render from, and `onReorder` receives the
new order — treat it like a controlled input.

## Motion values

Created with `useMotionValue(initial)`. Methods: `get()`, `set()`, `jump()`
(set without triggering springs/listeners that interpolate), `on("change", cb)`,
`getVelocity()`, `isAnimating()`, `stop()`.

Pass them through `style` to bind them to the DOM without re-rendering:

```jsx
const x = useMotionValue(0)
const background = useTransform(x, [-100, 0, 100], ["#f00", "#fff", "#0f0"])
<motion.div style={{ x, background }} drag="x" />
```

To read one in React state (accepting the re-render), use `useMotionValueEvent`:

```jsx
useMotionValueEvent(scrollY, "change", (latest) => setHidden(latest > 100))
```

## Hooks

**Values and derivation**

| Hook | Returns |
| --- | --- |
| `useMotionValue(initial)` | A `MotionValue` |
| `useTransform(value, inputRange, outputRange, options?)` | Mapped value; also accepts a function form `useTransform(() => ...)` |
| `useSpring(source, springOptions?)` | Value that springs toward `source` |
| `useMotionTemplate` | Tagged template combining values: `` useMotionTemplate`blur(${v}px)` `` |
| `useVelocity(value)` | Rate of change |
| `useTime()` | Milliseconds since mount, updating every frame |
| `useFollowValue(source, options?)` | Value that follows another with configurable lag |
| `useWillChange()` | Managed `will-change` string |

**Scroll and viewport**

`useScroll(options?)` returns `{ scrollX, scrollY, scrollXProgress, scrollYProgress }`.
Options: `container` (ref), `target` (ref), `offset` (e.g. `["start end", "end start"]`),
`axis`, `layoutEffect`.

`useInView(ref, options?)` returns a plain boolean — useful when you want React
state rather than the declarative `whileInView`. Options: `once`, `amount`,
`margin`, `root`.

**Animation control**

| Hook | Purpose |
| --- | --- |
| `useAnimate()` | `[scope, animate]` for imperative, scoped animation |
| `useAnimateMini()` | Same, WAAPI-only and much smaller |
| `useAnimationFrame(cb)` | Per-frame callback `(time, delta)` |
| `useCycle(...states)` | `[current, cycle]` for stepping through states |
| `useDragControls()` | Programmatic drag start |
| `useAnimation()` / `useAnimationControls()` | Legacy controls object; `useAnimate` is preferred for new code |

**Presence and accessibility**

`usePresence()`, `useIsPresent()`, `usePresenceData()`, `useReducedMotion()`,
`useReducedMotionConfig()`.

## Imperative animation with useAnimate

`useAnimate` gives a `scope` ref and an `animate` function whose selectors are
scoped to that subtree — so `"li"` means "the list items inside this component",
not every `li` on the page. It also cancels animations automatically on unmount.

```jsx
const [scope, animate] = useAnimate()

async function run() {
  await animate(scope.current, { opacity: 1 })
  await animate("li", { x: 0 }, { delay: stagger(0.1) })
}

return <ul ref={scope}>{/* ... */}</ul>
```

Sequences are arrays, where `"<"` starts with the previous segment and a number
offsets from it:

```js
animate([
  ["#a", { opacity: 1 }, { duration: 0.3 }],
  ["#b", { x: 100 }, { at: "<" }],
  ["#c", { scale: 1 }, { at: 0.5 }],
])
```

## MotionConfig and LayoutGroup

`MotionConfig` sets defaults for the whole subtree — a single place to change
transition feel or honour reduced motion:

```jsx
<MotionConfig transition={{ duration: 0.4 }} reducedMotion="user">
  <App />
</MotionConfig>
```

`reducedMotion` takes `"user"`, `"always"`, or `"never"`.

`LayoutGroup` makes layout animations in sibling components measure together,
and namespaces `layoutId`s so two independent lists don't collide.
