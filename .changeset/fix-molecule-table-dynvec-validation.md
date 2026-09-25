---
"@ckb-ccc/core": patch
---

Validate Molecule Table and DynVec headers and offsets strictly.

- Validate header total size matches buffer byte length.
- Validate field offsets count, 4-byte alignment, non-decreasing order, and offsets within payload bounds.
- Validate offsets for all fields in the Table header, including trailing fields omitted by the schema for forward compatibility.
- Disallow non-empty Table schemas from matching empty byte buffers, while properly supporting empty Table schemas.
