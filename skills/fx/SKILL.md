---
name: siteforge-fx
description: Drop interactive effects (cursor follower, pixel badge, scroll progress, reveal hook, favicon, smooth scroll) into a site with `siteforge fx`. Use for cursor eyecandy, watermark covers, progress rails, favicons.
---

# siteforge fx

```bash
siteforge fx --list
siteforge fx cursor                    # pixel supercar trails arrow, steers, boosts on click
siteforge fx badge                     # fixed pixel badge (watermark cover)
siteforge fx progress                  # scroll progress rail
siteforge fx reveal                    # useReveal() hook for .reveal elements
siteforge fx favicon --letter A --dir src/app
siteforge fx smooth                    # prints smooth-scroll CSS
```

Notes: cursor renders nothing on touch devices (pointer:fine gate) and
respects prefers-reduced-motion. Badge is a fixed DOM element — position it
with the same cover math as any canvas beneath it. Favicon writes
`src/app/icon.svg` (delete stale `favicon.ico`).
