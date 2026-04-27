<p align="center">
  <a href="https://app.ckbccc.com/">
    <img alt="Logo" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/logoAndText.svg" style="height: 8rem; max-width: 90%; padding: 0.5rem 0;" />
  </a>
</p>

<h1 align="center" style="font-size: 64px;">
  @ckb-ccc/shell
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@ckb-ccc/shell"><img
    alt="NPM Version" src="https://img.shields.io/npm/v/%40ckb-ccc%2Fshell"
  /></a>
  <img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/ckb-devrel/ccc" />
  <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/ckb-devrel/ccc/master" />
  <img alt="GitHub branch check runs" src="https://img.shields.io/github/check-runs/ckb-devrel/ccc/master" />
  <a href="https://live.ckbccc.com/"><img
    alt="Playground" src="https://img.shields.io/website?url=https%3A%2F%2Flive.ckbccc.com%2F&label=Playground"
  /></a>
  <a href="https://app.ckbccc.com/"><img
    alt="App" src="https://img.shields.io/website?url=https%3A%2F%2Fapp.ckbccc.com%2F&label=App"
  /></a>
  <a href="https://docs.ckbccc.com/"><img
    alt="Docs" src="https://img.shields.io/website?url=https%3A%2F%2Fdocs.ckbccc.com%2F&label=Docs"
  /></a>
</p>

<p align="center">
  CCC - CKBers' Codebase is a one-stop solution for your CKB JS/TS ecosystem development. 
  <br />
  Empower yourself with CCC to discover the unlimited potential of CKB.
  <br />
  Interoperate with wallets from different chain ecosystems.
  <br />
  Fully enabling CKB's Turing completeness and cryptographic freedom power.
</p>

> CCC for **Node.js backends and scripts** — re-exports everything from `@ckb-ccc/core` without browser-specific UI components. Use this package when building server-side applications, CLI tools, or automation scripts.

## Install

```bash
npm install @ckb-ccc/shell
```

## When to Use `@ckb-ccc/shell` vs Other Packages

| Package | Environment | Includes Wallet UI? |
|---------|-------------|:---:|
| `@ckb-ccc/shell` | **Node.js / backend** | No |
| `@ckb-ccc/ccc` | Browser (any framework) | No |
| `@ckb-ccc/connector-react` | React / Next.js | Yes |

## Quick Start: Query Balance (Node.js)

```typescript
import { ccc } from "@ckb-ccc/shell";

const client = new ccc.ClientPublicTestnet();

// Parse an address to get its lock script
const { script: lock } = await ccc.Address.fromString(
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq...",
  client,
);

// Query balance
const balance = await client.getBalanceSingle(lock);
console.log(`Balance: ${ccc.fixedPointToString(balance)} CKB`);
```

## Quick Start: Transfer CKB (Node.js)

```typescript
import { ccc } from "@ckb-ccc/shell";

const client = new ccc.ClientPublicTestnet();
const signer = new ccc.SignerCkbPrivateKey(client, process.env.CKB_PRIVATE_KEY!);
await signer.connect();

// Parse receiver address
const { script: receiverLock } = await ccc.Address.fromString(
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq...",
  client,
);

// Build, complete, and send transaction
const tx = ccc.Transaction.from({
  outputs: [{ capacity: ccc.fixedPointFrom(100), lock: receiverLock }],
});
await tx.completeInputsByCapacity(signer);
await tx.completeFeeBy(signer);

const txHash = await signer.sendTransaction(tx);
console.log(`Sent: ${txHash}`);

// Wait for confirmation
await client.waitTransaction(txHash);
console.log("Confirmed!");
```

## Quick Start: Find Cells

```typescript
import { ccc } from "@ckb-ccc/shell";

const client = new ccc.ClientPublicTestnet();
const signer = new ccc.SignerCkbPrivateKey(client, process.env.CKB_PRIVATE_KEY!);
await signer.connect();

// Iterate over all cells owned by the signer
for await (const cell of signer.findCells({})) {
  console.log(
    `Cell: ${cell.outPoint.txHash}:${cell.outPoint.index}`,
    `Capacity: ${ccc.fixedPointToString(cell.cellOutput.capacity)} CKB`,
  );
}
```

## Links

- [API Reference](https://api.ckbccc.com)
- [Documentation](https://docs.ckbccc.com)
- [GitHub](https://github.com/ckb-devrel/ccc)
