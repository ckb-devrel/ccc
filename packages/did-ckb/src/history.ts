import { ccc } from "@ckb-ccc/core";
import { DidCkbData } from "./codec";
import { findDidCkbCell } from "./resolver";

export type HistoryAction = "CREATE" | "UPDATE" | "MIGRATE";

export type HistoryEntry = {
  /**
   * `CREATE` for a fresh mint, `MIGRATE` for a did:plc import (genesis cell
   * with a `localId` set), `UPDATE` for every subsequent transfer.
   */
  action: HistoryAction;
  txHash: ccc.Hex;
  outputIndex: ccc.Num;
  blockNumber?: ccc.Num;
  capacity: ccc.Num;
  data: DidCkbData;
};

const DEFAULT_MAX_STEPS = 50;

/**
 * Walk the DID cell chain backwards to produce the ordered list of operations
 * applied to a DID.
 *
 * Each `transferDidCkb` consumes the previous DID cell as an input and creates
 * a new one with the same Type ID args; the genesis (`createDidCkb` /
 * `createDidCkb` with localId) has no DID input. We start from the live cell,
 * read its tx, look for the prior DID cell among the inputs, and repeat. The
 * first entry returned is the newest (most recent transfer); the last is the
 * genesis.
 *
 * Cost: roughly one `getTransaction` call per step plus one `input.getCell`
 * lookup per non-DID input on each step. `input.getCell` goes through the
 * client's cell cache, so repeated walks over the same chain are cheap.
 */
export async function getDidCkbHistory(props: {
  client: ccc.Client;
  id: ccc.HexLike;
  /** Pre-resolved live cell; if omitted, we fetch it. */
  liveCell?: ccc.Cell;
  /** Safety bound to prevent runaway walks. Default 50. */
  maxSteps?: number;
}): Promise<HistoryEntry[]> {
  const id = ccc.hexFrom(props.id);
  const scriptInfo = await props.client.getKnownScript(ccc.KnownScript.DidCkb);
  const codeHash = scriptInfo.codeHash.toLowerCase();
  const normalizedId = id.toLowerCase();

  let cell: ccc.Cell | undefined =
    props.liveCell ??
    (await findDidCkbCell({ client: props.client, id }))?.cell;
  if (!cell) {
    return [];
  }

  const history: HistoryEntry[] = [];
  const maxSteps = props.maxSteps ?? DEFAULT_MAX_STEPS;
  let steps = 0;

  while (cell && steps < maxSteps) {
    steps++;
    const tx = await props.client.getTransaction(cell.outPoint.txHash);
    if (!tx) {
      break;
    }

    const entry = decodeEntry(cell, tx.blockNumber);
    if (!entry) {
      break;
    }

    const prior = await findPriorDidCell(
      props.client,
      tx.transaction,
      codeHash,
      normalizedId,
    );

    if (!prior) {
      // No DID input means this tx is the genesis. If the genesis carries a
      // `localId` it's a did:plc migration; otherwise a plain CREATE.
      entry.action = entry.data.value.localId ? "MIGRATE" : "CREATE";
      history.push(entry);
      break;
    }

    entry.action = "UPDATE";
    history.push(entry);
    cell = prior;
  }

  return history;
}

async function findPriorDidCell(
  client: ccc.Client,
  tx: ccc.TransactionLike,
  codeHash: string,
  id: string,
): Promise<ccc.Cell | undefined> {
  const { inputs } = ccc.Transaction.from(tx);
  for (const input of inputs) {
    let cell: ccc.Cell;
    try {
      cell = await input.getCell(client);
    } catch {
      // Skip inputs whose previous output we can't fetch; they can't be the
      // prior DID cell anyway, so the walk should keep looking at siblings.
      continue;
    }
    const type = cell.cellOutput.type;
    if (!type) {
      continue;
    }
    if (type.codeHash.toLowerCase() !== codeHash) {
      continue;
    }
    if (ccc.hexFrom(type.args).toLowerCase() !== id) {
      continue;
    }
    return cell;
  }
  return undefined;
}

function decodeEntry(
  cell: ccc.Cell,
  blockNumber?: ccc.Num,
): HistoryEntry | undefined {
  try {
    const data = DidCkbData.decode(cell.outputData);
    return {
      action: "UPDATE",
      txHash: cell.outPoint.txHash,
      outputIndex: cell.outPoint.index,
      blockNumber,
      capacity: cell.cellOutput.capacity,
      data,
    };
  } catch {
    return undefined;
  }
}
