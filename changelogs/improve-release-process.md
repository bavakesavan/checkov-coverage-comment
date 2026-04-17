---
type: patch
scope: ci
---
Split release workflow into two stages: `release.yml` now opens a PR (using a `RELEASE_PAT` token with `pull-requests: write` permission) instead of pushing directly to main, and new `tag-release.yml` pushes the exact version tag and updates the floating major tag when the release PR is merged.
