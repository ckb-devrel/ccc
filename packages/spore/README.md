<p align="center">
  <a href="https://app.ckbccc.com/">
    <img alt="Logo" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/logoAndText.svg" style="height: 8rem; max-width: 90%; padding: 0.5rem 0;" />
  </a>
</p>

<h1 align="center" style="font-size: 48px;">
  @ckb-ccc/spore
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@ckb-ccc/spore"><img
    alt="NPM Version" src="https://img.shields.io/npm/v/%40ckb-ccc%2Fspore"
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

> CCC's support for the [Spore Protocol](https://spore.pro) — create, transfer, melt, and query Spore cells (on-chain digital objects / NFTs) and Clusters on CKB.

## What is Spore?

Spore is CKB's on-chain digital object (DOB) protocol. Each Spore is a Cell that holds its content (image, text, etc.) **fully on-chain**. Spores can optionally belong to a Cluster (similar to an NFT collection).

## Install

```bash
npm install @ckb-ccc/spore
```

## Quick Start: Create a Spore

```typescript
import { ccc } from "@ckb-ccc/core";
import { createSpore } from "@ckb-ccc/spore";

const client = new ccc.ClientPublicTestnet();
const signer = new ccc.SignerCkbPrivateKey(client, "0xYOUR_PRIVATE_KEY");
await signer.connect();

// Create a simple text Spore
let { tx, id } = await createSpore({
  signer,
  data: {
    contentType: "text/plain",
    content: ccc.bytesFrom("Hello, Spore!", "utf8"),
  },
});

// Complete fee and send
await tx.completeFeeBy(signer);
const txHash = await signer.sendTransaction(tx);
console.log(`Spore created! ID: ${id}, TX: ${txHash}`);
```

## Transfer a Spore

```typescript
import { ccc } from "@ckb-ccc/core";
import { transferSpore } from "@ckb-ccc/spore";

// Transfer a Spore to a new owner
const { script: newOwner } = await ccc.Address.fromString(receiverAddress, client);

let { tx } = await transferSpore({
  signer,
  id: "0xSPORE_ID...",
  to: newOwner,
});

await tx.completeFeeBy(signer);
const txHash = await signer.sendTransaction(tx);
```

## Melt (Destroy) a Spore

```typescript
import { meltSpore } from "@ckb-ccc/spore";

let { tx } = await meltSpore({
  signer,
  id: "0xSPORE_ID...",
});

await tx.completeFeeBy(signer);
const txHash = await signer.sendTransaction(tx);
```

## Find a Spore by ID

```typescript
import { findSpore } from "@ckb-ccc/spore";

const result = await findSpore(client, "0xSPORE_ID...");
if (result) {
  console.log("Content type:", result.sporeData.contentType);
  console.log("Content:", ccc.bytesTo(result.sporeData.content, "utf8"));
}
```

## Search Spores by Owner

```typescript
import { findSporesBySigner } from "@ckb-ccc/spore";

for await (const { sporeData, cell } of findSporesBySigner({ signer })) {
  console.log("Spore:", cell.outPoint.txHash);
  console.log("Content type:", sporeData.contentType);
}
```

## API Overview

| Function | Description |
|----------|-------------|
| `createSpore({ signer, data, to?, clusterMode? })` | Create a new Spore cell |
| `transferSpore({ signer, id, to })` | Transfer a Spore to a new owner |
| `meltSpore({ signer, id })` | Destroy a Spore and reclaim its capacity |
| `findSpore(client, id)` | Find a Spore by its ID |
| `findSporesBySigner({ signer })` | Iterate Spores owned by a signer |
| `createCluster({ signer, data })` | Create a new Cluster |
| `transferCluster({ signer, id, to })` | Transfer a Cluster |
| `findCluster(client, id)` | Find a Cluster by its ID |

### `SporeDataView`

```typescript
{
  contentType: string;     // MIME type, e.g. "text/plain", "image/png"
  content: ccc.BytesLike;  // The actual content data
  clusterId?: ccc.HexLike; // Optional: cluster this Spore belongs to
}
```

## Links

- [Spore Protocol](https://spore.pro)
- [API Reference](https://api.ckbccc.com)
- [Documentation](https://docs.ckbccc.com)
- [GitHub](https://github.com/ckb-devrel/ccc)
