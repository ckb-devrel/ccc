import { ccc } from "@ckb-ccc/ccc";
import { render, signer } from "@ckb-ccc/playground";

// Prepare the UDT trait
const type = ccc.Script.from({
  codeHash:
    "0x8b887e59f396f99302996ee8911b31f73fb2e2be4d9cade3104f017a871b8ed3",
  hashType: "type",
  // Equal to the TypeId args of metadata cell, UDT would use it to search metadata cell
  // for extracting the metadata. It can be empty if no metadata cell deployed on the chain.
  args: "0x1e370b8965e12faf572a0f7ca7bf585027404ee23c32a82ef049965d5ebb8ff6",
});

const code = ccc.OutPoint.from({
  // SSRI-UDT script deployment tx hash on Testnet
  txHash: "0x1fecfac56696b38d76304f9e2dc1db39406679f3a6e517d5ed16bddbd8fdd7ab",
  index: 0,
});

const executor = new ccc.ssri.ExecutorJsonRpc("http://localhost:9090"); // Linking to your native SSRI-Server
const udt = new ccc.udt.UdtRegister(code, type, {
  executor,
});

// Register the UDT with metadata
const { tx: registerTx, tokenHash: metadataTypeIdArgs } = await udt.register(
  signer,
  {
    name: "SSRI UDT",
    symbol: "WSS",
    decimals: 8,
    icon: "",
  },
);

// Get the metadata TypeId args, then you can use it to mint UDT tokens
console.log("metadataTypeIdArgs =", metadataTypeIdArgs);

const tx = registerTx.res;
await render(tx);

// Complete missing parts: Pay fee
await tx.completeFeeBy(signer);
await render(tx);

const txHash = await signer.sendTransaction(tx);
console.log("tx hash =", txHash);
