---
name: ccc-conversions
description: Enforce use of CCC conversion utilities over manual hex/byte/number implementations in this monorepo
version: 1
---

# CCC Conversion Utilities — Mandatory Usage

When writing or modifying code in this repository, always prefer the conversion utilities
exported from `@ckb-ccc/*` packages over manual implementations.

## Preferred utilities

| Need | Use | Never write |
|------|-----|-------------|
| hex string → bigint | `ccc.numFrom(hex)` | `BigInt(hex)`, `parseInt(hex, 16)` |
| number/bigint → hex string | `ccc.numToHex(n)` | `` `0x${n.toString(16)}` `` |
| hex string → `Uint8Array` | `ccc.bytesFrom(hex)` | `Buffer.from(hex.slice(2), "hex")` |
| `Uint8Array` → hex string | `ccc.hexFrom(bytes)` | manual loop / `Buffer.toString("hex")` |
| decimal string → hex | `ccc.numToHex(BigInt(s))` | `` `0x${BigInt(s).toString(16)}` `` |
| CKB hash | `ccc.hashCkb(bytes)` | custom SHA256/blake2b calls |

## Rules

1. **Import source**: import `ccc` from whichever `@ckb-ccc/*` package is already a
   dependency of the file (e.g. `@ckb-ccc/connector-react` in demo pages,
   `@ckb-ccc/core` in library code).
2. **No raw `BigInt(hex)`** for hex-encoded numbers — use `ccc.numFrom(hex)`.
3. **No manual hex construction** (template literals with `.toString(16)`) — use `ccc.numToHex`.
4. **No `Buffer` / `TextDecoder` for byte↔hex** — use `ccc.bytesFrom` / `ccc.hexFrom`.
5. **Keep display wrappers thin**: if a helper converts a CCC type to a display string
   (e.g. `hexToCkb`), it must still delegate the parsing step to a CCC utility.
6. Exception: pure string operations like `maskKey` (slicing, truncating) have no CCC
   equivalent and may remain manual.
