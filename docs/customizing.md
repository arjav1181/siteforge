# Customizing generated sites

Generated sites keep content in top-level arrays (`PROJECTS`, `SKILLS`,
`EXPERIENCE`, `SOCIALS`) inside `src/app/page.tsx` — swap placeholders,
update the hero, point `mailto:` links at your email, set `<title>` in
`src/app/layout.tsx`. Or rebuild sections with `siteforge add`.

New sections follow the pattern: `<section className="relative z-10">` +
`max-w-6xl` container + `reveal` classes. The canvas is fixed behind
everything, so sections need no background (except deliberate solid panels).

Demo videos on cards: MP4 over GIF —
`<video autoPlay muted loop playsInline preload="metadata" poster={...}>`.

Deploy: push to GitHub, import in Vercel. Watch for: public lockfile
registry, CommonJS `.js` configs, `autoprefixer` installed, green build.
