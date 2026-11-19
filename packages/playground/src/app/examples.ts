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

const EXAMPLES_PATH = "ckb-devrel/ccc";
const EXAMPLES_DIRECTORY = "packages/examples/src";
export const EXAMPLES_REPOSITORY_URL = `https://github.com/${EXAMPLES_PATH}/tree/master/${EXAMPLES_DIRECTORY}`;
const RAW_EXAMPLES_URL = `https://raw.githubusercontent.com/${EXAMPLES_PATH}/master/${EXAMPLES_DIRECTORY}`;
export const REPOSITORY_EXAMPLES = [
  {
    file: "transfer.ts",
    title: "Build a CKB transfer",
    description:
      "Build and preview a transfer to your own address. Requires a funded connected or example wallet on the selected network; never signs or broadcasts.",
  },
  {
    file: "transferUdt.ts",
    title: "Build an xUDT transfer",
    description:
      "Preview sending one unit of the sample xUDT to yourself. Requires that token and enough CKB for capacity and fees.",
  },
  {
    file: "transferSpore.ts",
    title: "Query and transfer a Spore",
    description:
      "List owned Spores and preview sending the first one to yourself. With no owned Spores, the script just reports an empty result.",
  },
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
  {
    file: "resolveDid.ts",
    title: "Resolve a CKB DID",
    description:
      "Resolve a DID document and list DIDs owned by the selected address. Edit the sample identifier for your network.",
  },
  {
    file: "didHistory.ts",
    title: "Trace DID history",
    description:
      "Follow a live DID back through updates to its creation (up to 50 steps). An absent DID returns an empty history.",
  },
].map((example) => ({
  ...example,
  sourceUrl: `${RAW_EXAMPLES_URL}/${example.file}`,
}));
