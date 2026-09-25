---
"@ckb-ccc/core": minor
---

feat(core): add fixedUnion for fixed-size molecule union compositions

- Introduce `mol.fixedUnion` to support fixed-size Molecule union extensions.
- Require all variants to have the same positive safe integer `byteLength`.
- Produce fixed-size codec (`byteLength = variantByteLength + 4`) that can be embedded into `mol.struct`, `mol.array`, and produces FixVec binary format in `mol.vector`.
- Support custom tag ID mappings with strict schema validation.
