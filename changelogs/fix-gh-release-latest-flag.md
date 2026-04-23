---
type: patch
scope: ci
---

Fix release workflow failing on `gh release create` by replacing the unsupported `--make-latest true` with `--latest`.
