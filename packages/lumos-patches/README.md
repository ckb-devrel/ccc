# @ckb-ccc/lumos-patches

Patches for using [Lumos](https://github.com/ckb-js/lumos) with CCC wallet signers. This package enables Lumos-based applications to use CCC's multi-chain wallet support (JoyID, Nostr, Portal Wallet) without rewriting transaction composition code.

[![NPM Version](https://img.shields.io/npm/v/%40ckb-ccc%2Flumos-patches)](https://www.npmjs.com/package/@ckb-ccc/lumos-patches)

> **⚠️ Important Notice: Lumos is no longer actively maintained or upgraded.**
>
> We strongly recommend that existing applications written with Lumos be migrated to use CCC directly. This package is provided only as a compatibility layer for gradual migration.

## Installation

```bash
npm install @ckb-ccc/lumos-patches
```

## When to Use

- You have an **existing Lumos-based application** and want to add CCC wallet support
- You want to use JoyID, Nostr, or Portal Wallet with Lumos
- You are **not** ready to fully migrate from Lumos to CCC for transaction composition

> **For new projects**, we recommend using CCC directly instead of Lumos + patches.

## Usage

```typescript
import { registerCustomLockScriptInfos } from "@ckb-lumos/common-scripts";
import { generateDefaultScriptInfos } from "@ckb-ccc/lumos-patches";

// Register CCC script infos before using Lumos
// This replaces @ckb-lumos/joyid — you don't need that package anymore
registerCustomLockScriptInfos(generateDefaultScriptInfos());

// Now Lumos can work with JoyID, Nostr, and Portal Wallet signers
```

## What It Patches

| Wallet | Previous Requirement | With This Patch |
|--------|---------------------|-----------------|
| JoyID | `@ckb-lumos/joyid` | Built-in |
| Nostr (NIP-07) | Not supported | Built-in |
| Portal Wallet | Not supported | Built-in |

## Links

- [Lumos GitHub](https://github.com/ckb-js/lumos)
- [CCC Documentation](https://docs.ckbccc.com)
- [CCC GitHub](https://github.com/ckb-devrel/ccc)
