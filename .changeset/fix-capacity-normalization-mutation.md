---
"@ckb-ccc/core": patch
---

fix(core): avoid mutating existing transaction entities during capacity normalization

Invalid existing `CellOutput`, `Cell`, `CellAny`, and `Transaction` instances are now reconstructed instead of being repaired in place.
