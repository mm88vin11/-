# Project conventions

## Communication

Write the final summary of any piece of work in Russian (Итог/резюме в конце
ответа — на русском). Code, identifiers, commit messages, file contents, and
anything committed to the repository stay in English; this applies to the
summary addressed to the user, not to the artifacts.

## Layout

- `.claude/skills/` — installed skills, one directory per skill. Each directory
  name matches the `name:` field in its `SKILL.md` frontmatter; keep them in sync
  when adding or renaming a skill. Vendored skills are renamed to satisfy this,
  so a directory here may differ from its upstream folder name.
- `.claude/agents/` — agents a skill hands work to, named after the skill that
  calls them.
- `site/` — the lllbaza.ru landing page: `src/` is the source, `build.py` produces
  the uploadable `dist/`. See `site/README.md`.
- `.mcp.json` — project-scoped MCP servers. This repository is public, so secrets
  are injected through `${ENV_VAR}` placeholders and never committed. `.env.example`
  lists the variables that need to be set.
