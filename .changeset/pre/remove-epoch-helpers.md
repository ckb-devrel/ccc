---
"@ckb-ccc/core": major
---

Remove the deprecated `epochFrom`, `epochFromHex`, and `epochToHex` helpers. Use `Epoch.from`, `Epoch.fromNum`, and `Epoch.from(...).toPackedHex()` instead.
