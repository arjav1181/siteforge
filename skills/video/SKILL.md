---
name: siteforge-video
description: Turn any video into a scroll-driven Next.js site with `siteforge video`. Use for video backgrounds that scrub with scroll, scroll-driven frame animation, or scaffolding a site from a video file.
---

# siteforge video

```bash
siteforge video intro.mp4 [output-dir] [--fps 30] [--quality 95]
[--width 1920] [--height 1080] [--name pkg] [--pm bun|npm]
[--no-upscale] [--no-install] [--no-build]
```

Pipeline: ffprobe analysis (fps auto-detected) → ffmpeg extraction at
`fps=<n>,scale=lanczos,format=yuv444p` → sharp JPEGs (q95, 4:4:4 chroma) →
Next.js + Tailwind scaffold → install → build. Output: `public/frames/`,
`src/app/page.tsx` (canvas engine, `FRAME_COUNT` baked in).

Rules: never re-encode frames with 4:2:0 tools (block artifacts return);
keep `frame-%04d.jpg` naming; customize via the `siteforge-customize` skill.
Troubleshooting: ffmpeg errors = check input plays + disk space; aspect
mismatch = CLI keeps source res (pass explicit dimensions only for ~16:9).
