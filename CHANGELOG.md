# Changelog

## [Unreleased]

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

### Added
- SiteForge toolkit: `init` wizard (default, bare run), `add` (12 sections),
  `fx` (9 effects), `3d` (5 Three.js presets incl. GLB viewer), `record`,
  `audit`, `ship`, `skills` installer (6 agents), `assets`, `doctor`, `update`
- Agent skills for every command

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0] — 2026-09-06

First stable release — full Node.js rewrite of the original bash script.

### Added
- Node.js CLI: analyze → extract → optimize → scaffold → install → build
- Auto frame-rate detection (uses source fps unless `--fps` is passed)
- Lanczos upscaling with aspect-ratio guard + `--no-upscale`
- 4:4:4 chroma pipeline (no subsampling artifacts)
- Live ffmpeg progress bars, colored step output
- `--quality`, `--pm`, `--name`, `--no-install`, `--no-build` flags
- `install.sh` one-line curl installer
- Agent skills: `video-to-site` and `customize-site`
- Docs: usage, how-it-works, customizing
- Vitest suite (unit + end-to-end on synthetic video) and GitHub Actions CI
