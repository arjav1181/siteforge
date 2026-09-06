# `siteforge fx`

Interactive effects, one command each.

```bash
siteforge fx cursor                             # pixel supercar cursor follower
siteforge fx badge                              # fixed pixel-art badge
siteforge fx progress                           # scroll progress rail
siteforge fx reveal                             # useReveal() hook
siteforge fx favicon --letter A --dir src/app   # custom icon.svg
siteforge fx smooth                             # smooth-scroll CSS (prints)
```

`cursor` only renders on fine pointers and respects reduced-motion. `badge`
is for fixed-position overlays (e.g. covering a baked-in video watermark).
`favicon` writes `src/app/icon.svg` — delete stale `favicon.ico`.
