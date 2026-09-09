# Project conventions

## Communication

Write the final summary of any piece of work in Russian (Итог/резюме в конце
ответа — на русском). Code, identifiers, commit messages, file contents, and
anything committed to the repository stay in English; this applies to the
summary addressed to the user, not to the artifacts.

## Layout

- `site/` — the БАЗА site (Vite + TypeScript). Before touching anything under
  `site/src`, read the `perf-guard` skill; before touching styling, markup or
  copy, read `world-spec`. Run `npm run guard` in `site/` before every commit —
  it fails on a breach of the performance contract rather than leaving it to be
  noticed later.
- `.claude/skills/` — installed skills, one directory per skill. Each directory
  name matches the `name:` field in its `SKILL.md` frontmatter; keep them in sync
  when adding or renaming a skill.
- `.mcp.json` — project-scoped MCP servers. This repository is public, so secrets
  are injected through `${ENV_VAR}` placeholders and never committed. `.env.example`
  lists the variables that need to be set.
