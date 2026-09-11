---
"@ckb-ccc/core": patch
---

Cache successful read-only JSON-RPC signer requests for the lifetime of the
signer, while retrying failures and invalidating cached data on replacement.
