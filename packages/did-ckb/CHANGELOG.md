# @ckb-ccc/did-ckb

## 0.2.0
### Minor Changes



- [#381](https://github.com/ckb-devrel/ccc/pull/381) [`46cc045`](https://github.com/ckb-devrel/ccc/commit/46cc045a3eefe9ba6625482dc7f740a0c59c99d4) Thanks [@Hanssen0](https://github.com/Hanssen0)! - chore: bump packages


### Patch Changes

- Updated dependencies [[`46cc045`](https://github.com/ckb-devrel/ccc/commit/46cc045a3eefe9ba6625482dc7f740a0c59c99d4)]:
  - @ckb-ccc/type-id@0.1.0
  - @ckb-ccc/core@1.14.0

## 0.1.0
### Minor Changes



- [#376](https://github.com/ckb-devrel/ccc/pull/376) [`ce2b005`](https://github.com/ckb-devrel/ccc/commit/ce2b005b2c20bdd8736f78e7f286b8acb40e80e5) Thanks [@truthixify](https://github.com/truthixify)! - feat(did-ckb): identifier helpers, resolver, history walk, and did:plc migration
  
  Layered on top of the basic create/transfer/destroy operations:
  
  - `argsToDid`, `didToArgs`, `isDidCkb`, plus RFC 4648 base32 helpers for converting between Type ID args and the human readable `did:ckb:` URI form (WIP-01 §2.2)
  - `findDidCkbCell`, `resolveDidCkb`, `listDidCkbsByLock` for resolving a DID by id or by owning lock
  - `getDidCkbHistory` walks the cell chain backwards to produce an ordered list of CREATE / UPDATE / MIGRATE entries with tx hash, block number, capacity, and decoded data
  - `migrateDidCkb` + `buildMigrationWitness` for importing a `did:plc` into `did:ckb` (WIP-02 §3.1.1)
  - `@ckb-ccc/did-ckb/plc` subpath with `fetchPlcLog`, `parseDidKey`, `signRotationHash`, `verifyPrivateKeyMatch` so the curve code only ships to consumers that need it

### Patch Changes



- [#337](https://github.com/ckb-devrel/ccc/pull/337) [`0366786`](https://github.com/ckb-devrel/ccc/commit/03667865d1bc6d091d9144d39f6b434abe4ce18b) Thanks [@Hanssen0](https://github.com/Hanssen0)! - feat(did-ckb): add did-ckb package for basic did operations



- [#379](https://github.com/ckb-devrel/ccc/pull/379) [`f01a05b`](https://github.com/ckb-devrel/ccc/commit/f01a05bab332d9f4e0cf7f84aecfd688f8e9f346) Thanks [@Hanssen0](https://github.com/Hanssen0)! - chore: bump pnpm to v11.8.0

- Updated dependencies [[`1148a5c`](https://github.com/ckb-devrel/ccc/commit/1148a5c403cde985fb4ba713ccfa0c163d287174), [`bf0f8d8`](https://github.com/ckb-devrel/ccc/commit/bf0f8d8ca011e627821445a10bc38519510e5b9d), [`a803d5f`](https://github.com/ckb-devrel/ccc/commit/a803d5fba8d0e082c6aba14db156856025402e72), [`bf0f8d8`](https://github.com/ckb-devrel/ccc/commit/bf0f8d8ca011e627821445a10bc38519510e5b9d), [`3bd5130`](https://github.com/ckb-devrel/ccc/commit/3bd51300d9602482dd781752f618f6cfd642675c), [`6727ffe`](https://github.com/ckb-devrel/ccc/commit/6727ffe05f60e6bfb2060a565c19acb0fd0f375e), [`f01a05b`](https://github.com/ckb-devrel/ccc/commit/f01a05bab332d9f4e0cf7f84aecfd688f8e9f346), [`a526890`](https://github.com/ckb-devrel/ccc/commit/a5268909ea9d61c4e2f5187a43e2318327b27cae), [`4bb3d9d`](https://github.com/ckb-devrel/ccc/commit/4bb3d9d2ef36b3ee8820036625abd9befb1980c4), [`9f7ecb6`](https://github.com/ckb-devrel/ccc/commit/9f7ecb6ab8db9c6866dad029f2888e1e5cfcbe7d)]:
  - @ckb-ccc/core@1.13.0
  - @ckb-ccc/type-id@0.0.1
