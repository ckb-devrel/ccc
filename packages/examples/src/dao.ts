// Example: Nervos DAO deposit and withdrawal
// Nervos DAO is a smart contract that allows CKB holders to earn interest on their deposits.
// The deposit/withdraw cycle has 3 phases:
//   1. Deposit: Lock CKB into the DAO
//   2. Withdraw (Phase 1): Mark the deposit for withdrawal
//   3. Claim (Phase 2): After ~30 days (180 epochs), claim CKB + interest

import { ccc } from "@ckb-ccc/ccc";
import { render, signer } from "@ckb-ccc/playground";

const { script: lock } = await signer.getRecommendedAddressObj();

// === DEPOSIT ===
// Create a DAO deposit transaction
const depositTx = ccc.Transaction.from({
  outputs: [
    {
      lock,
      type: await ccc.Script.fromKnownScript(
        signer.client,
        ccc.KnownScript.NervosDao,
        "0x",
      ),
    },
  ],
  // DAO deposit data is 8 bytes of zeros
  outputsData: ["0x0000000000000000"],
});

// Add DAO cell deps
await depositTx.addCellDepsOfKnownScripts(
  signer.client,
  ccc.KnownScript.NervosDao,
);

// Set deposit amount (must cover cell's occupied capacity, minimum ~82 CKB)
depositTx.outputs[0].capacity = ccc.fixedPointFrom(200);

// Complete inputs and fee
await depositTx.completeInputsByCapacity(signer);
await depositTx.completeFeeBy(signer);
await render(depositTx);

console.log("Deposit transaction ready. Outputs:", depositTx.outputs.length);

// === FIND EXISTING DAO DEPOSITS ===
// Find all Nervos DAO cells owned by the signer
const daoType = await ccc.Script.fromKnownScript(
  signer.client,
  ccc.KnownScript.NervosDao,
  "0x",
);

for await (const cell of signer.findCells({
  script: daoType,
  scriptLenRange: [33, 34],
  outputDataLenRange: [8, 9],
})) {
  const isDeposited = await cell.isNervosDao(signer.client, "deposited");
  const isWithdrew = await cell.isNervosDao(signer.client, "withdrew");

  console.log(
    `DAO Cell: ${cell.outPoint.txHash}:${cell.outPoint.index}`,
    `| ${ccc.fixedPointToString(cell.cellOutput.capacity)} CKB`,
    `| Phase: ${isDeposited ? "Deposited" : isWithdrew ? "Withdrew" : "Unknown"}`,
  );

  // If withdrew, calculate profit
  if (isWithdrew) {
    const profit = await cell.getDaoProfit(signer.client);
    console.log(`  Profit: ${ccc.fixedPointToString(profit)} CKB`);
  }
}
