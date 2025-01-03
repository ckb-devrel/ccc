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
- To instantialize a `UDT` contract compliant with SSRI, you need to set up the SSRI server first, and also specify the OutPoint of the contract code. You can also directly instantialize a `UDTPausable` in the same way.
```ts
import { udt } from "@ckb-ccc/udt";

const { signer } = useApp();
const contractOutPointTx: ccc.Hex = "0x4e2e832e0b1e7b5994681b621b00c1e65f577ee4b440ef95fa07db9bb3d50269";
const contractOutPointIndex = 0;
const SSRIServerURL:string = "http://localhost:9090"

const testSSRIServer = new ssri.Server(signer.client, SSRIServerURL);
const testOutPoint = {
  txHash: contractOutPointTx,
  index: parseInt(contractOutPointIndex)
};

const udtContract = new udt.UDT(testSSRIServer, testOutPoint);
const udtPausableContract = new udt.UDTPausable(testSSRIServer, testOutPoint);
```
Alternatively, you can instantiate an `UDT` contract even if it's an `xUDT` contract by using `udt.UDT.fallbackToXudt` as constructor. However, this only works for `UDT` contract.
```ts
import { udt } from "@ckb-ccc/udt";
import { ccc } from "@ckb-ccc/ccc";

const { signer } = useApp();
const xudtTypeScript = await ccc.Script.fromKnownScript(
  signer.client,
  ccc.KnownScript.XUdt,
  "0xf8f94a13dfe1b87c10312fb9678ab5276eefbe1e0b2c62b4841b1f393494eff2",
); 

// Or you can instantiate your own Type Script if it is compatible with sUDT or xUDT behaviors.
const fallbackScript = {
  codeHash: xudtTypeScript.codeHash,
  hashType: xudtTypeScript.hashType as ccc.HashType,
  args: xudtTypeScript.args
} as ccc.Script;

const fallbackName: string = "SEAL for testing UDT";
const fallbackSymbol: string = "SEAL";
const fallbackDecimals: string = "6"

// TODO: When ckb-udt-indexer becomes available, providing fallbackScript would automatically retrieve name, symbol, and decimals.
const xudtFallbackContract = udt.UDT.fallbackToXudt(
  signer.client,
  fallbackScript,
  fallbackName,
  fallbackSymbol,
  BigInt(fallbackDecimals),
)
```

You can directly call the methods in the contract:

```ts
const udtSymbol = await udtContract.symbol();
const pauseList = await udtPausableContract.enumeratePaused();

const userAddress = await signer.getRecommendedAddress();
const balanceOfUser = await xudtFallbackContract.balanceOf(userAddress);
```

Some of the methods can return a `ccc.Transaction`, but you might need to call with the correct `ssri.CallParams,` based on the method's documentation:

```ts
  /**
   * Transfers UDT to specified addresses.
   * @param {ccc.Transaction | undefined} [tx] - Transfer on the basis of an existing transaction to achieve combined actions. If not provided, a new transaction will be created.
   * @param {ccc.Script} toLockArray - The array of lock scripts for the recipients.
   * @param {number[]} toAmountArray - The array of amounts to be transferred.
   * @param {ssri.CallParams} [params] - The parameters for the call.
   * @returns {Promise<{ tx: Transaction }>} The transaction result.
   * @tag Script - This method requires a script level call. The script is the target Type Script for the UDT.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction to be sent.
   * @tag Fallback - Supports xUDT fallback behavior when initialized with fallbackToXudt.
   */
  async transfer(
    tx: ccc.Transaction | undefined,
    toLockArray: ccc.Script[],
    toAmountArray: number[],
    params?: ssri.CallParams,
  ): Promise<ccc.Transaction>
```

for example, you can call `transfer` with the following params:
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

const transferTx = await udtContract.transfer([receiverLock], [100], { script: 
  {
    code_hash: usdiScript.codeHash,
    hash_type: usdiScript.hashType,
    args: usdiScript.args,
  } as ssri.Script
})

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