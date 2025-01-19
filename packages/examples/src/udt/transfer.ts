import { ccc } from "@ckb-ccc/ccc";
import { render, signer } from "@ckb-ccc/playground";

// NOTE: Please use ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqgtlcnzzna2tqst7jw78egjpujn7hdxpackjmmdp as the signer
const executor = new ccc.ssri.ExecutorJsonRpc("http://localhost:9090");

const pudtScriptCell = await signer.client.findSingletonCellByType({
  // TypeID Code Hash. Don't change
  codeHash:
    "0x00000000000000000000000000000000000000000000000000545950455f4944",
  hashType: "type",
  // TypeID args. Change it to the args of the Type ID script of your UDT
  args: "0x8fd55df879dc6176c95f3c420631f990ada2d4ece978c9512c39616dead2ed56",
});
if (!pudtScriptCell) {
  throw new Error("PUDT script cell not found");
}

const pudtCodeHash = pudtScriptCell.cellOutput.type?.hash();
if (!pudtCodeHash) {
  throw new Error("PUDT code hash not found");
}
const pudtType = {
  codeHash: pudtCodeHash,
  hashType: "type",
  args: "0x02c93173368ec56f72ec023f63148461b80e7698eddd62cbd9dbe31a13f2b330",
};

const pudt = new ccc.udt.Udt(pudtScriptCell.outPoint, pudtType, {
  executor,
});

const pausedReceiver =
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqw6vjzy9kahx3lyvlgap8dp8ewd8g80pcgcexzrj";

// NOTE: Here we are using the same sender and receiver to avoid draining the sender's balance
const receiverA =
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqgtlcnzzna2tqst7jw78egjpujn7hdxpackjmmdp";

const receiverB =
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqgtlcnzzna2tqst7jw78egjpujn7hdxpackjmmdp";

// Parse the receiver script from an address
const { script: pausedReceiverScript } = await ccc.Address.fromString(
  pausedReceiver,
  signer.client,
);

const { script: lockA } = await ccc.Address.fromString(
  receiverA,
  signer.client,
);
const { script: lockB } = await ccc.Address.fromString(
  receiverB,
  signer.client,
);

let pudtTransferTx = (
  await pudt.transfer(signer, [
    {
      to: lockA,
      amount: 100,
    },
    {
      to: lockB,
      amount: 200,
    },
  ])
).res;

await render(pudtTransferTx);

pudtTransferTx = await pudt.completeBy(pudtTransferTx, signer);
await pudtTransferTx.completeFeeBy(signer);
const pudtTransferTxHash = await signer.sendTransaction(pudtTransferTx);

console.log(pudtTransferTxHash);
// "0x20d2f9456b3cd1bf21b32bcffcb91dac68e0cf63e24b496a3a06420080dd08b6"

// NOTE: As PUDT is in fact a pauseable UDT which paused transactions, though we instantiated it as a UDT, it still pauses transactions when the script is paused.
let shouldPudtPauseTx = (
  await pudt.transfer(signer, [
    {
      to: pausedReceiverScript,
      amount: 1000,
    },
    {
      to: lockA,
      amount: 2000,
    },
  ])
).res;

shouldPudtPauseTx = await pudt.completeBy(shouldPudtPauseTx, signer);
await shouldPudtPauseTx.completeFeeBy(signer);

// This would fail. Catches the error.
try {
  await signer.sendTransaction(shouldPudtPauseTx);
} catch (error: unknown) {
  console.log(
    "Transaction for PUDT failed as expected:",
    error instanceof Error ? error.message : String(error),
  );
}
// "Transaction for PUDT failed as expected:" "Client request error TransactionFailedToVerify: Verification failed Script(TransactionScriptError { source: Outputs[0].Type, cause: ValidationFailure: see error code 38 on page https://nervosnetwork.github.io/ckb-script-error-codes/by-type-hash/e90b50ef545432240bfe1e413179cbcf522cad16516c061f7f7e7ff39f775249.html#38 })"
