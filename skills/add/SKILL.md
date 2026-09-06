---
name: siteforge-add
description: Add pre-built page sections (hero, hero-grid, navbar, about, work/projects, skills, experience, contact, pricing, faq, testimonials, gallery) to a Next.js + Tailwind site via `siteforge add`. Use when the user wants a section scaffolded with props and placeholder content.
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

## Examples

- "I need a hero" → `siteforge add hero` then `<Hero name="ARJAV" tagline="..." />`
- "Pricing section" → `siteforge add pricing`, pass `plans` with one `featured: true`
- "FAQ without JS" → `siteforge add faq` (native details/summary)
