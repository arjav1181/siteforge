---
name: siteforge-add
description: Drop pre-built sections (hero, navbar, about, work, skills, experience, contact) into a Next.js + Tailwind site with `siteforge add`. Use when building page structure fast.
---

# siteforge add

```bash
siteforge add --list
siteforge add hero --dir src/components
```

Writes a self-contained `.tsx` component (props + placeholder content) plus
`siteforge.css` (reveal/buttons/cards) on first add. Wire-up:

```tsx
import Hero from "./components/Hero";
<Hero name="ARJAV" tagline="..." />
```

Sections use the `.reveal` convention — the CLI prints the observer snippet;
call `useReveal()` equivalent once per page. Pass real content via props or
edit the data arrays inside. Never remove `relative z-10` from sections on
video-background sites (canvas sits behind everything).
