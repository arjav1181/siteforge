# `siteforge agent`

Describe the job in a sentence. SiteForge picks a coding agent, writes it a
briefing that already contains this toolkit, and opens that agent's session with
the task loaded.

```bash
siteforge agent list
siteforge agent "build me a landing page for a coffee roastery"
siteforge agent "add a pricing section" --agent opencode --dir my-site
siteforge agent "audit and fix the mobile overflow" --read-only
siteforge agent "build me a site" --headless --no-stream
```

| Option | Effect |
|---|---|
| `--agent <id>` | claude, opencode, codex, gemini, aider, cursor, pi |
| `--dir <path>` | hand off in another directory |
| `--model <name>` | pass a model through |
| `--read-only` | plan mode; may not create or edit files |
| `--no-context` | send the bare task, no briefing |
| `--headless` | one task and exit, instead of opening a session |
| `--no-stream` | don't render live progress (headless only) |
| `--dry-run` | print the exact command, run nothing |

`siteforge agent` on its own lists what is installed. `--json` works like every
other command.

## The briefing is the feature

Anyone can run `claude "do my laundry"`. What an agent cannot work out on its
own is that this toolkit exists, what its commands are called, which skills were
just installed for it, and what the house style is. That is what SiteForge adds:

- the toolkit commands **in build order** — scaffold → compose → assets → verify
- every installed skill by name, so it reads the recipe before using a command
- what it can see of the repo: bun/npm/pnpm, Next.js, Tailwind, TypeScript,
  whether it is a git repo, whether the directory is empty
- the project's own `AGENTS.md`, `CLAUDE.md` or `FORGE.md`
- house style — Tailwind only, 4:4:4 chroma, real copy rather than lorem ipsum,
  and **run `siteforge audit --fix` before calling it done**

Read the whole thing before sending it:

```bash
siteforge agent prompt "build me a landing page" --agent claude
```

## What gets run

Claude Code, OpenCode and Codex are first-class. Each is opened the way its own
CLI expects, not the way a generic wrapper would guess:

| Agent | Session | Headless | Write access |
|---|---|---|---|
| Claude Code | `claude "<briefing>"` | `claude -p … --output-format stream-json --verbose` | `--permission-mode acceptEdits` |
| OpenCode | `opencode --prompt "<briefing>"` | `opencode run … --format json` | `--auto` |
| Codex | `codex "<briefing>"` | `codex exec … --json` | `--sandbox workspace-write` |

`--read-only` swaps in each agent's plan mode: `plan`, no `--auto`, and
`--sandbox read-only`.

SiteForge never uses a blanket permission bypass — `bypassPermissions`,
`--yolo` and `danger-full-access` are never emitted. It grants edit access, not
the machine, and that is asserted in the test suite so a future flag change
cannot quietly widen it.

## Headless

```bash
siteforge agent "add a pricing section" --headless --no-stream
```

Runs one task and exits, for scripts and CI. Progress renders live unless
`--no-stream`. Output is captured, parsed on a best-effort basis per agent, and
the raw lines are always kept — so `--json` stays trustworthy even when the
pretty view has nothing to render.

The parsing is defensive on purpose: these event formats are unversioned and
change between agent releases, so anything unrecognised is dropped from the
pretty view rather than guessed at. Lines that are not JSON at all are passed
through — that is the agent talking, and silence would look like a hang.

## When no agent is installed

```bash
$ siteforge agent "build me a site"
✗ No coding agent found on PATH. Install one of:
  Claude Code    npm i -g @anthropic-ai/claude-code
  OpenCode       npm i -g opencode-ai
  Codex          npm i -g @openai/codex
```

Naming one that is not installed gives the install line for that agent
specifically, not a generic message.

## Over MCP

`hand_off_to_agent` is exposed to agents driving SiteForge over MCP. It always
runs with streaming off, because stdio belongs to the protocol.

```json
{ "task": "add a pricing section", "dir": "my-site", "readOnly": false }
```