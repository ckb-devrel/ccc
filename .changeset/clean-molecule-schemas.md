---
"@ckb-ccc/molecule": minor
"@ckb-ccc/shell": minor
---

Add runtime Molecule schemas through `Schema.from`, accepting a single input or a flat array of schema strings and existing schemas. Construct custom codec collections with `new Schema(record)`. Resolve dependencies together and access codecs through `Schema.get<Encodable, Decoded, Context>()`, with `unknown` defaults and explicit caller-supplied value types. Include schema validation without a generated parser or implicit numeric type-name conversions.
