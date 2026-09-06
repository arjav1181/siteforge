# SiteForge

[![CI](https://github.com/arjav1181/siteforge/actions/workflows/ci/badge.svg)](https://github.com/arjav1181/siteforge/actions/workflows/ci)
[![npm version](https://img.shields.io/npm/v/@aj1181/site-forge.svg)](https://www.npmjs.com/package/@aj1181/site-forge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Forge **killer interactive sites** from your terminal. One CLI — video
backgrounds, drop-in sections, FX pack, 3D scenes, demo recorder, site audit,
ship helper. Output is Next.js + Tailwind you own completely.

```bash
npm i -g @aj1181/site-forge
# or
curl -fsSL https://raw.githubusercontent.com/arjav1181/siteforge/main/install.sh | bash
```

Requirements: **Node.js 18+**. Video/record/audit additionally need
**ffmpeg** and a **system Chrome/Chromium** (no browser downloads — we drive
what's installed). Generated sites need **bun or npm**. Run `siteforge`
with no args for the interactive wizard, `siteforge doctor` to check your box.

## The toolkit

| Command | What it does | Docs |
|---|---|---|
| `siteforge init` | Guided new site: video bg + sections + FX | [docs/init.md](docs/init.md) |
| `siteforge video intro.mp4 site` | Video → scroll-driven Next.js site | [docs/video.md](docs/video.md) |
| `siteforge add hero` | 15 sections: hero×2, navbar, about, work, skills, experience, contact, pricing, faq, testimonials, gallery, features, cta, logos | [docs/add.md](docs/add.md) |
| `siteforge fx cursor` | cursor, badge, progress, reveal, favicon, smooth, marquee, preloader, magnetic | [docs/fx.md](docs/fx.md) |
| `siteforge 3d particle` | Three.js heroes: particle, terrain, shapes, orb, GLB model viewer | [docs/3d.md](docs/3d.md) |
| `siteforge record <url> --out demo.mp4` | 30fps demo video + poster of any page | [docs/record.md](docs/record.md) |
| `siteforge audit <url>` | Overflow culprits, meta/alt/console/weight | [docs/audit.md](docs/audit.md) |
| `siteforge ship` | Commit → GitHub repo → push | [docs/ship.md](docs/ship.md) |
| `siteforge skills install --oss` | 9 handmade + 33 OSS skills (submodules) for Claude/Cursor/OpenCode/Codex/Aider/Pi | [docs/ops.md](docs/ops.md) |
| `siteforge run bigfiles` | Everyday scripts: bigfiles, loc, todo-sweep, json-pretty, md-toc, port-kill | [docs/ops.md](docs/ops.md) |
| `siteforge serve public` | Static preview server | [docs/ops.md](docs/ops.md) |
| `siteforge shot <url> --out s.png` | Page screenshots | [docs/ops.md](docs/ops.md) |
| `siteforge agents init` | Detect stack, write AGENTS.md conventions | [docs/agents.md](docs/agents.md) |
| `siteforge mcp` | MCP server: tools for agents (stdio) | [docs/mcp.md](docs/mcp.md) |
| `siteforge completion bash` | Shell tab-completion | [docs/agents.md](docs/agents.md) |
| `siteforge assets public` | Batch-compress site images | [docs/ops.md](docs/ops.md) |
| `siteforge doctor` / `update` | Env check / self-update | [docs/ops.md](docs/ops.md) |

```bash
siteforge init --video reel.mp4 --dir my-site \
  --headline "Acme Launch" --email "hi@acme.test" \
  --sections navbar,features,pricing,contact --fx fx:cursor
cd my-site && npm run dev     # your content is already in
siteforge record http://localhost:3000 --out demo.mp4
siteforge audit http://localhost:3000
siteforge ship --repo my-site
```

<video src="assets/demo.mp4" width="100%" autoplay muted loop playsinline></video>

*Above: a real `siteforge video` run — terminal to scroll-driven site.*

## Universal agent toolkit

Two tracks: **make killer sites** (everything above) and **agent superpowers
for all kinds of work** — 42 skills (9 handmade + OSS submodules, see
[docs/oss-skills.md](docs/oss-skills.md)), runnable scripts, MCP server,
AGENTS.md generator, completions.

## For AI agents

Drop-in skills in [`skills/`](skills/) — `video`, `add`, `fx`, `v3d`,
`init`, `record`, `audit`, `ship`, `ops`. Install them anywhere with
`siteforge skills install [--agent …] [--global]`. If an agent is building
your site, point it at these first.

## Why sites built this way look clean

- **4:4:4 chroma end to end** — no subsampling block artifacts on gradients.
- **Adaptive canvas DPR** — capped by RAM/CPU/Data Saver; crisp on desktop,
  light on 3GB phones.
- **MP4 demos, not GIFs** — 30fps, full-res, smaller files.
- **Mobile-first components** — fluid type, single-column grids, touch-safe.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md): `npm install`, `npm run dev`,
`npm test`. Keep runtime deps minimal (`sharp`, `playwright-core`),
cover helpers with tests, update the changelog.

## License

MIT © 2026 Arjav — see [LICENSE](LICENSE).
