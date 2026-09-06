---
name: siteforge-run
description: Run bundled everyday scripts with `siteforge run` (bigfiles, loc, todo-sweep, json-pretty, md-toc, port-kill). Use for repo hygiene, quick stats, JSON plumbing, markdown TOCs, freeing ports.
---

# siteforge run

```bash
siteforge run --list
siteforge run bigfiles public --top 10
siteforge run todo-sweep src
curl -s https://api.example.com/x | siteforge run json-pretty
siteforge run port-kill 3000
```

Stdlib-only Node scripts, each takes `--help`. `port-kill` verifies targets
before signalling (never self/ancestors, re-checks binding, escalates
TERM→KILL) — safe by construction.
