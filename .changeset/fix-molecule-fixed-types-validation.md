---
"@ckb-ccc/core": patch
---

Reject zero-size and non-safe-integer parameters in Molecule fixed-size types.

- Validate constructor arguments for `mol.fixedItemVec`, `mol.array`, and `mol.struct` with `Number.isSafeInteger(val) && val > 0`.
- Reject zero-item or non-safe-integer count in `mol.array(itemCodec, 0)`.
- Reject empty-field structs `mol.struct({})` and structs containing zero-length fields.
- Validate that cumulative struct byte length and array byte length remain within the JavaScript safe integer range.
