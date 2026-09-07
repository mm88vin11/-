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

`index.html` at the repo root is the БАЗА landing page — a static,
dependency-free single page. Open the file directly, or serve the folder:

```bash
python3 -m http.server 8000   # then http://localhost:8000
```

`dist/baza-arcade.html` is the same page as **one standalone file** with the
CSS, JS, fonts and images inlined. It opens straight from the filesystem and
makes no network request at all. Rebuild it after any edit:

```bash
node build.js                 # → dist/baza-arcade.html
```

### Ten worlds, one continuous scroll

Each section is a universe most people recognise on sight, and each has one
thing you can actually play with.

| # | World | Section | What you can do |
| --- | --- | --- | --- |
| 0 | **Flappy Bird** | Первый экран | The bird flies the gaps as you scroll; click, tap or hit space to flap |
| 1 | **Pac-Man** | О нас | Tick a symptom and Pac-Man eats that ghost on the backdrop; the cabinet scores it |
| 2 | **Mortal Kombat** | Кто это делает | Pick a fighter, the health bars drain by the honest count of drawbacks, "Finish him" names the worst one |
| 3 | **Super Mario** | Услуги | Hit a `?` block — Mario runs to it on the brick floor, jumps, and a coin pops |
| 4 | **Tetris** | Цены | A real playable well: arrows / swipe / on-screen pad; clearing lines raises the budget tier |
| 5 | **Shrek** | Маршрут | "Ogres are like onions" — peel the onion layer by layer, each layer opens a stage of the work |
| 6 | **Game Boy** | Проекты | A DMG console: cartridges boot, the d-pad flips projects, A opens the owner's review |
| 7 | **Indiana Jones** | География | Click a city and a red dashed line flies a plane there across an aged paper map |
| 8 | **The Matrix** | Бриф | Code rain, a red pill / blue pill choice, and a terminal that answers as you fill it in |
| 9 | **Star Wars** | Финал | The opening crawl, in real 3D perspective, driven by scroll |

### Why there are no visible section edges

Backgrounds do not live inside their sections. All ten skies sit in one fixed
layer stack (`assets/css/sky.css`) behind the page, and the scroll position
cross-fades between them — so one universe dissolves into the next with no
boundary line anywhere. A single shared canvas paints the particle scene for
whichever world you are in, plus the one you are dissolving into, at the same
alphas.

Transitions that land exactly on a crossover get their own prop: **FIGHT!**
flashes between Pac-Man and Mortal Kombat, the pea-green **LCD wash** fires as
the Game Boy powers on, and **«Давным-давно, в далёкой-далёкой галактике…»**
appears just before the crawl rises.

### Structure

```
index.html            markup + SEO + no-JS fallback
build.js              inlines everything into dist/baza-arcade.html
assets/css/fonts.css  self-hosted subsets (no third-party font request)
assets/css/base.css   tokens, reset, typography, reveal engine
assets/css/sky.css    the cross-faded world backdrop + transition props
assets/css/chrome.css header, nav, menu, HUD, warp curtain, boot
assets/css/worlds-a.css  Flappy · Pac-Man · Mortal Kombat · Mario
assets/css/worlds-b.css  Tetris · Shrek · Game Boy · map · Matrix · crawl
assets/js/data.js     every piece of copy the page renders at runtime
assets/js/scenes.js   the ten canvas scenes, one draw() each
assets/js/app.js      sky engine, one rAF loop, all interactions
assets/fonts/         Manrope, Unbounded, Pixelify Sans, Russo One, JetBrains Mono
assets/img/           brand lockups
```

Notes on how it behaves:

- **No build step to run it, no runtime dependencies.** Plain HTML, CSS and JS.
- **Fonts are vendored** (cyrillic + latin subsets only) so the page makes no
  request to Google and renders identically offline.
- **Two scenes at most per frame**, everything pauses off screen, and all
  animation is transform/opacity only.
- **`prefers-reduced-motion` is honoured**: animations collapse, nothing hides.
- **Without JavaScript** the boot overlay lifts on a failsafe timer, the
  runtime-filled containers are hidden, and a notice with prices and the
  Telegram contact takes their place.
- **The brief keeps a local draft** in `localStorage` and hands the assembled
  lead to Telegram — no endpoint or token is committed to this public repo.

## Layout

```
index.html          the БАЗА landing page
assets/             its css, js, fonts and images
build.js            single-file bundler
dist/               standalone build (baza-arcade.html)
.claude/skills/     10 skills
.mcp.json           21st.dev MCP server (key via ${TWENTYFIRST_API_KEY})
.env.example        template for the key
CLAUDE.md           repo conventions
```
