// Example: Query transaction history for an address

import { signer } from "@ckb-ccc/playground";

// Get the signer's lock script
const { script: lock } = await signer.getRecommendedAddressObj();
const address = await signer.getRecommendedAddress();
console.log(`Querying transactions for: ${address}`);

// Find transactions related to this address (grouped by transaction)
let txCount = 0;
for await (const txRecord of signer.client.findTransactionsByLock(
  lock,
  null,
  true, // groupByTransaction
)) {
  console.log(
    `TX #${txCount}: ${txRecord.txHash}`,
    `| Block: ${txRecord.blockNumber}`,
  );
  txCount++;
  if (txCount >= 10) break; // Limit output for demo
}
console.log(`Found ${txCount} transactions (showing max 10)`);

// Get details of a specific transaction
if (txCount > 0) {
  // Get the latest block number
  const tip = await signer.client.getTip();
  console.log(`\nCurrent tip block: ${tip}`);

  // Get the tip header
  const header = await signer.client.getTipHeader();
  console.log(`Tip hash: ${header.hash}`);
  console.log(
    `Tip epoch: ${header.epoch[0]}, ${header.epoch[1]}/${header.epoch[2]}`,
  );
}
