---
name: siteforge-ops
description: Install toolkit skills, optimize images, check the machine, and self-update (`siteforge skills|assets|doctor|update`). Use for setup, maintenance, and pre-ship hygiene.
---

# siteforge ops

```bash
siteforge skills install [--agent claude,cursor,opencode,codex,aider,pi] [--global]
siteforge assets public --dry-run        # then without --dry-run to apply
siteforge doctor                          # env report per command
siteforge update                          # latest published version
```

Skills install as SKILL.md per agent convention (Cursor gets `.mdc` rule
files); paths print as they land — move them if an agent changes layout.
`assets` rewrites jpg/png/webp in place (default q80, max-width 1920) —
commit first, preview with `--dry-run`. `doctor` is the first thing to run
when any command complains about its environment.
