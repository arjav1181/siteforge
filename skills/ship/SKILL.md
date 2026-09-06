---
name: siteforge-ship
description: Publish a finished site via `siteforge ship`: git init, Node/Next gitignore, commit, GitHub repo create, push. Use when the user says ship it, push to GitHub, deploy prep. Requires git + authenticated gh CLI.
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

## Examples

- `siteforge ship --repo my-site --message "launch"`
- Private: add `--private`. Local-only commit: `--no-push`
- Then import the repo at vercel.com/new
