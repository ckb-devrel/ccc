# @ckb-ccc/ccc

The aggregated CCC package for browser environments. This is the **all-in-one** package that bundles `@ckb-ccc/core` with all wallet signers and protocol packages. Use this when you want to build a custom wallet connection UI without the built-in connector modal.

[![NPM Version](https://img.shields.io/npm/v/%40ckb-ccc%2Fccc)](https://www.npmjs.com/package/@ckb-ccc/ccc)

## Installation

```bash
npm install @ckb-ccc/ccc
```

## When to Use This Package

| Your Scenario | Package |
|---------------|---------|
| React app with built-in wallet modal | `@ckb-ccc/connector-react` |
| Non-React frontend with built-in modal | `@ckb-ccc/connector` |
| **Custom wallet UI (no built-in modal)** | **`@ckb-ccc/ccc` ← this package** |
| Node.js backend / script | `@ckb-ccc/shell` |

## What's Included

`@ckb-ccc/ccc` re-exports everything from:

- **`@ckb-ccc/core`** — Transaction, Cell, Script, Client, Signer, etc.
- **`@ckb-ccc/udt`** — UDT/xUDT token operations (`ccc.udt.*`)
- **`@ckb-ccc/spore`** — Spore/DOB NFT operations (`ccc.spore.*`)
- **`@ckb-ccc/ssri`** — SSRI protocol (`ccc.ssri.*`)
- **All wallet signers** — JoyID, MetaMask (EIP-6963), UniSat, OKX, Xverse, NIP-07, Rei, UTXO Global
- **`SignersController`** — Manages automatic discovery and lifecycle of all wallet signers

## Usage

```typescript
import { ccc } from "@ckb-ccc/ccc";

const client = new ccc.ClientPublicTestnet();

// Use SignersController to discover all available wallets
const controller = new ccc.SignersController(client);
controller.subscribeSigners((signerInfo) => {
  console.log(`Found wallet: ${signerInfo.name}`);
});

// Or use a specific signer directly
const signer = new ccc.SignerCkbPrivateKey(client, "0x...");
await signer.connect();
const balance = await signer.getBalance();
```

## Advanced Exports

```typescript
import { cccA } from "@ckb-ccc/ccc/advanced";
// cccA contains unstable/internal APIs — use with caution
```

## Links

- [CCC Documentation](https://docs.ckbccc.com)
- [API Reference](https://api.ckbccc.com)
- [CCC Playground](https://live.ckbccc.com/)
- [CCC GitHub](https://github.com/ckb-devrel/ccc)
