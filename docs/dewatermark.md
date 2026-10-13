# `siteforge dewatermark`

Take a watermark out of images, frame directories and video by **solving** for
the background underneath it, not painting over it.

```bash
siteforge dewatermark hero.png
siteforge dewatermark public --box=1600,880,180,180
siteforge dewatermark ./frames --auto --yes
siteforge dewatermark talk.mp4 --box=1200,680,90,90 --quality 88
```

| Option | Meaning |
|---|---|
| `--box=x,y,w,h` | area to solve — skips the picker entirely |
| `--auto` | start from a guessed box (advisory, often wrong) |
| `--out <path>` | output file, or directory for a directory input |
| `--format <keep\|webp\|jpg>` | image output format (default `keep`) |
| `--quality <1-100>` | image quality (default 82); also sets video CRF |
| `--no-open` | don't launch the browser picker |
| `--yes` | no prompts |

`--json` works like every other command: result JSON on stdout, logs on stderr.

## What it does

Inside the selected area the Laplace equation ∇²u = 0 is relaxed with the
surrounding pixels held fixed, so the image surface runs as smoothly through the
gap as it did on either side. That is the 2D equivalent of interpolating a
missing sample out of a sequence, and it is the only one of these methods that
reconstructs a background rather than substituting an average:

| Method | Result |
|---|---|
| blur | carries the mark's own energy outward → leaves a glow |
| despeckle | same energy, spread wider → leaves a haze |
| median | needs a kernel wider than the mark → rounds it off |
| laplace | solves for a smooth surface → nothing left behind |

The solve runs coarse-to-fine, because a direct sweep across an N×N hole needs
O(n²) iterations to propagate the boundary.

Measured on a real gradient, across a 60px hole:

```
red channel   before  93,250,250,250,96
              after   93, 93, 94, 95, 96     ← the slope continues
```

## Output layout

Originals are never overwritten.

| Input | Output |
|---|---|
| `public/hero.png` | `public/hero.clean.png` |
| `public/` (directory) | `public-clean/` — same filenames, same formats |
| `frames/0001.png` … | `frames-clean/0001.png` … |
| `talk.mp4` | `talk.clean.mp4` (audio copied, not dropped) |

Keeping the filename and extension matters: it means `<img src="/hero.png">`
keeps resolving after you swap in the cleaned copy. A directory run applies the
same box to every file, re-expressed for each file's own resolution, so one
measurement covers a hero and its thumbnail.

## Why you are asked to mark it

The obvious auto-detect is diffing frames: a watermark is static, a scene is
not. Measured on a real sequence, that does **not** work here — the sparkle is
semi-transparent, so its pixels shift as the background moves behind it. Spread
inside the mark was 22.7 against a 23.8 frame average: no signal. A median
across frames does not help either; the moving subject is still brighter than
the mark and wins.

Guessing is not an option either — a wrong box does not fail, it quietly
smooths whatever you aimed at. So the command asks:

- **`--box`** — skip the prompt entirely (scripts, CI).
- **browser picker** (default) — the image in a canvas, drag a box, copy the
  coordinates, paste them back. A terminal cannot show a photograph, which is
  the whole reason marking by hand is otherwise unpleasant.
- **ASCII preview** — shown before every run, so you can confirm the mark is
  centred in the selected area. This is also the fallback when there is no
  browser.
- **`--auto`** — a guess, offered for scripting. Treat it as a starting point.

There is no TTY-safe prompting: without `--box` or `--auto`, a pipe or CI run
fails with an actionable message instead of hanging.

## Read the result

Three numbers, because each is a different claim:

- **`marked`** — a mark was detected in that item.
- **`residual`** — a mark was detected **again after solving**. This is the one
  to read. Non-zero means the box could not be used as drawn and that file
  still carries the mark.
- **`adjusted`** — the box had to move to fit inside that frame (the solver
  needs known pixels on all four sides), which is the usual reason a mark
  survives. All such items still came out clean.

```
✓ 3 item(s) → public-clean
✓ the mark was present in 100% of them (0 already clean)
⚠ 1 still show the mark after solving — its box could not be used as drawn
```

If `residual` is non-zero, the mark is sitting too close to an edge for the
solver's boundary ring. Mark a slightly smaller box a little further in.

Files that cannot be solved at all — too small to take even a 1px box plus its
14px minimum ring — are listed under `failures` and skipped. One bad file never
aborts the batch.

## Video

```bash
siteforge dewatermark talk.mp4 --box=1200,680,90,90
```

Decodes every frame, solves each one, re-encodes H.264 and copies the audio
track through untouched. Needs `ffmpeg` and `ffprobe` on `PATH` — `siteforge
doctor` will tell you if they are missing. The box is re-expressed against the
video's real resolution, not the preview still.

## Agent use

```bash
siteforge dewatermark gen/shot.png --box=1720,940,120,120 --yes --json
```

```json
{
  "target": "gen/shot.png",
  "kind": "image",
  "box": { "x": 1720, "y": 940, "w": 120, "h": 120 },
  "output": "gen/shot.clean.png",
  "total": 1,
  "marked": 1,
  "clean": 0,
  "adjusted": 0,
  "residual": 0,
  "bytes": 284913,
  "failures": []
}
```

Gate on `residual === 0` and `failures` being empty. A non-zero `residual` is
the tool telling you it did not actually remove the mark — not a rounding error.