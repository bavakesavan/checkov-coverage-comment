---
type: patch
scope: ci
---

Fix release workflow failing to push the floating major tag by splitting into separate push commands — `--force-with-lease` for the branch and `--force` for tags.
