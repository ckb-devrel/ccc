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

export const VISUAL_EXAMPLE = `import { ccc } from "@ckb-ccc/ccc";
import { render } from "@ckb-ccc/playground";

// A local preview: no wallet, RPC call or broadcast.
const lock = ccc.Script.from({
  codeHash: "0x" + "00".repeat(32),
  hashType: "type",
  args: "0x" + "11".repeat(20),
});
const tx = ccc.Transaction.from({
  outputs: [
    { capacity: ccc.fixedPointFrom(100), lock },
    { capacity: ccc.fixedPointFrom(200), lock },
  ],
  outputsData: ["0x", "0x"],
});
await render(tx);
console.log("Two output cells. Inputs and fees are not complete yet.");

// You can also render your own React interface.
await render(<p>Change the capacities above, then run again.</p>);
`;

/** Update this pin together with the source-compatibility tests. No duplicated source. */
export const EXAMPLES_REVISION = "7095ccad564b94ea2e59284cb4a364aa3499252e";
export const EXAMPLES_REPOSITORY_URL = `https://github.com/ckb-devrel/ccc/tree/${EXAMPLES_REVISION}/packages/examples/src`;
export const REPOSITORY_EXAMPLES = [
  {
    file: "queryBalance.ts",
    title: "Query balances",
    description:
      "Compare signer and client balance APIs for the selected address.",
  },
  {
    file: "queryCells.ts",
    title: "Explore live cells",
    description:
      "Find owned cells and xUDT balances using lock and type scripts.",
  },
  {
    file: "queryTransactions.ts",
    title: "Read transaction history",
    description:
      "List up to ten address transactions and inspect the latest block.",
  },
].map((example) => ({
  ...example,
  sourceUrl: `https://raw.githubusercontent.com/ckb-devrel/ccc/${EXAMPLES_REVISION}/packages/examples/src/${example.file}`,
}));
