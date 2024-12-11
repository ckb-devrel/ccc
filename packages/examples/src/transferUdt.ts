import { ccc } from "@ckb-ccc/ccc";
import { render, signer } from "@ckb-ccc/playground";

// Prepare the UDT trait
const type = await ccc.Script.fromKnownScript(
  signer.client,
  ccc.KnownScript.XUdt,
  "0xf8f94a13dfe1b87c10312fb9678ab5276eefbe1e0b2c62b4841b1f393494eff2",
);
const code = (
  await signer.client.getCellDeps(
    (await signer.client.getKnownScript(ccc.KnownScript.XUdt)).cellDeps,
  )
)[0].outPoint;

const udt = new ccc.udt.Udt(code, type);

// The receiver is the signer itself
const receiver = await signer.getRecommendedAddress();
console.log(receiver);

// Parse the receiver script from an address
const { script: lock } = await ccc.Address.fromString(receiver, signer.client);

// Describe what we want: 1UDT to receiver
let { res: tx } = await udt.transfer(signer, [
  { to: lock, amount: ccc.fixedPointFrom(1) },
]);
await render(tx);

// Complete missing parts: Fill UDT inputs
tx = await udt.completeBy(tx, signer);
await render(tx);

// Complete missing parts: Fill inputs
await tx.completeInputsByCapacity(signer);
await render(tx);

// Complete missing parts: Pay fee
await tx.completeFeeBy(signer);
await render(tx);
