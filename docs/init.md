# `siteforge init` (and the wizard)

Bare `siteforge` opens the interactive menu: new site, add section/effect,
record, audit, ship, skills, doctor. `siteforge init` is the guided new-site
flow (video background + sections + FX) with the same prompts, scriptable:

```bash
siteforge init --video intro.mp4 --dir my-site --fps 30 \
  --sections hero,navbar,work,contact --fx fx:cursor,3d:particle
```

Runs the video pipeline (install yes, build no), adds each section/effect,
ensures shared CSS, then prints next steps. Prompts refuse in non-TTY shells
— pass flags in CI/scripts.
