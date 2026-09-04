# Motion — Migration and deprecated APIs

Reflects the export surface of v13.2.0.

## Framer Motion → Motion

The project was renamed; the code is the same lineage. `framer-motion` is still
published and still works, so migration is a rename rather than a rewrite:

```diff
- import { motion, AnimatePresence } from "framer-motion"
+ import { motion, AnimatePresence } from "motion/react"
```

`motion/react` re-exports the whole of `framer-motion`, so a project-wide
find-and-replace of the import path is normally the entire job.

The one thing that catches people: `framer-motion` had a single entry point,
while `motion` splits React and vanilla. `import { motion } from "motion"` gives
you the *vanilla* module, which has no `motion.div`. React code needs
`motion/react`.

## Still exported, but deprecated

These remain in v13 for compatibility. Don't reach for them in new code, and
replace them when touching old code:

| Deprecated | Use instead |
| --- | --- |
| `AnimateSharedLayout` | `LayoutGroup`, or just `layoutId` — shared layout is built into `motion` components now |
| `useDeprecatedAnimatedState` | `useMotionValue` + `useTransform`, or `useAnimate` |
| `useDeprecatedInvertedScale` | The `layout` prop, which corrects scale distortion automatically |
| `DeprecatedLayoutGroupContext` | `LayoutGroupContext` |
| `useElementScroll(ref)` | `useScroll({ container: ref })` |
| `useViewportScroll()` | `useScroll()` |
| `motion(Component)` | `motion.create(Component)` — the call form logs a deprecation warning in development |

## The `delay` unit trap

There are three `delay`s and they do not agree on units:

| Where | Unit |
| --- | --- |
| `delay` imported from `motion` (vanilla) | **seconds** |
| `delay` imported from `framer-motion` root | **milliseconds** |
| The `delay` option inside any transition | **seconds** |

The millisecond version is deliberate backwards compatibility with Framer, not a
bug. If a delay is off by 1000×, this is why.

## Other renames worth knowing

- `whileTap` is the current name for the press gesture prop; there is no
  `whilePress` on components. The *vanilla* helper is called `press`.
- `Reorder` is a namespace: `Reorder.Group` and `Reorder.Item`.
- `useAnimation` / `useAnimationControls` still work, but `useAnimate` is the
  current imperative API — it scopes selectors to a subtree and cleans up on
  unmount, which the older controls object does not.
- Transform shorthands (`x`, `y`, `scale`, `rotate`) belong in `style` or
  `animate`, not in a CSS `transform` string. Motion composes them independently,
  which is what allows them to animate with separate transitions.

## Version note

If you are reading this against a much newer Motion than 13.2.0, treat the
option names here as a starting point and verify against the installed package —
`node -p "require('motion/package.json').version"` — since Motion adds options
between minors.
