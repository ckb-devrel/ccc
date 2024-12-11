<p align="center">
  <a href="https://app.ckbccc.com/">
    <img alt="Logo" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/logoAndText.svg" style="height: 8rem; max-width: 90%; padding: 0.5rem 0;" />
  </a>
</p>

<h1 align="center" style="font-size: 48px;">
  CCC's Support for User Defined Token (UDT)
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

## Quick Start

- At the moment, `UDT` and `UDTPausable` from `@ckb-ccc/udt` are fully supported through SSRI. In the future, there will be built in TypeScript generation directly based on the Rust source code on compilation.
- To instantiate a `UDT` script compliant with SSRI, you can provide the SSRI server url and also specify the OutPoint of the script code.
- You can also instantiate a `UDTPausable` script or other scripts that extends from `UDT`.

```ts
import { Server } from "@ckb-ccc/ssri";
import { Udt, UdtPausable } from "@ckb-ccc/udt";

const { signer } = useApp();
const server = new Server("https://localhost:9090");

const udt = new Udt(
  server,
  {
    txHash: "0x...",
    index: 0,
  },
  {
    codeHash: "0x...",
    hashType: "type",
    args: "0x...",
  },
);

const udtPausable = new UdtPausable(
  server,
  {
    txHash: "0x...",
    index: 0,
  },
  {
    codeHash: "0x...",
    hashType: "type",
    args: "0x...",
  },
);
```

You can directly call the methods in the script:

```ts
const { res: udtSymbol } = await udt.symbol();
const { res: pauseList } = await udtPausable.enumeratePaused();
```

Some of the methods can return a `ccc.Transaction`. For example, you can call `transfer` with the following params:

```ts
const { script: to } = await signer.getRecommendedAddressObj();

const { res: transferTx } = await udt.transfer(signer, [{ to, amount: 100 }]);
const completedTx = await udt.completeUdtBy(transferTx, signer);

await completedTx.completeInputsByCapacity(signer);
await completedTx.completeFeeBy(signer);
const transferTxHash = await signer.sendTransaction(completedTx);
```

<h3 align="center">
  Read more about CCC on <a href="https://docs.ckbccc.com">our website</a> or <a href="https://github.com/ckb-devrel/ccc">GitHub Repo</a>.
</h3>
