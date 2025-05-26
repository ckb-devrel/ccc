# Quick Starts: Interact with SSRI-Compliant UDT Script with @ckb-ccc/udt

> The following guide uses UDT and Pausable UDT as example and assume you're using the playground environment which provides the signer. Your signer would be different based on your project setup.

## Example 1: Prepare and Setup a UDT instance

1. Create or setup your project with CCC (see guide [here](https://docs.ckbccc.com/index.html#md:quick-start-with-create-ccc-app-recommended))

2. Start up your local SSRI server through docker:

```shell
docker run -p 9090:9090 hanssen0/ckb-ssri-server
```

3. Prepare the `OutPoint` of your SSRI-compliant UDT script. It's recommended to deploy your UDT script with Type ID, and the following way would allow you to get the `OutPoint` programmatically even if the script gets upgraded:

```ts
import { ccc } from "@ckb-ccc/ccc";
import { signer } from "@ckb-ccc/playground";
// Note: Your signer would be different based on your project setup.

const pudtScriptCell = await signer.client.findSingletonCellByType({
  codeHash:
    "0x00000000000000000000000000000000000000000000000000545950455f4944",
  hashType: "type",
  args: "0xf0bad0541211603bf14946e09ceac920dd7ed4f862f0ffd53d0d477d6e1d0f0b",
});
if (!scriptCell) {
  throw new Error("pudt script cell not found");
}
```

4. Prepare the Type script object of your UDT. You can provide the code hash yourself by copying from the explorer, or get it programmatically from the `OutPoint` of your UDT script.

```ts
const pudtCodeHash = pudtScriptCell.cellOutput.type?.hash();
if (!pudtCodeHash) {
  throw new Error("PUDT code hash not found");
}
const pudtType = {
  codeHash: pudtCodeHash,
  hashType: "type",
  args: "0x02c93173368ec56f72ec023f63148461b80e7698eddd62cbd9dbe31a13f2b330",
};
```

5. You have everything ready, now you can create an instance of your UDT and interact with it.

```ts
const executor = new ccc.ssri.ExecutorJsonRpc("http://localhost:9090");
const pudt = new ccc.udt.Udt(pudtScriptCell.outPoint, pudtType, {
  executor,
});
const pudtName = await pudt.name();
const pudtIcon = await pudt.icon();
console.log(pudtName);
// {"res":"pudt Token","cellDeps":[]}
console.log(pudtIcon);
// {"res":"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjQ ......
```

The same script might have implemented multiple SSRI traits or sub-traits at the same time, but you can instantiate the same script arbitrarily with different traits as long as the script implemented the traits you want.

```ts
const pudt = new ccc.udt.UdtPausable(pudtScriptCell.outPoint, pudtType, {
  executor,
});
const pudtEnumeratePaused = await pudt.enumeratePaused();
console.log(pudtEnumeratePaused);
// {"res":["0xb5202efa0f2d250af66f0f571e4b8be8b272572663707a052907f8760112fe35","0xa320a09489791af2e5e1fe84927eda84f71afcbd2c7a65cb419464fe46e75085"],"cellDeps":[{"txHash":"0x98c37eabc1672c4a0a30c0bb284ed49308f0cb58b0d8791f44cca168c973e7da","index":"0"}]}
```

## Example 2: Generate and Send a Transaction through @ckb-ccc/udt

1. Some of the methods allows you to generate a transaction object directly while taking care of most of the details for you. You just need to follow the guidance of the docs provided via your IDE.

```ts
const receiverA =
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq2jk6pyw9vlnfakx7vp4t5lxg0lzvvsp3c5adflu";

const { script: lockA } = await ccc.Address.fromString(
  receiverA,
  signer.client
);

const pudtTransferTx = (
  await pudt.transfer(signer, [
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
  await pudt.transfer(
    signer,
    [
      {
        to: lockB,
        amount: 20000,
      },
    ],
    pudtTransferTx
  )
).res;
```

2. You only need to complete the inputs of the transaction just like processing any other transactions with CCC.

```ts
// Note: You need to connect your wallet for the following parts. You also need to have enough balance of pudt in your wallet.
combinedTransferTx = await pudt.completeBy(combinedTransferTx, signer);
await combinedTransferTx.completeFeeBy(signer);
await render(combinedTransferTx);
const combinedTransferTxHash = await signer.sendTransaction(combinedTransferTx);

console.log(combinedTransferTxHash);
```

Full runnable example can be found at [here](https://live.ckbccc.com/?src=nostr:nevent1qqs8q20jvxqfsrhqw4te248qduex39dgls7qajhuc42kale0yqatdhspzemhxue69uhhyetvv9ujumn0wd68ytnzv9hxgqg5waehxw309ahx7um5wghx77r5wghxgetkqy28wumn8ghj7un9d3shjtnyv9kh2uewd9hspusjlf)
