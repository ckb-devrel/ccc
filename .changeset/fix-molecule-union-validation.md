---
"@ckb-ccc/core": patch
---

Validate tag length, schema, and custom field IDs in Molecule Union.

- Reject inputs with fewer than 4 bytes during Union decoding.
- Strictly validate custom variant ID mappings: require unique valid uint32 IDs with an exact key match to the union layout, and reject non-enumerable or prototype-inherited properties.
- Throw structured and descriptive errors (`unknown union field index ...`) when decoding an unrecognized tag ID.
