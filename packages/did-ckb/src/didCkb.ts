import { ccc } from "@ckb-ccc/core";
import { typeIdA } from "@ckb-ccc/type-id/advanced";
import { DidCkbData, DidCkbDataLike } from "./codec";

const OPERATIONS = typeIdA.buildTypeIdOperations({
  async getScriptInfo(client: ccc.Client): Promise<ccc.ScriptInfo> {
    return client.getKnownScript(ccc.KnownScript.DidCkb);
  },
  codec: DidCkbData,
  async calculateTypeId(
    _: ccc.Client,
    tx: ccc.Transaction,
  ): Promise<ccc.HexLike> {
    return ccc
      .bytesFrom(ccc.hashTypeId(tx.inputs[0], tx.outputs.length))
      .slice(0, 20);
  },
});

/**
 * Create a DID CKB cell.
 *
 * @param props The arguments for creating the cell.
 * @param props.signer The signer to sign the transaction.
 * @param props.receiver The receiver script (optional).
 * @param props.data The output data.
 * @param props.tx The transaction skeleton (optional).
 */
export function createDidCkb(props: {
  signer: ccc.Signer;
  data: DidCkbDataLike;
  receiver?: ccc.ScriptLike | null;
  tx?: ccc.TransactionLike | null;
}): Promise<{
  tx: ccc.Transaction;
  id: ccc.Hex;
  index: number;
}> {
  return OPERATIONS.create(props);
}

/**
 * Transfer a DID CKB cell.
 *
 * @param props The arguments for transferring the cell.
 * @param props.client The client to communicate with CKB.
 * @param props.id The Type ID to transfer.
 * @param props.receiver The new receiver script.
 * @param props.tx The transaction skeleton (optional).
 * @param props.data The new output data or a transformer to update the data (optional).
 */
export async function transferDidCkb(props: {
  client: ccc.Client;
  id: ccc.HexLike;
  receiver: ccc.ScriptLike;
  tx?: ccc.TransactionLike | null;
  data?:
    | DidCkbDataLike
    | ((
        cell: ccc.Cell,
        data?: DidCkbData,
      ) => DidCkbDataLike | Promise<DidCkbDataLike>)
    | null;
}): Promise<{
  tx: ccc.Transaction;
  inIndex: number;
  outIndex: number;
}> {
  return OPERATIONS.transfer(props);
}

/**
 * Destroy a DID CKB cell.
 *
 * @param props The arguments for destroying the cell.
 * @param props.client The client to communicate with CKB.
 * @param props.id The Type ID to destroy.
 * @param props.tx The transaction skeleton (optional).
 */
export async function destroyDidCkb(props: {
  client: ccc.Client;
  id: ccc.HexLike;
  tx?: ccc.TransactionLike | null;
}): Promise<{
  tx: ccc.Transaction;
  index: number;
}> {
  return OPERATIONS.destroy(props);
}
