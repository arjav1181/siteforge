# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
