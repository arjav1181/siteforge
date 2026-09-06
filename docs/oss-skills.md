# OSS skills (submodules)

Handmade skills live in `skills/`. OSS collections live in `skills-oss/` as
**pinned git submodules** (see `oss-skills.json` for repo, ref, license):

- `anthropics/skills` — official Anthropic reference skills. Mixed license:
  Apache 2.0 examples + source-available document skills (`docx`, `pdf`,
  `pptx`, `xlsx`). Read their README + THIRD_PARTY_NOTICES.md.
- `obra/superpowers` — MIT dev-workflow skills (debugging, TDD, planning).

```bash
git clone --recursive <repo>     # submodules included
git submodule update --init      # fetch them in an existing clone
git submodule update --remote    # move pins forward (review diffs first!)

siteforge skills --list --oss    # preview counts per collection
siteforge skills install --agent claude --global --oss
```

Install semantics: recursive `SKILL.md` discovery (nested layouts are
flattened — Claude only discovers one level deep), whole-folder copy so
references/scripts travel along, name collisions prefixed by source id
(handmade names always win bare). License files ride along — respect them.

npm users: tarballs exclude git submodules, so `--oss` fetches each
collection as a GitHub tarball automatically (needs network + `tar`).
