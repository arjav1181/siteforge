# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.7.0] — 2026-10-13

### Fixed
- `siteforge agent --headless --agent opencode` returned no output and no
  session id. OpenCode emits `{type, timestamp, sessionID, part:{type, text}}`
  — the text lives at `part.text`, not at the root, and the session key is
  `sessionID` with a capital D. The parser was written against a guessed shape
  and matched neither. Caught by running it against the real CLI; the fixtures
  are now its verbatim output
- `siteforge doctor` checked `gh --version` under a label reading
  "authenticated", so a signed-out `gh` looked healthy right up until a push
  failed. It now checks auth state and says what is wrong
- `siteforge doctor` ignored `dewatermark` and `agent` entirely, despite
  claiming to map every check to the commands that need it

### Added
- `doctor` reports the coding agents on PATH, and how to install one if there
  are none — the prerequisite for `siteforge agent`
- `doctor` renders through the shared table, so it respects `NO_COLOR` and
  lines up on narrow terminals instead of hard-coded ANSI

## [1.6.0] — 2026-10-13

### Added
- `siteforge agent "<task>"`: hand a job to the user's coding agent. Picks an
  agent (Claude Code, OpenCode or Codex first), writes a briefing containing
  the toolkit commands in build order, the installed skills, the repo it can see
  and the house style, then opens that agent's session with the task loaded
  - interactive is the default: `claude "<briefing>"`, `opencode --prompt …`,
    `codex "<briefing>"` — so you pick the conversation up from there
  - `--headless` for one-shot runs in CI; `--read-only` for each agent's own
    plan mode; `--dry-run` shows the exact command
  - every invocation read off the installed CLI's own `--help`, asserted in
    tests. Never emits `bypassPermissions` / `--yolo` / `danger-full-access` —
    it grants edit access, not the machine
  - `hand_off_to_agent` MCP tool; `agent` agent skill; docs/agent.md
- Release automation: `.github/workflows/publish.yml` publishes on a `v*` tag
  via npm trusted publishing (OIDC) — no `NPM_TOKEN` in this repo and none
  needed. Guards: the tag must match the `package.json` version, and the job
  skips if that version is already on npm. Re-runnable from the Actions tab,
  defaulting to verify-only
- `src/ui/`: terminal capability detection (`NO_COLOR`, `FORCE_COLOR`,
  `TERM=dumb`, non-TTY), braille spinners with elapsed time, live task lists,
  wrapping panels and aligned tables
- Arrow-key wizard menu with inline hints, replacing the numbered menu
  (`parseSelection` removed — it was dead once multiselect landed)

### Fixed
- CI runs `build` before `test`, and checks out submodules. Both were wrong, so
  six tests had been failing on every run of `main` since v1.4.0
- `siteforge --help` printed help and exited 1; the unknown-command branch
  swallowed it, which failed the CI smoke step
- `siteforge agent` no longer hangs when an agent binary disappears between
  detection and spawn — the spawn error was racing a pipe that never closed

## [1.5.0] — 2026-10-12

### Added
- `siteforge dewatermark`: solves watermarks out of images, frame directories
  and video by relaxing ∇²u = 0 from the surrounding pixels, coarse-to-fine —
  it reconstructs the background rather than blurring over it
  - browser box picker (drag, copy coordinates, paste back) plus an ASCII
    preview shown before every run
  - one `--box` covers a whole directory: re-expressed per file for that file's
    own resolution, so a hero and its thumbnail are both solved from one
    measurement
  - never overwrites — `<name>.clean.png` beside the source, `<dir>-clean/` for
    a directory, `<name>.clean.mp4` for video (audio copied, not dropped)
  - keeps source filename and format, so existing `<img src>` references
    resolve against the cleaned copy
  - reports `marked` / `residual` / `adjusted` separately, because "a mark was
    there" is not the same claim as "the mark is gone"
  - `remove_watermark` MCP tool
  - `dewatermark` agent skill, docs/dewatermark.md, completions (bash/zsh/fish)

### Changed
- `src/log.ts` exports `isJsonMode()` so commands that would prompt can stay
  non-blocking under `--json`

## [1.4.0] — 2026-09-06

### Added
- Universal agent track: OSS skill submodules (`anthropics/skills`,
  `obra/superpowers`) — recursive discovery, whole-folder copy, network
  fallback (GitHub tree API + tarballs) so npm installs get them too
- `siteforge run`: bundled everyday scripts (bigfiles, loc, todo-sweep,
  json-pretty, md-toc, port-kill with verify-before-kill safety)
- `siteforge serve` static preview server, `siteforge shot` screenshots
  (+ `take_screenshot` MCP tool)
- Skills: serve, shot, run (+ enriched ops skill)
- Docs: oss-skills.md; README universal-toolkit section

## [1.2.0] — 2026-09-06

### Added
- Content-aware `init`: headline/subline/email/GitHub baked in, sections
  auto-imported + rendered, custom-hero swap, `FORGE.md` in every project
- `siteforge demo`: instant sample site from a generated clip
- New sections: `features`, `cta`, `logos` (15 total); new fx already in:
  `marquee`, `preloader`, `magnetic`
- Toolkit is site-kind agnostic: landing pages, portfolios, campaign sites
  (messaging + template de-portfolioed)

## [1.1.0] — 2026-09-06

### Added
- Agent-native `--json` output on every command (logs to stderr, result JSON on stdout)
- `siteforge mcp`: stdio MCP server (add_section, add_effect, add_3d_scene, audit_page, install_skills, check_env)
- `siteforge agents`: stack detection + AGENTS.md generator
- `siteforge completion`: bash/zsh/fish tab-completion
- `audit --fix`: auto-repairs lang/alt/meta on local HTML (with .bak)
- `update --check`: non-mutating update check
- Enriched skill frontmatter (keyword routing) + examples in all 9 skills

### Changed
- Package renamed `@arjav1181/siteforge` → `site-forge` (plain name, same `siteforge` binary)

## [1.0.0] — 2026-09-06

First stable release — full Node.js rewrite of the original bash script,
expanded into the SiteForge toolkit.

### Added
- `video`: analyze → extract → optimize → scaffold → install → build
  (auto fps, lanczos upscale guard, 4:4:4 chroma, progress bars)
- Toolkit: `init` wizard, `add` (sections), `fx` (effects), `3d` (Three.js
  presets), `record`, `audit`, `ship`, `skills` installer (6 agents),
  `assets`, `doctor`, `update`
- Agent skills for every command
- `install.sh` one-line curl installer
- Docs: usage, how-it-works, customizing
- Vitest suite (unit + end-to-end on synthetic video) and GitHub Actions CI
