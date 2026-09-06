# `siteforge record`

```bash
siteforge record <url> --out demo.mp4 [--viewport 1280x800]
[--establish 1800] [--step 90] [--delay 130] [--hold 1500]
[--crf 21] [--browser /path/to/chrome] [--keep-raw]
```

Auto-scrolls the page top→bottom while capturing, then encodes 30fps H.264
+ a poster JPG. Needs ffmpeg and system Chrome/Chromium (no browser download
— `playwright-core` drives what's installed).

## Staging recipe (the big-company look)

1. **Frame it** — page in a browser-chrome window (traffic lights + URL pill),
   rounded 16px, on a dark radial-gradient backdrop with a soft glow.
2. **Headline it** — one ad-style line per beat ("Describe your meal." →
   "AI analyzes everything." → "Progress, instantly."), crossfaded, never
   baked-on caption bars.
3. **Move once** — a single slow push-in on the money shot (CSS transform or
   post zoom); everything else static. One idea per video, under ~15s.
4. **Loop rhythm** — fade from black in, fade to black out; the restart feels
   intentional and rewatchable.
5. **Ship MP4** — 30fps, full-res, CRF 21. Sharper, smoother, smaller than GIF.
