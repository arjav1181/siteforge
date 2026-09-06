---
name: siteforge-video
description: Turn any video file into a scroll-driven Next.js + Tailwind site — landing pages, portfolios, campaign sites, any immersive page (video background scrubs with scroll, frame extraction, 4:4:4 chroma, scaffold, build). Use when the user says: video background, scroll video, immersive site, animate frames on scroll, site from a video, or runs `siteforge video`.
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

## Examples

- "Make my showreel scrollable" → `siteforge video reel.mp4 site --fps 30`
- "Light draft, skip installs" → `siteforge video clip.mp4 draft --no-install --no-build`
- "Phone footage, keep it vertical" → add `--no-upscale`
