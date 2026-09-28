---
"@ckb-ccc/core": major
---

Remove `Client.url`. A Client may use multiple endpoints or a Transport without a URL, so applications that need an endpoint must retain that configuration separately.
