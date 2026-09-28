---
"@ckb-ccc/core": major
---

Make the `JsonRpcTransportWebSocket` constructor private. Use `JsonRpcTransportWebSocket.open()` and dispose the returned owner when finished.
