---
"@ckb-ccc/did-ckb": minor
---

feat(did-ckb): identifier helpers, resolver, history walk, and did:plc migration

Layered on top of the basic create/transfer/destroy operations:

- `argsToDid`, `didToArgs`, `isDidCkb`, plus RFC 4648 base32 helpers for converting between Type ID args and the human readable `did:ckb:` URI form (WIP-01 §2.2)
- `findDidCkbCell`, `resolveDidCkb`, `listDidCkbsByLock` for resolving a DID by id or by owning lock
- `getDidCkbHistory` walks the cell chain backwards to produce an ordered list of CREATE / UPDATE / MIGRATE entries with tx hash, block number, capacity, and decoded data
- `migrateDidCkb` + `buildMigrationWitness` for importing a `did:plc` into `did:ckb` (WIP-02 §3.1.1)
- `@ckb-ccc/did-ckb/plc` subpath with `fetchPlcLog`, `parseDidKey`, `signRotationHash`, `verifyPrivateKeyMatch` so the curve code only ships to consumers that need it
