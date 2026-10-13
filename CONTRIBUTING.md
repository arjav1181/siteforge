# Contributing

## Setup

Requirements: Node.js 18+, ffmpeg + ffprobe.

```bash
git clone https://github.com/arjav1181/siteforge.git
cd siteforge
npm install   # or: bun install
```

## Workflow

```bash
npm run dev -- my-video.mp4 out-dir --no-install --no-build  # iterate via tsx
npm run check   # typecheck (tsc --noEmit)
npm run test    # vitest (unit + e2e; e2e needs ffmpeg)
npm run build   # compile to dist/
```

## Rules

- Keep runtime dependencies near zero (today: just `sharp`). New deps need
  justification in the PR.
- Every pure helper gets unit tests; pipeline changes get e2e coverage.
- Update `CHANGELOG.md` (Unreleased section) and `docs/` with behavior changes.
- `install.sh` must stay POSIX-shellcheck clean: `shellcheck -S warning install.sh`.
- The generated site template (`src/template/`, `src/scaffold.ts`) must keep
  building — e2e asserts scaffold output, add assertions for new files.
- Conventional commits preferred (`feat:`, `fix:`, `docs:`, `chore:`).

## Releasing

Publishing is automated, but it triggers on a **tag**, not on `main`:

```bash
npm version patch          # or minor / major — bumps package.json, commits, tags
git push && git push origin v1.6.1
```

The push tag fires `.github/workflows/publish.yml`, which typechecks, builds,
tests and then publishes to npm. Two guards stop bad releases: the tag must
match the version in `package.json`, and the job skips silently if that version
is already on npm.

You can also run it by hand from the Actions tab — by default it verifies
everything and publishes nothing, which is the way to rehearse a release.

Authentication is [npm trusted publishing](https://docs.npmjs.com/trusted-publishers)
(OIDC): there is **no `NPM_TOKEN` in this repo and there should never be one**.
Once, on npmjs.com: package → Settings → Trusted Publisher → GitHub Actions,
with

| Field | Value |
|---|---|
| Organization or user | `arjav1181` |
| Repository | `siteforge` |
| Workflow filename | `publish.yml` |

The filename is just the filename — not `.github/workflows/publish.yml` — and
it is case-sensitive. Until that is configured, the publish step fails with
`ENEEDAUTH`; nothing else is broken.

Two things that bite here, both already handled in the workflow:

- Node 24 is required, because npm only attempts the OIDC exchange on
  npm ≥ 11.5.1.
- Do not set `registry-url` on `setup-node`. It injects `GITHUB_TOKEN` as
  `NODE_AUTH_TOKEN`, npm then finds a token, uses it, and never tries OIDC.
