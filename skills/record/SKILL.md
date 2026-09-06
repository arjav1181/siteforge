---
name: siteforge-record
description: Record a 30fps demo MP4 + poster of any URL via `siteforge record` (auto-scroll, H264). Use for project-card demos, product demo videos, changelog clips, social posts. Dress pages first: browser frame, ad headline, fade rhythm.
---

# siteforge record

```bash
siteforge record https://my-site.vercel.app --out demo.mp4
siteforge record http://localhost:3000 --out hero.mp4 --step 60 --delay 100
```

Auto-scrolls top→bottom while recording, encodes H.264 + poster JPG.
Needs ffmpeg + a system Chrome/Chromium (`--browser` or `SITEFORGE_CHROME`).

For big-company polish, dress the page first: app in a browser-chrome frame
on a gradient backdrop, ad-style headline that crossfades per beat, fade
in/out for loop rhythm, one slow push-in during the money shot. Keep it
under ~15s, one idea per video. Prefer MP4 over GIF (sharper, smoother,
smaller). See `docs/record.md` for the full staging recipe.

## Examples

- Card demo: `siteforge record http://localhost:3000 --out demo.mp4`
- Slow product tour: `--step 60 --delay 100`
- One idea per video, under ~15s; MP4 over GIF always
