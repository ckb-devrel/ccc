// Example: Backend / Node.js CKB transfer (no playground, no UI)
// Use @ckb-ccc/shell for server-side applications, CLI tools, or automation scripts.
// This example shows the complete flow without depending on @ckb-ccc/playground.

// In a real backend app, you would use:
//   import { ccc } from "@ckb-ccc/shell";
// Here we use @ckb-ccc/ccc for playground compatibility:
import { ccc } from "@ckb-ccc/ccc";
import { client, signer as playgroundSigner } from "@ckb-ccc/playground";

// In a real backend, you'd create a signer with a private key:
//   const client = new ccc.ClientPublicTestnet();
//   const signer = new ccc.SignerCkbPrivateKey(client, process.env.CKB_PRIVATE_KEY!);
//   await signer.connect();

// For this playground demo, we use the playground signer
const signer = playgroundSigner;

// Step 1: Get the sender's address and balance
const senderAddress = await signer.getRecommendedAddress();
const balance = await signer.getBalance();
console.log(`Sender: ${senderAddress}`);
console.log(`Balance: ${ccc.fixedPointToString(balance)} CKB`);

// Step 2: Parse receiver address (sending to self for demo)
const receiverAddress = senderAddress;
const { script: receiverLock } = await ccc.Address.fromString(
  receiverAddress,
  client,
);

// Step 3: Build the transaction
const amount = ccc.fixedPointFrom(100); // 100 CKB
const tx = ccc.Transaction.from({
  outputs: [{ capacity: amount, lock: receiverLock }],
});
console.log(
  `Sending ${ccc.fixedPointToString(amount)} CKB to ${receiverAddress}`,
);

// Step 4: Auto-fill inputs and fee
await tx.completeInputsByCapacity(signer);
console.log(`Inputs: ${tx.inputs.length}, Outputs: ${tx.outputs.length}`);

await tx.completeFeeBy(signer);
console.log("Fee calculated, change output added if needed");
console.log(`Final: ${tx.inputs.length} inputs, ${tx.outputs.length} outputs`);

// Step 5: In production, you would sign and send:
//   const txHash = await signer.sendTransaction(tx);
//   console.log(`Transaction sent: ${txHash}`);
//
//   // Wait for confirmation
//   await client.waitTransaction(txHash);
//   console.log("Transaction confirmed!");

console.log("Backend transfer transaction built successfully!");
