---
"@ckb-ccc/ssri": major
---

Remove `ExecutorJsonRpcConfig`, the legacy `ExecutorJsonRpc` constructor, and `ExecutorJsonRpc.url`. Use `ExecutorJsonRpc.new()` with a borrowed Transport or `ExecutorJsonRpc.open()` with owned endpoint URLs.
