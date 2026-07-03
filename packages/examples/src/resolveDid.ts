import { ccc } from "@ckb-ccc/ccc";
import { signer } from "@ckb-ccc/playground";

// Resolve a did:ckb identifier to its live cell + decoded document.
// Replace the value below with an existing identifier on whichever network
// the signer is configured for.
const did = "did:ckb:qq2m72a2vas4e5ovcpxoedscguuu4nba";

const record = await ccc.didCkb.resolveDidCkb({
  client: signer.client,
  did,
});
if (!record) {
  console.log(`No live cell for ${did}`);
} else {
  const { document, localId } = record.data.match({
    v1: (data) => data,
  });
  console.log(`Resolved ${record.did}`);
  console.log(`  Type ID args: ${record.id}`);
  console.log(`  Document:`, document);
  if (localId) {
    console.log(`  Imported from: ${localId}`);
  }
}

// You can also enumerate every DID owned by an address.
const owner = (await signer.getRecommendedAddressObj()).script;
const owned = await ccc.didCkb.listDidCkbsByLock({
  client: signer.client,
  lock: owner,
});
console.log(`Address controls ${owned.length} DID(s):`);
for (const entry of owned) {
  console.log(`  ${entry.did}`);
}
