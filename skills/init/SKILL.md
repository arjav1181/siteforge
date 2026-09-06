---
name: siteforge-init
description: Start a guided new site with `siteforge init` (or bare `siteforge` wizard). Use when the user wants a full site scaffolded interactively — video background plus chosen sections and effects.
---

# siteforge init

```bash
siteforge init
siteforge init --video intro.mp4 --dir my-site --fps 30 \
  --sections hero,navbar,work,contact --fx fx:cursor,fx:marquee
```

Interactive prompts cover anything flags don't. Flow: video pipeline (install
runs, build skipped for speed) → chosen `add` sections → chosen `fx`/`3d`
entries → shared CSS ensured. Finish by importing components in
`src/app/page.tsx`, running dev, then `siteforge audit` → `siteforge ship`.

Bare `siteforge` opens the same wizard menu for every other command
(add/fx/record/audit/ship/skills/doctor). Non-TTY shells must pass flags —
prompts refuse to guess.
