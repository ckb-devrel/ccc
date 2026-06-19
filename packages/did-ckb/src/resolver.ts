import { ccc } from "@ckb-ccc/core";
import { DidCkbData } from "./codec";
import { argsToDid, didToArgs, isDidCkb } from "./identifier";

export type DidCkbRecord = {
  /** The `did:ckb:` string identifying this cell. */
  did: string;
  /** 20-byte Type ID args (same value `createDidCkb` returned as `id`). */
  id: ccc.Hex;
  /** Decoded DidCkbData; `.value.document` is the CBOR-decoded document. */
  data: DidCkbData;
  /** The live DID Metadata Cell itself. */
  cell: ccc.Cell;
};

async function didCkbTypeScript(
  client: ccc.Client,
  id: ccc.HexLike,
): Promise<ccc.Script> {
  const scriptInfo = await client.getKnownScript(ccc.KnownScript.DidCkb);
  return ccc.Script.from({
    codeHash: scriptInfo.codeHash,
    hashType: scriptInfo.hashType,
    args: id,
  });
}

function decodeRecord(cell: ccc.Cell, id: ccc.Hex): DidCkbRecord {
  return {
    did: argsToDid(id),
    id,
    data: DidCkbData.decode(cell.outputData),
    cell,
  };
}

/**
 * Find the live DID Metadata Cell for a given Type ID and decode its data.
 *
 * Returns `undefined` when no live cell exists (the DID was never created or
 * has been destroyed).
 */
export async function findDidCkbCell(props: {
  client: ccc.Client;
  id: ccc.HexLike;
}): Promise<DidCkbRecord | undefined> {
  const id = ccc.hexFrom(props.id);
  const type = await didCkbTypeScript(props.client, id);
  const cell = await props.client.findSingletonCellByType(type, true);
  if (!cell) {
    return undefined;
  }
  return decodeRecord(cell, id);
}

/**
 * Resolve a `did:ckb:` string to its live cell + decoded document.
 *
 * Throws if `did` is not a syntactically valid did:ckb identifier. Returns
 * `undefined` if the DID was created and then destroyed, or never existed.
 */
export async function resolveDidCkb(props: {
  client: ccc.Client;
  did: string;
}): Promise<DidCkbRecord | undefined> {
  if (!isDidCkb(props.did)) {
    throw new Error(`Not a did:ckb identifier: ${props.did}`);
  }
  return findDidCkbCell({ client: props.client, id: didToArgs(props.did) });
}

/**
 * List every live DID Metadata Cell owned by the given lock. Useful for
 * dashboards that want to enumerate the DIDs an address controls.
 *
 * Cells whose data fails to decode (e.g. a future on-chain schema version) are
 * skipped, not thrown, so a single bad cell can't break the whole listing.
 */
export async function listDidCkbsByLock(props: {
  client: ccc.Client;
  lock: ccc.ScriptLike;
  limit?: number;
  order?: "asc" | "desc";
}): Promise<DidCkbRecord[]> {
  const scriptInfo = await props.client.getKnownScript(ccc.KnownScript.DidCkb);
  const records: DidCkbRecord[] = [];

  // Filter by type.codeHash + hashType (args is prefix-matched against "0x",
  // which matches any args). This is the standard indexer pattern for
  // "any cell of this type, regardless of identifier".
  for await (const cell of props.client.findCells(
    {
      script: ccc.Script.from(props.lock),
      scriptType: "lock",
      scriptSearchMode: "exact",
      filter: {
        script: ccc.Script.from({
          codeHash: scriptInfo.codeHash,
          hashType: scriptInfo.hashType,
          args: "0x",
        }),
      },
      withData: true,
    },
    props.order,
    props.limit,
  )) {
    const type = cell.cellOutput.type;
    if (!type) {
      continue;
    }
    const argsBytes = ccc.bytesFrom(type.args);
    if (argsBytes.length !== 20) {
      continue;
    }
    try {
      records.push(decodeRecord(cell, ccc.hexFrom(type.args)));
    } catch {
      // Skip unparseable cells rather than fail the whole listing.
    }
  }
  return records;
}
