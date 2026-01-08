import { ccc } from "@ckb-ccc/ccc";
import { render, signer } from "@ckb-ccc/playground";

// Construct create did tx
const { tx } = await ccc.didCkb.createDidCkb({
  signer,
  data: { value: { document: {} } },
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
