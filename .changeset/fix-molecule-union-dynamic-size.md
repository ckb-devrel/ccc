---
"@ckb-ccc/core": minor
---

fix(core)!: treat molecule union as dynamic-size type

**BREAKING CHANGE**: In compliance with the Molecule specification (RFC 0008), standard `mol.union` is now strictly treated as a dynamic-size type (`byteLength` is `undefined`), regardless of whether all variants share identical byte lengths.

Impact & Migration:
- When composed inside `mol.vector`, `mol.vector(mol.union(...))` now produces the canonical Molecule dynamic vector (DynVec) binary layout (`[full_size: uint32][offset_0]...[item_0]...`) instead of fixed vector (FixVec).
- Standalone encoding/decoding of a union item (`[item_id: uint32][payload]`) is unchanged.
- Standard `mol.union` can no longer be nested directly inside fixed-size containers (`mol.struct`, `mol.array`, `mol.fixedItemVec`).
- If you require fixed-size union layout for equal-length variants (FixVec in vector, or embedding in struct/array), use `mol.fixedUnion` (available via `@ckb-ccc/core`).
