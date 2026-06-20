import { ccc } from "@ckb-ccc/ccc";
import { signer } from "@ckb-ccc/playground";

// Walk the cell chain for an existing did:ckb back to its genesis. Newest
// entry is first; the last entry is CREATE (fresh mint) or MIGRATE (did:plc
// import).
const did = "did:ckb:qq2m72a2vas4e5ovcpxoedscguuu4nba";

const history = await ccc.didCkb.getDidCkbHistory({
  client: signer.client,
  id: did,
});

if (history.length === 0) {
  console.log(`No history for ${did}; DID does not exist on this network.`);
} else {
  console.log(`History of ${did}:`);
  for (const entry of history) {
    console.log(
      `  [${entry.action}] tx=${entry.txHash} out=${entry.outputIndex} block=${entry.blockNumber ?? "?"}`,
    );
    if (entry.data.value.localId) {
      console.log(`    localId: ${entry.data.value.localId}`);
    }
  }
}
