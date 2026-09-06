---
name: siteforge-audit
description: Health-check a page with `siteforge audit` — horizontal overflow with culprits, meta/alt/console/weight. Use before shipping, after refactors, or when mobile looks broken.
---

# siteforge audit

```bash
siteforge audit http://localhost:3000
siteforge audit https://my-site.vercel.app --widths 390,1280 --budget 500
```

Checks 375/768/1440px viewports. Exit 1 on horizontal overflow (with the
offending `<tag>` + overflow px listed worst-first); meta/alt/console/heavy
assets are advisory warnings. Fix overflow with fluid type (`clamp()`),
`min-w-0` grid children, no fixed widths past the viewport — never
`whitespace-nowrap` + oversized type. Re-run until exit 0.
