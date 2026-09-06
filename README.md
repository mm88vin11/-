# Claude Code environment: skills + MCP servers

This repository carries a Claude Code setup: **10 skills** under `.claude/skills/`
and the **21st.dev MCP server** in `.mcp.json`. Everything here is project-scoped,
so it loads automatically for anyone who opens this repo in Claude Code.

## Setup

The MCP server needs one API key. It is **not** stored in this repo (the repo is
public), so export it before starting Claude Code:

```bash
export TWENTYFIRST_API_KEY=21st_sk_xxxxxxxx   # get one at https://21st.dev/mcp
claude
```

On first run Claude Code asks you to approve the project-scoped server; approve it once.

Verify:

```bash
claude mcp list     # 21st should report "Connected"
```

If it reports `Missing environment variables: TWENTYFIRST_API_KEY`, the variable
is not exported in the shell that launched Claude Code.

## MCP servers

| Server | Transport | Endpoint |
| --- | --- | --- |
| `21st` | HTTP | `https://21st.dev/api/mcp` |

Provides 20 tools for the 21st.dev catalog: `search`, `get_component`, `get_theme`,
`get_inspiration`, `search_logo`, `generate` (21st AI), bookmark and team-library
tools, and `get_usage` for quota.

### A note on the `magic` server

`@21st-dev/magic` is **not** installed here, deliberately. That npm package now
describes itself as *"Magic MCP is now the 21st MCP. This package is a compatibility
proxy kept for old configs."* It proxies to the same 21st.dev service the `21st`
server above already talks to, so installing both would register two sets of
duplicate tools against one account.

If you specifically need the legacy stdio server anyway:

```bash
claude mcp add magic -s user -e API_KEY=21st_sk_xxxxxxxx -- npx -y @21st-dev/magic
```

## Skills

### From [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (v2.13.0, MIT)

The plugin ships seven skills; all are installed.

| Skill | What it covers |
| --- | --- |
| `ui-ux-pro-max` | Core design intelligence — 79 styles, 192 palettes, 74 font pairings, 119 UX guidelines, 25 chart types, 22 stacks |
| `ui-styling` | Building interfaces with shadcn/ui + Radix |
| `design` | Umbrella skill: brand identity, tokens, styling, logo generation |
| `design-system` | Three-layer token architecture and component specs |
| `brand` | Brand voice, visual identity, messaging frameworks |
| `slides` | HTML presentations with Chart.js and design tokens |
| `banner-design` | Social, ad, hero, and print banners |

### From [motiondivision/motion](https://github.com/motiondivision/motion) (MIT)

Motion is the animation library, not a skill — but its repo vendors two
general-purpose agent skills under `.agents/skills/`, and those are what is
installed here:

| Skill | What it covers |
| --- | --- |
| `improve` | Read-only codebase audit that produces prioritized implementation plans for other agents. Vendored by Motion from `shadcn/improve` |
| `fix` | Executor counterpart: takes an issue, PR, or plan file and drives it to a merge-ready PR |

`fix` assumes a `gh`-style PR workflow and a repo `CLAUDE.md`; it was written for
Motion's contributor loop, so review its steps before pointing it at this repo.

### Written for this repo

| Skill | What it covers |
| --- | --- |
| `motion` | Reference for the Motion animation library itself (v13.2.0) — the React API, the vanilla JS API, transitions and springs, performance, and migration from Framer Motion |

`motion` is a reference skill, not a vendored one: its API surface was extracted
from the v13.2.0 source (entry points, exported symbols, option types, and the
repo's own bundle-size budgets) rather than written from memory. `SKILL.md` holds
the mental model and the common recipes; the detail lives in `references/` and is
read only when a task needs it.

To refresh it against a newer Motion, re-derive from the tag rather than editing
by hand — the export surface is the source of truth.

## The БАЗА site

`index.html` at the repo root is the БАЗА landing page — a static, dependency-free
single page. Open the file directly, or serve the folder:

```bash
python3 -m http.server 8000   # then http://localhost:8000
```

It is built as an arcade: nine "worlds", each with its own background, typography,
scroll behaviour and one thing you can actually play with.

| World | Section | The interaction |
| --- | --- | --- |
| 0 | Hero | Parallax starfield + retro grid floor, typewriter pitch, world picker |
| 1 | О нас | Four Pac-Man ghosts — tick the ones you recognise, the cabinet scores them |
| 2 | Кто это делает | Fighting-game roster: pick a way to close the task, see what it costs |
| 3 | Услуги | Mario `?` blocks — hit one, a coin pops and the direction opens |
| 4 | Цены | A Tetris well that stacks to the level you pick on the fork slider |
| 5 | Карта маршрута | Swamp with a trail that draws itself as you scroll |
| 6 | Проекты | Arcade cabinet: swap cartridges, the CRT renders a stylised UI mock |
| 7 | География | Radar sweep over a schematic world map, 19 cities |
| 8 | Бриф | A terminal that answers as you fill it in and prices the job live |

Between worlds the transitions are part of the design: a Mario warp pipe, a Tetris
line clear, a swamp drip. The nav also plays a pixel-block wipe between sections.

### Structure

```
index.html            markup + SEO + no-JS fallback
assets/css/fonts.css  self-hosted subsets (no third-party font request)
assets/css/base.css   tokens, reset, typography, reveal engine
assets/css/chrome.css header, nav, menu, HUD, level transitions, boot
assets/css/worlds-a.css  hero · Pac-Man · VS select · Mario
assets/css/worlds-b.css  Tetris · swamp · cabinet · radar · terminal · credits
assets/js/data.js     every piece of copy the page renders at runtime
assets/js/app.js      one rAF loop drives all canvas scenes; the rest is events
assets/fonts/         Manrope, Unbounded, Pixelify Sans, Russo One, JetBrains Mono
assets/img/           brand lockups
```

Notes on how it behaves:

- **No build step, no runtime dependencies.** Plain HTML, CSS and one script.
- **Fonts are vendored** (cyrillic + latin subsets only) so the page makes no
  request to Google and renders identically offline.
- **Every scene pauses off screen** and every animation is transform/opacity only.
- **`prefers-reduced-motion` is honoured**: animations collapse, nothing is hidden.
- **Without JavaScript** the boot overlay lifts, the containers the runtime fills
  are hidden, and a notice with prices and the Telegram contact takes their place.
- **The brief keeps a local draft** in `localStorage` and hands the assembled lead
  to Telegram — no endpoint or token is committed to this public repo.

## Layout

```
index.html          the БАЗА landing page
assets/             its css, js, fonts and images
.claude/skills/     10 skills
.mcp.json           21st.dev MCP server (key via ${TWENTYFIRST_API_KEY})
.env.example        template for the key
CLAUDE.md           repo conventions
```
