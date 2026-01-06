import { ccc } from "@ckb-ccc/core";

/**
 * Build Type ID operations.
 *
 * @param props The properties to build the operations.
 * @param props.getScriptInfo Function to get the script info.
 * @param props.calculateTypeId Function to calculate the Type ID.
 * @param props.addCellDeps Function to add cell dependencies.
 */

export function buildTypeIdOperations<
  Encodable = ccc.BytesLike,
  Decoded = ccc.Bytes,
>(props: {
  getScriptInfo: (client: ccc.Client) => Promise<ccc.ScriptInfoLike>;
  codec?: ccc.CodecLike<Encodable, Decoded> | null;
  calculateTypeId?:
    | ((client: ccc.Client, tx: ccc.Transaction) => Promise<ccc.HexLike>)
    | null;
  addCellDeps?:
    | ((
        client: ccc.Client,
        tx: ccc.Transaction,
        scriptInfo: ccc.ScriptInfo,
      ) => Promise<ccc.TransactionLike>)
    | null;
}) {
  async function getScriptInfo(client: ccc.Client): Promise<ccc.ScriptInfo> {
    return ccc.ScriptInfo.from(await props.getScriptInfo(client));
  }

  const codec = (
    props.codec ? ccc.Codec.from(props.codec) : ccc.CodecRaw
  ) as ccc.Codec<Encodable, Decoded>;

  function getTypeScript(scriptInfo: ccc.ScriptInfo, args: ccc.HexLike) {
    return ccc.Script.from({
      ...scriptInfo,
      args,
    });
  }

  async function addCellDeps(
    client: ccc.Client,
    tx: ccc.Transaction,
    scriptInfo: ccc.ScriptInfo,
  ): Promise<ccc.Transaction> {
    if (props.addCellDeps) {
      return ccc.Transaction.from(
        await props.addCellDeps(client, tx, scriptInfo),
      );
    }

    tx.addCellDeps(...(await client.getCellDeps(scriptInfo.cellDeps)));
    return tx;
  }

  async function calculateTypeId(
    client: ccc.Client,
    tx: ccc.Transaction,
  ): Promise<ccc.Hex> {
    if (props.calculateTypeId) {
      return ccc.hexFrom(await props.calculateTypeId(client, tx));
    }

    return ccc.hashTypeId(tx.inputs[0], tx.outputs.length);
  }

  return {
    /**
     * Create a Type ID cell.
     *
     * @param props The arguments for creating the cell.
     * @param props.signer The signer to sign the transaction.
     * @param props.receiver The receiver script (optional).
     * @param props.data The output data.
     * @param props.tx The transaction skeleton (optional).
     */
    async create(
      this: void,
      props: {
        signer: ccc.Signer;
        data: Encodable;
        receiver?: ccc.ScriptLike | null;
        tx?: ccc.TransactionLike | null;
      },
    ): Promise<{
      tx: ccc.Transaction;
      id: ccc.Hex;
      index: number;
    }> {
      const { signer, receiver, data, tx: txLike } = props;
      const tx = ccc.Transaction.from(txLike ?? {});

      await tx.completeInputsAtLeastOne(signer);
      const id = await calculateTypeId(signer.client, tx);

      const scriptInfo = await getScriptInfo(signer.client);
      const len = tx.addOutput({
        cellOutput: {
          type: getTypeScript(scriptInfo, id),
          lock: receiver
            ? ccc.Script.from(receiver)
            : (await signer.getRecommendedAddressObj()).script,
        },
        outputData: codec.encode(data),
      });

      return {
        tx: await addCellDeps(signer.client, tx, scriptInfo),
        id,
        index: len - 1,
      };
    },

    /**
     * Transfer a Type ID cell.
     *
     * @param props The arguments for transferring the cell.
     * @param props.client The client to communicate with CKB.
     * @param props.id The Type ID to transfer.
     * @param props.receiver The new receiver script.
     * @param props.tx The transaction skeleton (optional).
     * @param props.data The new output data or a transformer to update the data (optional).
     */
    async transfer(
      this: void,
      props: {
        client: ccc.Client;
        id: ccc.HexLike;
        receiver: ccc.ScriptLike;
        tx?: ccc.TransactionLike | null;
        data?:
          | Encodable
          | ((cell: ccc.Cell, data?: Decoded) => Encodable | Promise<Encodable>)
          | null;
      },
    ): Promise<{
      tx: ccc.Transaction;
      inIndex: number;
      outIndex: number;
    }> {
      const { client, id, receiver, tx: txLike, data } = props;
      const tx = ccc.Transaction.from(txLike ?? {});

      const scriptInfo = await getScriptInfo(client);
      const type = getTypeScript(scriptInfo, id);
      const inCell = await client.findSingletonCellByType(type);
      if (!inCell) {
        throw new Error(`Type ID ${ccc.stringify(type)} not found`);
      }

      const outputData = await (async () => {
        if (!data) {
          return inCell.outputData;
        }

        if (typeof data === "function") {
          return codec.encode(
            await (
              data as (
                cell: ccc.Cell,
                data?: Decoded,
              ) => Encodable | Promise<Encodable>
            )(inCell, codec.decodeOr(inCell.outputData, undefined)),
          );
        }

        return codec.encode(data);
      })();

      const outCell = ccc.CellAny.from({
        ...inCell,
        cellOutput: {
          ...inCell.cellOutput,
          lock: ccc.Script.from(receiver),
        },
        outputData,
      });

      const inLen = tx.addInput(inCell);
      const outLen = tx.addOutput(outCell);

      return {
        tx: await addCellDeps(client, tx, scriptInfo),
        inIndex: inLen - 1,
        outIndex: outLen - 1,
      };
    },

    /**
     * Destroy a Type ID cell.
     *
     * @param props The arguments for destroying the cell.
     * @param props.client The client to communicate with CKB.
     * @param props.id The Type ID to destroy.
     * @param props.tx The transaction skeleton (optional).
     */
    async destroy(
      this: void,
      props: {
        client: ccc.Client;
        id: ccc.HexLike;
        tx?: ccc.TransactionLike | null;
      },
    ): Promise<{
      tx: ccc.Transaction;
      index: number;
    }> {
      const { client, id, tx: txLike } = props;
      const tx = ccc.Transaction.from(txLike ?? {});

      const scriptInfo = await getScriptInfo(client);
      const type = getTypeScript(scriptInfo, id);
      const cell = await client.findSingletonCellByType(type);
      if (!cell) {
        throw new Error(`Type ID ${ccc.stringify(type)} not found`);
      }

      const len = tx.addInput(cell);

      return {
        tx: await addCellDeps(client, tx, scriptInfo),
        index: len - 1,
      };
    },
  };
}
