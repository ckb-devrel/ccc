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
