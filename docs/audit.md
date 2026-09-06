# `siteforge audit`

```bash
siteforge audit <url> [--widths 375,768,1440] [--budget 500] [--browser ...]
```

Loads the page at each width and reports: horizontal overflow in px with the
worst-offending elements first, missing `<title>`/meta description/lang,
images without alt, console errors, assets over budget. Exit code 1 on
overflow, 0 otherwise (warnings never fail).

Fix playbook: fluid type (`clamp()`), `min-width: 0` on grid children, no
fixed widths past the viewport, never `whitespace-nowrap` + oversized type.
Re-run until green.
