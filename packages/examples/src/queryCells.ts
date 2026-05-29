// Example: Query on-chain cells by lock script or type script

import { ccc } from "@ckb-ccc/ccc";
import { signer } from "@ckb-ccc/playground";

// Get the signer's lock script
const { script: lock } = await signer.getRecommendedAddressObj();
console.log("Querying cells for:", await signer.getRecommendedAddress());

// Find all cells owned by the signer (via lock script)
let count = 0;
for await (const cell of signer.client.findCellsByLock(lock)) {
  console.log(
    `Cell #${count}: ${cell.outPoint.txHash}:${cell.outPoint.index}`,
    `| Capacity: ${ccc.fixedPointToString(cell.cellOutput.capacity)} CKB`,
    `| Has type script: ${cell.cellOutput.type ? "yes" : "no"}`,
    `| Data length: ${(cell.outputData.length - 2) / 2} bytes`,
  );
  count++;
  if (count >= 10) break; // Limit output for demo
}
console.log(`Found ${count} cells (showing max 10)`);

// Find cells with a specific type script (e.g., xUDT tokens)
const xudtType = await ccc.Script.fromKnownScript(
  signer.client,
  ccc.KnownScript.XUdt,
  "0x8a23cbbc4f2f7970b01a64a400ed15d095398c49996d27b8cd3485d1d7fafaa5",
);

let udtCount = 0;
for await (const cell of signer.client.findCellsByLock(lock, xudtType)) {
  const balance = ccc.udtBalanceFrom(cell.outputData);
  console.log(
    `UDT Cell: ${cell.outPoint.txHash}:${cell.outPoint.index}`,
    `| UDT Balance: ${balance}`,
  );
  udtCount++;
}
console.log(`Found ${udtCount} UDT cells`);

// Use signer.findCells() — convenient shorthand that searches by the signer's locks
let signerCellCount = 0;
for await (const _cell of signer.findCells({})) {
  signerCellCount++;
  if (signerCellCount >= 20) break;
}
console.log(`Signer owns at least ${signerCellCount} cells`);
