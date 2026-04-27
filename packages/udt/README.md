<p align="center">
  <a href="https://app.ckbccc.com/">
    <img alt="Logo" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/logoAndText.svg" style="height: 8rem; max-width: 90%; padding: 0.5rem 0;" />
  </a>
</p>

<h1 align="center" style="font-size: 48px;">
  @ckb-ccc/udt
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@ckb-ccc/udt"><img
    alt="NPM Version" src="https://img.shields.io/npm/v/%40ckb-ccc%2Fudt"
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

> CCC's support for **User Defined Tokens (UDT)** on CKB — transfer, query balance, and manage xUDT/SSRI-compliant tokens. Similar to ERC-20 tokens on Ethereum, but built on CKB's Cell model.

## What is UDT?

UDT (User Defined Token) is CKB's fungible token standard. Each UDT balance is stored in a Cell's `data` field, with a `type script` identifying the token. The most common implementation is **xUDT** (extensible UDT).

## Install

```bash
npm install @ckb-ccc/udt
```

## Quick Start: Transfer UDT (xUDT)

This is the most common use case — transferring xUDT tokens:

```typescript
import { ccc } from "@ckb-ccc/ccc";

const client = new ccc.ClientPublicTestnet();
const signer = new ccc.SignerCkbPrivateKey(client, "0xYOUR_PRIVATE_KEY");
await signer.connect();

// 1. Set up the UDT type script (identifies this specific token)
const type = await ccc.Script.fromKnownScript(
  signer.client,
  ccc.KnownScript.XUdt,
  "0xOWNER_LOCK_HASH...",  // The lock hash that uniquely identifies this token
);

// 2. Get the xUDT code cell info
const xudtInfo = await signer.client.getKnownScript(ccc.KnownScript.XUdt);
const code = (await signer.client.getCellDeps(xudtInfo.cellDeps))[0].outPoint;

// 3. Create UDT instance
const udt = new ccc.udt.Udt(code, type);

// 4. Build transfer transaction
const { script: receiverLock } = await ccc.Address.fromString(receiverAddress, client);
let { res: tx } = await udt.transfer(signer, [
  { to: receiverLock, amount: ccc.fixedPointFrom(1) },
]);

// 5. Complete UDT inputs, CKB inputs, and fee
tx = await udt.completeBy(tx, signer);
await tx.completeInputsByCapacity(signer);
await tx.completeFeeBy(signer);

// 6. Send
const txHash = await signer.sendTransaction(tx);
```

## SSRI-Compliant UDT

For tokens that support the SSRI protocol, you get additional metadata methods:

```typescript
import { Udt, UdtPausable } from "@ckb-ccc/udt";

const udt = new Udt(code, type);

// Query token metadata (SSRI-compliant tokens only)
const { res: name } = await udt.name();       // e.g., "My Token"
const { res: symbol } = await udt.symbol();    // e.g., "MTK"
const { res: decimals } = await udt.decimals(); // e.g., 8
```

## UDTPausable

For tokens with pause functionality:

```typescript
import { UdtPausable } from "@ckb-ccc/udt";

const udtPausable = new UdtPausable(code, type);

// Check pause list
const { res: pauseList } = await udtPausable.enumeratePaused();
```

## API Overview

### `Udt` Methods

| Method | Description |
|--------|-------------|
| `transfer(signer, [{to, amount}])` | Build a transfer transaction |
| `completeBy(tx, signer)` | Complete UDT inputs for a transaction |
| `name()` | Get token name (SSRI only) |
| `symbol()` | Get token symbol (SSRI only) |
| `decimals()` | Get token decimals (SSRI only) |
| `balance(address)` | Get token balance (SSRI only) |
| `icon()` | Get token icon URL (SSRI only) |

### Transaction Completion Order

When transferring UDT, the correct order is:

```typescript
// 1. Build the UDT transfer
let { res: tx } = await udt.transfer(signer, transfers);
// 2. Complete UDT inputs (gather enough token cells)
tx = await udt.completeBy(tx, signer);
// 3. Complete CKB capacity inputs
await tx.completeInputsByCapacity(signer);
// 4. Complete fee
await tx.completeFeeBy(signer);
// 5. Send
const txHash = await signer.sendTransaction(tx);
```

## Links

- [API Reference](https://api.ckbccc.com)
- [Documentation](https://docs.ckbccc.com)
- [Playground: Transfer UDT](https://live.ckbccc.com)
- [GitHub](https://github.com/ckb-devrel/ccc)
