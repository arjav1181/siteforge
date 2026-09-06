# `siteforge ship`

```bash
siteforge ship [--repo name] [--private] [--message "launch"] [--no-push]
```

git init (if needed) → Node/Next `.gitignore` → commit → `gh repo create`
(public by default) → push. Requires git + authenticated `gh`.
Then import the repo at vercel.com/new. Pre-ship: green build, public
lockfile registry, no secrets in tree.
