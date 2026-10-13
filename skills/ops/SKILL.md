---
name: siteforge-ops
description: Toolkit maintenance via `siteforge skills|assets|dewatermark|doctor|update|agents|completion|mcp`: install agent skills (Claude/Cursor/OpenCode/Codex/Aider/Pi), batch-compress images, remove watermarks from assets, env doctor, self-update, AGENTS.md generation, shell completion, MCP server. Use for setup, hygiene, and agent wiring.
---

# siteforge ops

```bash
siteforge skills install [--agent claude,cursor,opencode,codex,aider,pi] [--global] [--oss]
siteforge assets public --dry-run        # then without --dry-run to apply
siteforge dewatermark public --box=x,y,w,h  # watermark removal, see dewatermark skill
siteforge doctor                          # env report per command
siteforge update                          # latest published version
siteforge demo [dir]                      # instant sample site, no files needed
siteforge agents init                     # repo conventions for agents
siteforge mcp                             # stdio tools for agents
```

Skills install as whole folders per agent convention (references ride along).
Add --oss for the submodule collections (anthropics, superpowers). (Cursor gets `.mdc` rule
files); paths print as they land — move them if an agent changes layout.
`assets` rewrites jpg/png/webp in place (default q80, max-width 1920) —
commit first, preview with `--dry-run`. `dewatermark` never overwrites and
solves the mark out rather than blurring it; always check its `residual` count
is 0 before calling an asset clean. `doctor` is the first thing to run
when any command complains about its environment.

## Examples

- `siteforge skills install --agent claude --global`
- `siteforge assets public --dry-run` then apply
- `siteforge dewatermark public --box=1600,880,180,180 --yes`
- `siteforge agents init` writes repo conventions for agents
- Anything odd: `siteforge doctor` first
