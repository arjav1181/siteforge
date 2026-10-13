---
name: siteforge-dewatermark
description: Remove watermarks from images, frame directories and video with `siteforge dewatermark` (Laplace inpainting, browser box picker, batch scaling). Use for AI-generated images or clips you own that carry a semi-transparent sparkle/logo, before shipping them as site assets.
---

# siteforge dewatermark

```bash
siteforge dewatermark hero.png                       # opens a picker
siteforge dewatermark public --box=1600,880,180,180 # whole asset dir, no prompts
siteforge dewatermark ./frames --auto --yes          # CI / scripted
siteforge dewatermark talk.mp4 --box=1200,680,90,90 # video, audio kept
```

It **solves** the mark out — ∇²u = 0 relaxed from the surrounding pixels held
fixed — instead of blurring, median-filtering or cloning over it. That is why a
gradient keeps running through the gap instead of flattening into a patch.

One box covers a whole directory: it is re-expressed per file for that file's
resolution, so a 2560px hero and its 640px thumbnail are both solved with the
coordinates you measured once. Output keeps the filename and format
(`<name>.clean.png`, or `<dir>-clean/`), so existing `<img src>` references keep
working. Originals are never overwritten.

Video needs ffmpeg; the audio track is copied, not dropped.

## Read the result

- `marked` — a mark was detected in that item.
- `residual` — a mark was detected **again after solving**. This is the one to
  read. Non-zero means the box could not be used as drawn (usually the mark sits
  too close to an edge for the solver's boundary ring) and that file still shows
  it. Mark a slightly smaller box, further from the edge.
- `adjusted` — the box had to move to fit inside a frame; all came out clean.

Never report success without checking `residual` is 0. A wrong box does not
fail loudly — it quietly smooths whatever you aimed at, which is exactly why the
command asks you to mark it rather than guessing.

## Examples

- Batch of site images: `siteforge dewatermark public --box=...,...,...,...`
- Ship-ready asset: `siteforge dewatermark gen/shot.png --format webp`
- Scripted run: `--auto --yes` (the guess is advisory; verify `residual`)