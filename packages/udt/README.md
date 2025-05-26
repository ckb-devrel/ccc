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

## Note

- Try interactive demo at [CCC App - UDT](https://ccc-git-udtssridemo-aaaaaaaalive24.vercel.app?_vercel_share=zQkvWcsB2U9HRbpRFtF9w3xQT9msZDWb) 
- Currently `ExecutorJsonRpc` is the only supported `Executor`. There will be more in the future and legacy support for `xUDT` will be added through `ckb-asset-indexer`.
> Note: A public SSRI Executor JSON RPC Point is being scheduled, and efforts are being made to make to provide in-browser SSRI execution with WASM.

- At the moment, `UDT` and `UDTPausable` from `@ckb-ccc/udt` are fully supported with SSRI by extending the `ssri.Trait` class in `@ckb-ccc/ssri`. While you can build your own SSRI-based SDK for your SSRI-compliant script in reference to `@ckb-ccc/udt`, in the future, there will be built in TypeScript generation directly based on the Rust source code on compilation.

## Quick Start

1. Create or setup your project with CCC (see guide [here](https://docs.ckbccc.com/index.html#md:quick-start-with-create-ccc-app-recommended))
2. Start up your local SSRI server through docker:

```shell
docker run -p 9090:9090 hanssen0/ckb-ssri-server
```

3. Prepare the `OutPoint` of your SSRI-compliant UDT script. It's recommended to deploy your UDT script with Type ID, and the following way would allow you to get the `OutPoint` programmatically even if the script gets upgraded:

```ts
import { ccc } from "@ckb-ccc/ccc";
import { signer } from "@ckb-ccc/playground";

const udtScriptCell = await signer.client.findSingletonCellByType({
  codeHash:
    "0x00000000000000000000000000000000000000000000000000545950455f4944",
  hashType: "type",
  args: "0xf0bad0541211603bf14946e09ceac920dd7ed4f862f0ffd53d0d477d6e1d0f0b",
});
if (!scriptCell) {
  throw new Error("UDT script cell not found");
}
```

4. Prepare the Type script object of your UDT. You can provide the code hash yourself by copying from the explorer, or get it programmatically from the `OutPoint` of your UDT script.

```ts
const udtCodeHash = udtScriptCell.cellOutput.type?.hash();
if (!udtCodeHash) {
  throw new Error("UDT code hash not found");
}
const udtType = {
  codeHash: udtCodeHash,
  hashType: "type",
  args: "0x02c93173368ec56f72ec023f63148461b80e7698eddd62cbd9dbe31a13f2b330",
};
```

5. You have everything ready, now you can create an instance of your UDT and interact with it.

```ts
const executor = new ccc.ssri.ExecutorJsonRpc("http://localhost:9090");
const udt = new ccc.udt.Udt(udtScriptCell.outPoint, udtType, {
  executor,
});
```

You can directly call the methods in the script:

```ts
const { res: udtSymbol } = await udt.symbol();
```

The same script might have implemented multiple SSRI traits or sub-traits at the same time, but you can instantiate the same script arbitrarily with different traits as long as the script implemented the traits you want.

```ts
const pudt = new ccc.udt.UdtPausable(
  udtScriptCell.outPoint,
  udtType,
  {
    executor,
  },
);
const pudtEnumeratePaused = await pudt.enumeratePaused();
```

## Advanced Usage

1. Some of the methods allows you to generate a transaction object directly while taking care of most of the details for you. You just need to follow the guidance of the docs provided via your IDE.

```ts
const receiverA =
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq2jk6pyw9vlnfakx7vp4t5lxg0lzvvsp3c5adflu";

const { script: lockA } = await ccc.Address.fromString(
  receiverA,
  signer.client
);

const udtTransferTx = (
  await udt.transfer(signer, [
    {
      to: lockA,
      amount: 10000,
    },
  ])
).res;
```

Many of these methods also allow you to pass in a previous `ccc.TransactionLike` object as the second argument, which allows you for example to transfer multiple UDT cells in a single transaction.

```ts
const receiverB =
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqflz4emgssc6nqj4yv3nfv2sca7g9dzhscgmg28x";
const { script: lockB } = await ccc.Address.fromString(
  receiverB,
  signer.client
);
let combinedTransferTx = (
  await udt.transfer(
    signer,
    [
      {
        to: lockB,
        amount: 20000,
      },
    ],
    udtTransferTx
  )
).res;
```

2. You only need to complete the inputs of the transaction just like processing any other transactions with CCC.

```ts
// Note: You need to connect your wallet for the following parts. You also need to have enough balance of the specified UDT in your wallet.
combinedTransferTx = await udt.completeBy(combinedTransferTx, signer);
await combinedTransferTx.completeFeeBy(signer);
await render(combinedTransferTx);
const combinedTransferTxHash = await signer.sendTransaction(combinedTransferTx);

console.log(combinedTransferTxHash);
```

Full runnable example can be found at [here](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/udt/quickstart.ts)


<h3 align="center">
  Read more about CCC on <a href="https://docs.ckbccc.com">our website</a> or <a href="https://github.com/ckb-devrel/ccc">GitHub Repo</a>.
</h3>
