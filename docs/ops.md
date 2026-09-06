# Toolkit ops: `skills` · `assets` · `doctor` · `update`

```bash
siteforge demo [dir]  # sample site from a generated clip
siteforge skills install [--agent claude,cursor,opencode,codex,aider,pi] [--global]
siteforge assets public [--format webp] [--quality 80] [--max-width 1920] [--dry-run]
siteforge doctor
siteforge update
```

Skills land per agent convention (`.claude/skills`, `.cursor/rules/*.mdc`,
`.opencode/skills`, `.codex/skills`, `.aider/skills`, `.pi/skills`; `~`
variants with `--global`). `assets` rewrites images in place — `--dry-run`
first, commit before applying. `doctor` maps every check to the commands that
need it; run it first when the environment complains.
