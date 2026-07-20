---
"@ckb-ccc/core": patch
---

fix(core): respect `Signer.prepareTransaction` return value in `Transaction.completeFee`

Fix underestimated fees when `Signer.prepareTransaction` returns a new transaction, including when the transaction and signer come from different `@ckb-ccc/core` instances.
