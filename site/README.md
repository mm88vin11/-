# site/

`index.html` is the lllbaza.ru page in its source form — the `<x-dc>` template plus the
`class Component extends DCLogic` script, exactly as the builder exports it. Asset UUIDs
are untouched, so the file can be pasted back into the builder as-is.

`AUDIT.md` is the audit that produced the current state: what was broken, what changed,
what was deliberately left alone, and how it was verified.

`bundle.js` rebuilds the standalone file you can open by double-clicking.

## Getting a file that opens

`index.html` on its own does **not** open in a browser — it needs the builder runtime,
React, and its images resolved by UUID. To get a standalone page, fold it back into a
builder export:

```bash
node site/bundle.js path/to/original-export.html baza-site.html
```

The export carries the unpacker and every asset inline; the script swaps only the page
payload and leaves the rest untouched, so the result opens straight from disk exactly
like the original. It verifies the payload round-trips before writing, and it escapes
`</` in the payload — without that the HTML parser closes the `<script>` tag at the
first `</script>` inside the page and the unpacker dies on truncated JSON.

Rendering still fetches Babel from unpkg at runtime, so the first open needs a network
connection. That is true of the builder's own export too.

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
