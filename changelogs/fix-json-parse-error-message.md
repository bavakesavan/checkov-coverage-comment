---
type: patch
scope: parser
---

Preserve the original `SyntaxError` message when Checkov JSON parsing fails, so the error reported to the user includes the specific parse failure reason rather than a generic message.
