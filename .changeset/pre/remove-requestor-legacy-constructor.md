---
"@ckb-ccc/core": major
---

Remove `RequestorJsonRpcConfig`, the legacy positional `RequestorJsonRpc` constructor, and `RequestorJsonRpc.url`. Use `RequestorJsonRpc.new()` with a borrowed Transport or `RequestorJsonRpc.open()` with owned endpoint URLs.
