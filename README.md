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

## Layout

```
.claude/skills/     10 skills
.mcp.json           21st.dev MCP server (key via ${TWENTYFIRST_API_KEY})
.env.example        template for the key
CLAUDE.md           repo conventions
```
