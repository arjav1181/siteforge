# `siteforge video`

Turn any video into a scroll-driven Next.js + Tailwind site.

```bash
siteforge video intro.mp4 [output-dir] [--fps 30] [--quality 95]
[--width 1920] [--height 1080] [--name pkg] [--pm bun|npm]
[--no-upscale] [--no-install] [--no-build]
```

| Stage | What happens |
|---|---|
| Analyze | `ffprobe` reads resolution/fps/duration; fps auto-detected |
| Extract | `ffmpeg` pulls frames (`fps`, lanczos upscale, `yuv444p` full chroma) |
| Optimize | PNGs → JPEG q95 4:4:4 via sharp, PNGs deleted |
| Scaffold | Complete Next.js 14 project, canvas engine wired to frame count |
| Install/Build | bun (auto) or npm; skippable for CI/scripting |

The generated engine lerps scroll position to frames (`ease 0.18`), adapts
canvas DPR to device RAM/CPU/Data Saver, preloads with priority, and never
flashes black (nearest-decoded fallback). See `customizing` below for edits.
