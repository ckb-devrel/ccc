import { ccc } from "@ckb-ccc/ccc";
import { render, signer } from "@ckb-ccc/playground";

// Import an existing did:plc into did:ckb. The on-chain contract requires a
// single PLC genesis operation in the witness plus a signature over the CKB
// transaction hash made by one of the genesis rotation keys.
const sourceDid = "did:plc:yunkr6vorfgzmvzeoofbkhq5";
const rotationKeyIndex = 0;
const rotationPrivateKey =
  "0x806d1925698097c64bc70f629e25b91b48a15eee4e492bb239402cee85356a10";

// Pull the genesis op from the public PLC directory. If you've already cached
// it locally, skip the fetch and pass the JSON object directly.
const log = await ccc.didCkb.plc.fetchPlcLog(sourceDid);
const genesisOperation = ccc.didCkb.plc.getGenesisOperation(log);

// Quick sanity check before we burn capacity: does the private key match the
// rotation slot we intend to use?
const rotationKeys = ccc.didCkb.plc.getRotationKeys(genesisOperation);
const slot = rotationKeys[rotationKeyIndex];
if (
  !ccc.didCkb.plc.verifyPrivateKeyMatch(
    rotationPrivateKey,
    slot.compressedPubkey,
    slot.curve,
  )
) {
  throw new Error(
    `Private key does not match rotation key #${rotationKeyIndex} (${slot.curve})`,
  );
}

// Build a create tx with localId stamped to sourceDid.
const { tx } = await ccc.didCkb.migrateDidCkb({
  signer,
  sourceDid,
  data: { value: { document: {} } },
});

await tx.completeInputsByCapacity(signer);
await render(tx);
await tx.completeFeeBy(signer);
await render(tx);

// Sign over the final tx hash and attach the migration witness on input 0.
const witness = ccc.didCkb.buildMigrationWitness({
  txHash: tx.hash(),
  genesisOperation,
  rotationKeyIndex,
  rotationPrivateKey,
});
tx.setWitnessArgs(0, ccc.WitnessArgs.from({ outputType: witness.toBytes() }));

const txHash = await signer.sendTransaction(tx);
console.log(`Migration tx ${txHash} sent`);
