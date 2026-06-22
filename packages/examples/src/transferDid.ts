import { ccc } from "@ckb-ccc/ccc";
import { render, signer } from "@ckb-ccc/playground";

// === Create a did first ===
// Check https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/createDid.ts for the full example
const { tx: createTx, id } = await ccc.didCkb.createDidCkb({
  signer,
  data: {
    value: { document: {} },
  },
});
await createTx.completeFeeBy(signer);
await render(createTx);
const createTxHash = await signer.sendTransaction(createTx);
console.log(`Transaction ${createTxHash} sent`);
// === Create a did first ===

// The receiver is the signer itself on mainnet
const receiver = (await signer.getRecommendedAddressObj()).script;
console.log(receiver);

// Construct transfer did tx
const { tx } = await ccc.didCkb.transferDidCkb({
  client: signer.client,
  id,
  receiver,
  data: (_, data) => {
    if (!data) {
      throw Error("Unknown error");
    }

    (data.value.document as Record<string, unknown>)["foo"] = "bar";
    return data;
  },
});

// Complete missing parts: Fill inputs
await tx.completeInputsByCapacity(signer);
await render(tx);

// Complete missing parts: Pay fee
await tx.completeFeeBy(signer);
await render(tx);

// Sign and send the transaction
const txHash = await signer.sendTransaction(tx);
console.log(`Transaction ${txHash} sent`);
