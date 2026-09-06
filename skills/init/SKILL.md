---
name: siteforge-init
description: Scaffold a complete new site interactively via `siteforge init` (or bare `siteforge` wizard): video background plus chosen sections and effects. Use when the user wants a full site generated in one guided flow.
---

# siteforge init

```bash
siteforge init
siteforge init --video intro.mp4 --dir my-site --fps 30 \
  --sections hero,navbar,work,contact --fx fx:cursor,fx:marquee
```

Prompts cover headline, subline, email, GitHub plus anything flags don't.
Output arrives with YOUR content baked in (no YOUR NAME placeholders):
hero copy replaced, contact wired to your email/GitHub, layout title set,
picked sections imported + rendered, `FORGE.md` guide included. Flow: video
pipeline (install runs, build skipped) → compose → fx. Finish with dev,
then `siteforge audit` → `siteforge ship`.

Bare `siteforge` opens the same wizard menu for every other command
(add/fx/record/audit/ship/skills/doctor). Non-TTY shells must pass flags —
prompts refuse to guess.

## Examples

- `siteforge init --video intro.mp4 --dir site --sections hero,navbar,work --fx fx:cursor`
- Bare `siteforge` → menu → 1 → answer prompts
- Non-TTY shells must pass flags (prompts refuse to guess)
