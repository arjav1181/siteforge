---
name: siteforge-audit
description: Health-check any URL via `siteforge audit`: horizontal overflow with worst-first culprits, missing title/meta/lang, images without alt, console errors, heavy assets; --fix repairs local HTML. Use before shipping, after refactors, when mobile layout breaks. Fails (exit 1) on overflow.
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

## Examples

- Pre-ship gate: `siteforge audit http://localhost:3000` (exit 1 = overflow)
- Repair a file: `siteforge audit page.html --fix` (writes .bak, fixes lang/alt/meta)
- Overflow fix playbook: `clamp()` type, `min-w-0` grid children, no fixed widths past viewport
