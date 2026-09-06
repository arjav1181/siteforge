---
name: siteforge-ship
description: Commit, create the GitHub repo, and push with `siteforge ship`. Use to publish a finished site.
---

# siteforge ship

```bash
siteforge ship
siteforge ship --repo my-site --private --message "launch"
```

Inits git if needed, writes a Node/Next `.gitignore`, commits, creates the
repo via `gh` (must be authenticated) and pushes. Then import the repo at
vercel.com/new to deploy. Pre-ship: build green, lockfile on the public
registry, secrets out of the tree.
