# SiteForge

[![CI](https://github.com/arjav1181/siteforge/actions/workflows/ci/badge.svg)](https://github.com/arjav1181/siteforge/actions/workflows/ci)
[![npm version](https://img.shields.io/npm/v/@arjav1181/siteforge.svg)](https://www.npmjs.com/package/@arjav1181/siteforge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Forge **killer interactive sites** from your terminal. One CLI, six tools —
video backgrounds, drop-in sections, FX pack, demo recorder, site audit, ship
helper. Zero-config output built on Next.js + Tailwind.

```bash
npm i -g @arjav1181/siteforge
# or
curl -fsSL https://raw.githubusercontent.com/arjav1181/siteforge/main/install.sh | bash
```

Requirements: **Node.js 18+**. Video/record/audit additionally need
**ffmpeg** and a **system Chrome/Chromium** (no browser downloads — we drive
what's installed). Generated sites need **bun or npm**.

## The toolkit

| Command | What it does | Docs |
|---|---|---|
| `siteforge video intro.mp4 site` | Video → scroll-driven Next.js site (frames scrub with scroll) | [docs/video.md](docs/video.md) |
| `siteforge add hero` | Drop-in sections: hero, hero-grid, navbar, about, work, skills, experience, contact | [docs/add.md](docs/add.md) |
| `siteforge fx cursor` | FX pack: cursor follower, pixel badge, progress rail, reveal hook, favicon, smooth scroll | [docs/fx.md](docs/fx.md) |
| `siteforge record <url> --out demo.mp4` | 30fps demo video + poster of any page | [docs/record.md](docs/record.md) |
| `siteforge audit <url>` | Overflow culprits, meta/alt/console/weight report | [docs/audit.md](docs/audit.md) |
| `siteforge ship` | Commit → GitHub repo → push | [docs/ship.md](docs/ship.md) |

```bash
siteforge video reel.mp4 my-site --fps 30
cd my-site
siteforge add navbar --dir src/components
siteforge fx cursor favicon --letter A   # one effect per call; see --list
siteforge record http://localhost:3000 --out demo.mp4
siteforge audit http://localhost:3000
siteforge ship --repo my-site
```

## For AI agents

Drop-in skills in [`skills/`](skills/) — `video`, `add`, `fx`, `record`,
`audit`, `ship` (+ `customize` wisdom baked into each). Compatible with Claude
Code, Cursor, OpenCode, and Copilot. If an agent is building your site, point
it at these first.

## Why sites built this way look clean

- **4:4:4 chroma end to end** — no subsampling block artifacts on gradients.
- **Adaptive canvas DPR** — capped by RAM/CPU/Data Saver; crisp on desktop,
  light on 3GB phones.
- **MP4 demos, not GIFs** — 30fps, full-res, smaller files.
- **Mobile-first components** — fluid type, single-column grids, touch-safe.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md): `npm install`, `npm run dev`,
`npm test`. Keep runtime deps minimal, cover helpers with tests, update the
changelog. Full rewrite history of the original bash script lives in the
sister repo [`video-to-site`](https://github.com/arjav1181/video-to-site).

## License

MIT © 2026 Arjav — see [LICENSE](LICENSE).
