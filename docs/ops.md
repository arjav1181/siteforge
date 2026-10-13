# Toolkit ops: `skills` · `assets` · `dewatermark` · `agent` · `doctor` · `update`

```bash
siteforge demo [dir]  # sample site from a generated clip
siteforge skills install [--agent claude,cursor,opencode,codex,aider,pi] [--global]
siteforge assets public [--format webp] [--quality 80] [--max-width 1920] [--dry-run]
siteforge dewatermark public [--box=x,y,w,h] [--auto] [--yes]
siteforge agent "<task>" [--agent claude|opencode|codex] [--read-only] [--headless]
siteforge doctor
siteforge update
```

Skills land per agent convention (`.claude/skills`, `.cursor/rules/*.mdc`,
`.opencode/skills`, `.codex/skills`, `.aider/skills`, `.pi/skills`; `~`
variants with `--global`). `assets` rewrites images in place — `--dry-run`
first, commit before applying. `dewatermark` never overwrites: a file becomes
`<name>.clean.png`, a directory becomes `<dir>-clean/`, and one `--box` covers
the whole batch at each file's own resolution — see
[dewatermark.md](dewatermark.md). `agent` hands a described job to your coding
agent with the toolkit already briefed — see [agent.md](agent.md). `doctor`
maps every check to the commands that need it; run it first when the
environment complains. It checks auth *state*, not just presence — a `gh` that
is installed but signed out reports as failing, because that is exactly the
state in which `ship` will fail.
