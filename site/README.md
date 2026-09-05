# site/

`index.html` is the lllbaza.ru page in its source form — the `<x-dc>` template plus the
`class Component extends DCLogic` script, exactly as the builder exports it. Asset UUIDs
are untouched, so the file can be pasted back into the builder as-is.

`AUDIT.md` is the audit that produced the current state: what was broken, what changed,
what was deliberately left alone, and how it was verified.

## Previewing it locally

The page loads React and Babel from unpkg at runtime and resolves its images by UUID
through the builder runtime, so it does not open straight from disk. To preview, unbundle
the builder's `.html` export (manifest → assets, template → page), rewrite the UUID
references to the extracted paths, and serve the directory over HTTP.

## Editing

Everything is inline styles produced by `renderVals()`; there is no stylesheet to edit
beyond the small global `<style>` block near the top of the file. Two conventions worth
knowing before changing anything:

- **Per-frame work goes through the rAF loop in `step()`**, and writes to the DOM through
  the `setO` / `setT` helpers, which skip the write when the value has not changed.
  Anything that changes on scroll belongs there, not in React state — a `setState` per
  scroll frame will jank the image sequence.
- **`state` is for things that change on interaction**, and every visual consequence of it
  is computed in `renderVals()`.
