# `siteforge agents` (+ `completion`)

```bash
siteforge agents                 # print detected stack
siteforge agents init [--force]  # write AGENTS.md conventions
siteforge completion bash|zsh|fish
```

Detection reads `package.json` (frameworks, styling, testing, scripts),
lockfiles (bun/pnpm/npm/yarn → manager), and `tsconfig.json` (strict?).
`agents init` writes `AGENTS.md`: stack bullets, install/dev/build/test/lint
commands resolved through your manager, and working agreements (mobile-first,
strict TS, verify-by-running, conventional commits). Refuses to overwrite
without `--force`.

Completion install:

```bash
eval "$(siteforge completion bash)"                                   # bash
siteforge completion zsh > ~/.zsh/completions/_siteforge             # zsh
siteforge completion fish > ~/.config/fish/completions/siteforge.fish # fish
```
