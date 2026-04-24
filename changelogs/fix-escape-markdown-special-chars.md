---
type: patch
scope: action
---

Fix markdown escaping in PR comment tables to handle `*`, `_`, `` ` ``, `[`, and `]` in addition to `|`, preventing rendering corruption when check names or resource identifiers contain these characters.
