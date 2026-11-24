# @ckb-ccc/molecule

## 0.2.0

### Minor Changes

- [#640](https://github.com/ckb-devrel/ccc/pull/640) [`725e33e`](https://github.com/ckb-devrel/ccc/commit/725e33eb4abb600cfc585956b78a8ae0480e27b2) Thanks [@Hanssen0-Alter-Ego](https://github.com/Hanssen0-Alter-Ego)! - Add runtime Molecule schemas through `Schema.from`, accepting a single input or a flat array of schema strings and existing schemas. Construct custom codec collections with `new Schema(record)`. Resolve dependencies together and access codecs through `Schema.get<Encodable, Decoded, Context>()`, with `unknown` defaults and explicit caller-supplied value types. Include schema validation without a generated parser or implicit numeric type-name conversions.

### Patch Changes

- Updated dependencies [[`3a465c6`](https://github.com/ckb-devrel/ccc/commit/3a465c6a6f609d7a1cc0f51f50ff1e5c6e920dea)]:
  - @ckb-ccc/core@1.24.0
