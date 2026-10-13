# Toolkit ops: `skills` · `assets` · `dewatermark` · `doctor` · `update`

```bash
siteforge demo [dir]  # sample site from a generated clip
siteforge skills install [--agent claude,cursor,opencode,codex,aider,pi] [--global]
siteforge assets public [--format webp] [--quality 80] [--max-width 1920] [--dry-run]
siteforge dewatermark public [--box=x,y,w,h] [--auto] [--yes]
siteforge doctor
siteforge update
```

Skills land per agent convention (`.claude/skills`, `.cursor/rules/*.mdc`,
`.opencode/skills`, `.codex/skills`, `.aider/skills`, `.pi/skills`; `~`
variants with `--global`). `assets` rewrites images in place — `--dry-run`
first, commit before applying. `dewatermark` never overwrites: a file becomes
`<name>.clean.png`, a directory becomes `<dir>-clean/`, and one `--box` covers
the whole batch at each file's own resolution — see
[dewatermark.md](dewatermark.md). `doctor` maps every check to the commands
that need it; run it first when the environment complains.
