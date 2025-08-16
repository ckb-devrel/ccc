---
"@ckb-ccc/core": minor
"@ckb-ccc/ssri": patch
---

feat(core): add `CellAny`

It's definitely a mistake to name `CellOnChain` `Cell`, but there is nothing we can do with that right now. To avoid more duplicate code, `CellAny` was added to represent a cell that's on-chain or off-chain.
  
