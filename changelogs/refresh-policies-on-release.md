---
type: minor
scope: policies
---

Automatically refresh `data/policies.json` from the upstream prisma-cloud-docs repo on every release, ensuring policy metadata stays current without manual updates. Also fixed the policy extractor to capture 60 previously missed policies that used the `Checkov Check ID` field label variant (primarily secrets and Alibaba policies).
