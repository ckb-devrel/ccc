---
"@ckb-ccc/core": major
---

Remove `ClientJsonRpcConfig` and the legacy public constructors for JSON-RPC Clients. Use `ClientPublicMainnet.new()` or `ClientPublicTestnet.new()` with a borrowed Transport, or use `.open()` with owned endpoint URLs.
