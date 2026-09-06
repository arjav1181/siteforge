# `siteforge add`

Pre-built sections for Next.js + Tailwind sites.

```bash
siteforge add --list
siteforge add hero --dir src/components
```

Available: `hero`, `hero-grid`, `navbar`, `about`, `work`, `skills`,
`experience`, `contact`. Each writes a prop-driven `.tsx` file; first add
also writes `siteforge.css` (reveal/buttons/cards/timeline). Import the
component, pass real content, import the CSS once, add the printed
IntersectionObserver snippet (or use `siteforge fx reveal`).
