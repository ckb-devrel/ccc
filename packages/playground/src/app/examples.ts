export const DEFAULT_UDT_TRANSFER = `import { ccc } from "@ckb-ccc/ccc";
import { render, signer } from "@ckb-ccc/playground";

console.log("Welcome to CCC Playground!");

// Prepare the UDT type script
const type = await ccc.Script.fromKnownScript(
  signer.client,
  ccc.KnownScript.XUdt,
  "0xf8f94a13dfe1b87c10312fb9678ab5276eefbe1e0b2c62b4841b1f393494eff2",
);

// The receiver is the signer itself on mainnet
const receiver = signer.client.addressPrefix === "ckb" ?
  await signer.getRecommendedAddress() :
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqflz4emgssc6nqj4yv3nfv2sca7g9dzhscgmg28x";
console.log(receiver);

// The sender script for change
const { script: change } = await signer.getRecommendedAddressObj();
// Parse the receiver script from an address
const { script: lock } = await ccc.Address.fromString(
  receiver,
  signer.client,
);

// Describe what we want
const tx = ccc.Transaction.from({
  outputs: [
    { capacity: ccc.fixedPointFrom(242), lock, type },
  ],
  outputsData: [ccc.numLeToBytes(ccc.fixedPointFrom(1), 16)],
});
// Add cell deps for the xUDT script
await tx.addCellDepsOfKnownScripts(
  signer.client,
  ccc.KnownScript.XUdt,
);
await render(tx);

// Complete missing parts: Fill UDT inputs
await tx.completeInputsByUdt(signer, type);
await render(tx);

// Calculate excess UDT in inputs
const balanceDiff =
  (await tx.getInputsUdtBalance(signer.client, type)) -
  tx.getOutputsUdtBalance(type);
console.log(balanceDiff);
if (balanceDiff > ccc.Zero) {
  // Add UDT change
  tx.addOutput(
    {
      lock: change,
      type,
    },
    ccc.numLeToBytes(balanceDiff, 16),
  );
}
await render(tx);

// Complete missing parts: Fill inputs
await tx.completeInputsByCapacity(signer);
await render(tx);

// Complete missing parts: Pay fee
await tx.completeFeeBy(signer, 1000);
await render(tx);
`;

export const DEFAULT_TRANSFER = `import { ccc } from "@ckb-ccc/ccc";
import { render, signer } from "@ckb-ccc/playground";

console.log("Welcome to CCC Playground!");

// The receiver is the signer itself on mainnet
const receiver = signer.client.addressPrefix === "ckb" ?
  await signer.getRecommendedAddress() :
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqflz4emgssc6nqj4yv3nfv2sca7g9dzhscgmg28x";
console.log(receiver);

// Parse the receiver script from an address
const { script: lock } = await ccc.Address.fromString(
  receiver,
  signer.client,
);

// Describe what we want
const tx = ccc.Transaction.from({
  outputs: [
    { capacity: ccc.fixedPointFrom(100), lock },
  ],
});
await render(tx);

// Complete missing parts: Fill inputs
await tx.completeInputsByCapacity(signer);
await render(tx);

// Complete missing parts: Pay fee
await tx.completeFeeBy(signer, 1000);
await render(tx);
`;
