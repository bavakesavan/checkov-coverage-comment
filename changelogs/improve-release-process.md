---
type: patch
scope: ci
---
Split release into two stages: `release.yml` opens a PR instead of pushing directly to main; `tag-release.yml` pushes version and floating major tags on merge.
