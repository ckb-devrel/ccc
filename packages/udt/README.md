<p align="center">
  <a href="https://app.ckbccc.com/">
    <img alt="Logo" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/logoAndText.svg" style="height: 8rem; max-width: 90%; padding: 0.5rem 0;" />
  </a>
</p>

<h1 align="center" style="font-size: 48px;">
  CCC's Support for User Defined Token (UDT)
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@ckb-ccc/core"><img
    alt="NPM Version" src="https://img.shields.io/npm/v/%40ckb-ccc%2Fcore"
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

<h3 align="center">
  Read more about CCC on <a href="https://docs.ckbccc.com">our website</a> or <a href="https://github.com/ckb-devrel/ccc">GitHub Repo</a>.
  <br />
  <br />
  Based on <a href="https://github.com/ckb-devrel/ccc/tree/master/packages/ssri">@ckb-ccc/ssri</a> with xUDT fallback option.
  <br />
  Try and read about @ckb-ccc/udt at <a href="https://github.com/ckb-devrel/ccc/tree/master/packages/demo">@ckb-ccc/demo</a>.
  <br />
  Tutorial at <a href="https://github.com/Alive24/ckb_ssri_sdk/wiki/How-to-interact-with-an-SSRI-compliant-contract-on-chain">How to interact with an SSRI-compliant contract on chain</a>.
  <br />
  <br />
  
</h3>
<h2> Quick Start </h2>

- At the moment, `UDT` and `UDTPausable` from `@ckb-ccc/udt` are fully supported through SSRI. In the future, there will be built in TypeScript generation directly based on the Rust contract on compilation.
- To instantiate a `UDT` contract compliant with SSRI, you can provide the SSRI server url and also specify the OutPoint of the contract code. Alternatively, You can also instantiate a `UDT` contract in legacy mode that is compatible with xUDT by providing a `ccc.Script` which retrieves name, symbol, and decimals via `ckb-udt-indexer` (To be released).
- You can also instantiate a `UDTPausable` contract or other contracts (To be released) that extends from `UDT`.

```ts
import { udt } from "@ckb-ccc/udt";

const { signer } = useApp();

const testOutPoint = {
  txHash: contractOutPointTx,
  index: parseInt(contractOutPointIndex)
};

const udtSSRI = new UDT(client, 
  { 
    ssriServerURL: "https://localhost:9090", 
    codeOutPoint: { 
      txHash: '0x4e2e832e0b1e7b5994681b621b00c1e65f577ee4b440ef95fa07db9bb3d50269', 
      index: 0 
    } 
  }
);

const udtLegacyXudt = new UDT(
  client, 
  await ccc.Script.fromKnownScript(
    signer.client,
    ccc.KnownScript.XUdt,
    "0xf8f94a13dfe1b87c10312fb9678ab5276eefbe1e0b2c62b4841b1f393494eff2"
  )
);

const udtPausable = new UDTPausable(client, {
  ssriServerURL: "https://localhost:9090",
  codeOutPoint: {
    txHash: '0x4e2e832e0b1e7b5994681b621b00c1e65f577ee4b440ef95fa07db9bb3d50269',
    index: 0
  }
});
```

You can directly call the methods in the contract:

```ts
const udtSymbol = await udtSSRI.symbol();
const userAddress = await signer.getRecommendedAddress();
const balanceOfUser = await udtLegacyXudt.balanceOf(userAddress);

const pauseList = await udtPausable.enumeratePaused();
```

Some of the methods can return a `ccc.Transaction`. For example, you can call `transfer` with the following params:

```ts
const receiver = await signer.getRecommendedAddress();
// The sender script for change
const { script: changeLock } = await signer.getRecommendedAddressObj();
// Parse the receiver script from an address
const { script: receiverLock } = await ccc.Address.fromString(receiver, signer.client);

const usdiScript = {
  codeHash: "0xcc9dc33ef234e14bc788c43a4848556a5fb16401a04662fc55db9bb201987037",
  hashType: ccc.HashType.type,
  args: "0x71fd1985b2971a9903e4d8ed0d59e6710166985217ca0681437883837b86162f"
} as ccc.Script;

const codeCellDep : CellDepLike = {
  outPoint: {
    txHash: "0x4e2e832e0b1e7b5994681b621b00c1e65f577ee4b440ef95fa07db9bb3d50269",
    index: 0,
  },
  depType: 'code',
}

const transferTx = await udtContract.transfer([receiverLock], [100], usdiScript)

await transferTx.completeInputsByUdt(signer, usdiScript)
const balanceDiff =
  (await transferTx.getInputsUdtBalance(signer.client, usdiScript)) -
  transferTx.getOutputsUdtBalance(usdiScript);
if (balanceDiff > ccc.Zero) {
  cccTransferTx.addOutput(
    {
      lock: changeLock,
      type: usdiScript,
    },
    ccc.numLeToBytes(balanceDiff, 16),
  )
}
await transferTx.addCellDeps(codeCellDep)
await transferTx.completeInputsByCapacity(signer)
await transferTx.completeFeeBy(signer)
const transferTxHash = await signer.sendTransaction(transferTx)
```

Read the tutorial at [How to interact with an SSRI-compliant contract on chain](https://github.com/Alive24/ckb_ssri_sdk/wiki/How-to-interact-with-an-SSRI-compliant-contract-on-chain) for more details.
