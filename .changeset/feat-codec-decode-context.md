---
"@ckb-ccc/core": minor
---

Generalize codec decode configuration into composable decode contexts.

- Add a backward-compatible `Context` parameter to `Codec` and `CodecLike`.
- Infer decoder contexts in `Codec.from` and preserve them through mapping APIs.
- Propagate and combine child contexts across Molecule codec combinators.
- Forward optional decode contexts through `Entity.decode` and `Entity.fromBytes`.
- Keep `isExtraFieldIgnored` as Table-specific behavior while supporting deeply nested compatible decoding.
