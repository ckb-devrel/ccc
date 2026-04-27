// Example: Transfer and query Spore NFTs on CKB
// Spore Protocol provides functions to transfer, melt, and find Spores.

import { ccc } from "@ckb-ccc/ccc";
import { render, signer } from "@ckb-ccc/playground";

// === FIND SPORES OWNED BY THE SIGNER ===
console.log("Searching for Spores owned by the signer...");

const mySpores: { cell: ccc.Cell; sporeData: { contentType: string } }[] = [];
for await (const result of ccc.spore.findSporesBySigner({ signer })) {
  const { sporeData, cell } = result;
  console.log(
    `Spore: ${cell.outPoint.txHash}:${cell.outPoint.index}`,
    `| Content type: ${sporeData.contentType}`,
    `| Capacity: ${ccc.fixedPointToString(cell.cellOutput.capacity)} CKB`,
    `| ID (type args): ${cell.cellOutput.type?.args}`,
  );
  mySpores.push({ cell, sporeData });
}

console.log(`Found ${mySpores.length} Spore(s)`);

if (mySpores.length === 0) {
  console.log("No Spores found. Create one first using createSpore example.");
} else {
  // === TRANSFER THE FIRST SPORE TO SELF ===
  const { cell: sporeCell } = mySpores[0];
  // The Spore ID is stored in the type script's args
  const sporeId = sporeCell.cellOutput.type!.args;

  const receiver = await signer.getRecommendedAddress();
  const { script: to } = await ccc.Address.fromString(receiver, signer.client);

  console.log(`Transferring Spore ${sporeId} to: ${receiver}`);

  const { tx } = await ccc.spore.transferSpore({
    signer,
    id: sporeId,
    to,
  });

  await tx.completeFeeBy(signer);
  await render(tx);

  console.log("Spore transfer transaction ready!");
}
