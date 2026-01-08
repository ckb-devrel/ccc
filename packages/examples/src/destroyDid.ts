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

// Construct destroy did tx
const { tx } = await ccc.didCkb.destroyDidCkb({ client: signer.client, id });

// Complete missing parts: Fill inputs
await tx.completeInputsByCapacity(signer);
await render(tx);

// Complete missing parts: Pay fee
await tx.completeFeeBy(signer);
await render(tx);

// Sign and send the transaction
const txHash = await signer.sendTransaction(tx);
console.log(`Transaction ${txHash} sent`);
