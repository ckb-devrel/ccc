# @ckb-ccc/ssri

SSRI (Script-Sourced Rich Information) protocol support for CCC. SSRI is a standard for CKB scripts to expose metadata and callable methods, enabling rich interactions with on-chain scripts.

[![NPM Version](https://img.shields.io/npm/v/%40ckb-ccc%2Fssri)](https://www.npmjs.com/package/@ckb-ccc/ssri)

## Installation

```bash
npm install @ckb-ccc/ssri
```

> **Note**: This is the **base package** for SSRI-compliant script interaction. If you want to work with UDT tokens, use [`@ckb-ccc/udt`](https://www.npmjs.com/package/@ckb-ccc/udt) directly — it supports both SSRI-compliant UDT and legacy xUDT, and includes this package.

## What is SSRI?

SSRI (Script-Sourced Rich Information) allows CKB scripts to expose:

- **Metadata** — Token name, symbol, decimals, icon URL, etc.
- **Callable methods** — Transfer, mint, pause, etc.

This is analogous to how Ethereum smart contracts expose ABI methods, but for CKB's Cell model.

Read more: [[EN/CN] Script-Sourced Rich Information](https://talk.nervos.org/t/en-cn-script-sourced-rich-information-script/8256)

## Key Classes

| Class | Description |
|-------|-------------|
| `Executor` | Communicates with an SSRI server to call script methods |
| `Trait` | Base class for SSRI-compliant scripts (extended by `Udt`, `UdtPausable`, etc.) |

## Usage

```typescript
import { ccc } from "@ckb-ccc/ccc";

// SSRI is available via ccc.ssri.*
// In practice, you typically use @ckb-ccc/udt which wraps SSRI:
const udt = new ccc.udt.Udt(codeOutPoint, typeScript);
const name = await udt.name();       // SSRI call
const symbol = await udt.symbol();   // SSRI call
```

## Related Projects

- [`ssri-server`](https://github.com/ckb-devrel/ssri-server) — Server for calling SSRI methods
- [`ckb_ssri_sdk`](https://github.com/ckb-devrel/ckb_ssri_sdk) — Toolkit for building SSRI-compliant scripts with production-level `pausable-udt` example

## Links

- [SSRI Discussion](https://talk.nervos.org/t/en-cn-script-sourced-rich-information-script/8256)
- [CCC Documentation](https://docs.ckbccc.com)
- [CCC GitHub](https://github.com/ckb-devrel/ccc)
