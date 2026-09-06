---
name: siteforge-fx
description: Add interactive effects via `siteforge fx`: pixel supercar cursor follower, fixed pixel badge (watermark cover), scroll progress rail, useReveal hook, custom favicon generator, smooth scroll CSS, marquee band, preloader veil, magnetic hover wrapper. Use for cursor eyecandy, badges, progress bars, favicons, page dressing.
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

## Examples

- "Car follows my cursor" → `siteforge fx cursor` + `<CursorFollower />`
- "Something is covering my video corner" → `siteforge fx badge` pinned by coordinates
- "Tab icon" → `siteforge fx favicon --letter A --dir src/app`
