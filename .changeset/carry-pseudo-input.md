---
"@ckb-ccc/core": minor
---

feat(core): let a wallet sign a transaction with a pseudo input over the signer JSON-RPC. The wallet side rebuilds the cell of an input that cannot exist on chain (the only input, at out point index `0xffffffff`) from the lock of the first output, and no longer looks it up
