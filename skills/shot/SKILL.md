---
name: siteforge-shot
description: Screenshot any page to PNG with `siteforge shot` (viewport control, full-page capture). Use for visual checks, card thumbnails, changelog images, before/after comparisons.
---

# siteforge shot

```bash
siteforge shot https://example.com --out hero.png
siteforge shot http://localhost:3000 --out full.png --full --viewport 1440x900
```

Needs system Chrome. `--full` captures the whole scrollable page. Same
engine backs the `take_screenshot` MCP tool.

## Examples

- Hero check: `siteforge shot http://localhost:3000 --out hero.png`
- Full page for review: add `--full`
