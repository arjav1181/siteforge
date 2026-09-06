---
name: siteforge-ops
description: Toolkit maintenance via `siteforge skills|assets|doctor|update|agents|completion|mcp`: install agent skills (Claude/Cursor/OpenCode/Codex/Aider/Pi), batch-compress images, env doctor, self-update, AGENTS.md generation, shell completion, MCP server. Use for setup, hygiene, and agent wiring.
---

# siteforge ops

```bash
siteforge skills install [--agent claude,cursor,opencode,codex,aider,pi] [--global]
siteforge assets public --dry-run        # then without --dry-run to apply
siteforge doctor                          # env report per command
siteforge update                          # latest published version
siteforge demo [dir]                      # instant sample site, no files needed
siteforge agents init                     # repo conventions for agents
siteforge mcp                             # stdio tools for agents
```

Skills install as SKILL.md per agent convention (Cursor gets `.mdc` rule
files); paths print as they land — move them if an agent changes layout.
`assets` rewrites jpg/png/webp in place (default q80, max-width 1920) —
commit first, preview with `--dry-run`. `doctor` is the first thing to run
when any command complains about its environment.

## Examples

- `siteforge skills install --agent claude --global`
- `siteforge assets public --dry-run` then apply
- `siteforge agents init` writes repo conventions for agents
- Anything odd: `siteforge doctor` first
