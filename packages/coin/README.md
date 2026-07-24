<p align="center">
  <a href="https://app.ckbccc.com/">
    <img alt="Logo" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/logoAndText.svg" style="height: 8rem; max-width: 90%; padding: 0.5rem 0;" />
  </a>
</p>

<h1 align="center" style="font-size: 48px;">
  CCC's Support for Coin
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@ckb-ccc/coin"><img
    alt="NPM Version" src="https://img.shields.io/npm/v/%40ckb-ccc%2Fcoin"
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

## Quick Start

`Coin` from `@ckb-ccc/coin` is a generic helper for on-chain fungible tokens identified by a CKB type script.

### Instantiate

```ts
import { Coin } from "@ckb-ccc/coin";
import { ccc } from "@ckb-ccc/core";

// Classic instantiation with explicit script and cellDeps
const coin = new Coin({
  script: {
    codeHash: "0x...",
    hashType: "type",
    args: "0x...",
  },
  client,
  cellDeps: [{ outPoint: codeOutPoint, depType: "code" }],
});

// Instantiation via knownScript (e.g., sUDT)
const sUdt = new Coin({
  knownScript: ccc.KnownScript.SUdt,
  script: {
    args: ownerLock.hash(),
  },
  client,
});

// Instantiation of xUDT via CoinXUdt with structured args
import { CoinXUdt } from "@ckb-ccc/coin";

const xUdt = new CoinXUdt({
  xUdtArgs: {
    ownerScriptHash: ownerLock.hash(),
    ownerModeOutputType: true,
  },
  client,
});
```

### Query balance

```ts
// Total balance across all cells of the signer
const balance = await coin.calculateBalance(signer);
console.log(`Balance: ${balance}`);

// Full info: Balance + CKB capacity + cell count
const info = await coin.calculateInfo(signer);
console.log(`Balance: ${info.amount}, Cells: ${info.count}`);
```

### Send

Build the transaction manually, then use `completeBy` to add Coin inputs and a change output:

```ts
const coin = new Coin({
  knownScript: ccc.KnownScript.SUdt,
  script: {
    args: ownerLock.hash(),
  },
  client,
});

const { script: to } = await signer.getRecommendedAddressObj();

// Build outputs
const { tx } = await coin.transfer([{ to, amount: 1000n }]);

// Add Coin inputs + change (change goes back to signer)
const { tx: completedTx } = await coin.completeBy(signer, tx);

// Cover CKB capacity and fee
await completedTx.completeInputsByCapacity(signer);
await completedTx.completeFeeBy(signer);

const txHash = await signer.sendTransaction(completedTx);
```

### Change to a specific address

```ts
const { script: changeLock } = await signer.getRecommendedAddressObj();
const { tx: completedTx } = await coin.completeChangeToLock(
  signer,
  changeLock,
  tx,
);
```

## Extensible UDT (xUDT) Support

`CoinXUdt` extends `Coin` to provide specialized support for RFC 52 extensible UDT (xUDT).

- **Args Encoding/Decoding**: Provides `CoinXUdtArgs` to correctly build and parse xUDT type script arguments, supporting owner-mode flags.
- **Default Known Script**: When `knownScript` is omitted, `CoinXUdt` uses `ccc.KnownScript.XUdt`. A complete `script` with `codeHash` and `hashType` takes priority over this shorthand. Pass `script.args` to use existing xUDT args, or pass `xUdtArgs` to build args from `ownerScriptHash` and `flags`.
- **Underlying Coin Compatibility**: Inherits all query, transfer, and transaction completion methods of the generic `Coin` class.

## Learn More?

Check the [package documentation](https://docs.ckbccc.com/docs/packages/protocol-sdks/coin) and [API reference](https://api.ckbccc.com/classes/_ckb-ccc_coin.coin) for more details.

<h3 align="center">
  Read more about CCC on <a href="https://docs.ckbccc.com">our website</a> or <a href="https://github.com/ckb-devrel/ccc">GitHub Repo</a>.
</h3>
