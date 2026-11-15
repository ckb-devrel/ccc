---
"@ckb-ccc/core": patch
---

Reject non-2xx HTTP responses before parsing JSON so JSON-RPC requests can try the configured fallback endpoints.
