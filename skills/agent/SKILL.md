---
name: siteforge-agent
description: Hand a site-building job to the user's coding agent (Claude Code, OpenCode or Codex) with the SiteForge toolkit already briefed, via `siteforge agent`. Use when the request is "build me a site", "add a section", "fix the mobile overflow" — anything an agent should do in the repo rather than the CLI doing directly.
---

# siteforge agent

```bash
siteforge agent list
siteforge agent "build me a landing page for a coffee roastery"
siteforge agent "add a pricing section" --agent opencode --dir my-site
siteforge agent "audit and fix mobile overflow" --read-only
siteforge agent "build me a site" --headless --no-stream
```

Describe the job in a sentence. SiteForge picks an agent, writes it a briefing
that already contains the toolkit, the skills and the house style, and opens
that agent's session with the task loaded. You pick the conversation up from
there — SiteForge's job ends when the session opens.

Claude Code, OpenCode and Codex are first-class: auto-detected, and given file
write access via each one's own mechanism. Everything else works too where the
CLI supports it.

## The briefing is the feature

Anyone can run `claude "do my laundry"`. What SiteForge adds is the context the
agent cannot get on its own:

- the toolkit commands, **in build order** — scaffold → compose → assets → verify
- every installed skill, by name, so it reads the recipe before using a command
- what it can see of the repo (bun/npm, next, tailwind, git, is it empty)
- the project's own `AGENTS.md` / `CLAUDE.md` / `FORGE.md`
- house style: Tailwind only, 4:4:4 chroma, real copy not lorem ipsum, and
  **run `siteforge audit --fix` before calling it done**

See the whole thing with `siteforge agent prompt "<task>"`.

## Options worth knowing

| Flag | Effect |
|---|---|
| `--agent <id>` | pick a specific agent instead of the first installed |
| `--dir <path>` | hand off in another directory |
| `--read-only` | plan mode; the agent cannot create or edit files |
| `--no-context` | send the bare task with no briefing |
| `--headless` | run one task and exit, instead of opening a session |
| `--dry-run` | print the exact command, run nothing |

Permission note: `--read-only` maps to `claude --permission-mode plan`,
`opencode` without `--auto`, and `codex --sandbox read-only`. SiteForge never
uses a blanket bypass (`bypassPermissions` / `--yolo` / `danger-full-access`) —
it grants edit access, not the machine.

## Examples

- New site: `siteforge agent "build a landing page for Ember, a coffee roastery"`
- Target one repo: `--dir my-site`
- Ask before it writes: `--read-only`
- In CI: `--headless --no-stream --agent codex`