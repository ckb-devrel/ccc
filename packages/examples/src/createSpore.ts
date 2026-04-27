// Example: Create a Spore (on-chain digital object / NFT) on CKB
// Spore Protocol stores content fully on-chain in a Cell's data field.
// Each Spore has a content type (MIME), content data, and optional cluster.

import { ccc } from "@ckb-ccc/ccc";
import { render, signer } from "@ckb-ccc/playground";

// Create a simple text Spore without a cluster
const { tx, id } = await ccc.spore.createSpore({
  signer,
  data: {
    contentType: "text/plain",
    content: ccc.bytesFrom(
      "Hello, Spore! This is a text-based digital object on CKB.",
      "utf8",
    ),
  },
});
await render(tx);

console.log("Spore ID:", id);
console.log("Transaction outputs:", tx.outputs.length);

// Complete fee
await tx.completeFeeBy(signer);
await render(tx);

console.log("Spore creation transaction ready!");
console.log(`The Spore content is stored fully on-chain.`);
console.log(`Content type: text/plain`);
