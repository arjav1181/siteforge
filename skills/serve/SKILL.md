---
name: siteforge-serve
description: Preview any static folder with `siteforge serve` (correct MIME types, index resolution, SPA fallback). Use when the user wants to preview a build, share localhost, or check a static export before shipping.
---

# siteforge serve

```bash
siteforge serve public
siteforge serve dist --port 8080 --spa
```

Serves with correct MIME types and directory `index.html` resolution.
`--spa` falls back unknown paths to `index.html` (SPA routers). Ctrl+C stops.

## Examples

- Preview a build: `siteforge serve dist`
- SPA preview: `siteforge serve dist --spa --port 8080`
- Pair with record: serve, then `siteforge record http://localhost:8000 --out demo.mp4`
