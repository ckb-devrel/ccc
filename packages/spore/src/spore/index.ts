import { ccc } from "@ckb-ccc/core";
import {
  assembleCreateSporeAction,
  assembleMeltSporeAction,
  assembleTransferSporeAction,
  prepareSporeTransaction,
} from "../advanced.js";
import { SporeData, packRawSporeData } from "../codec/index.js";
import {
  findSingletonCellByArgs,
  injectOneCapacityCell,
} from "../helper/index.js";
import {
  SporeScriptInfo,
  SporeScriptInfoLike,
  getSporeScriptInfo,
  getSporeScriptInfos,
} from "../predefined/index.js";
import { prepareCluster } from "./advanced.js";

export async function findSpore(
  client: ccc.Client,
  args: ccc.HexLike,
  scripts?: SporeScriptInfoLike[],
): Promise<
  | {
      cell: ccc.Cell;
      scriptInfo: SporeScriptInfo;
    }
  | undefined
> {
  return findSingletonCellByArgs(
    client,
    args,
    scripts ?? Object.values(getSporeScriptInfos(client)),
  );
}

export async function assertSpore(
  client: ccc.Client,
  args: ccc.HexLike,
  scripts?: SporeScriptInfoLike[],
): Promise<{
  cell: ccc.Cell;
  scriptInfo: SporeScriptInfo;
}> {
  const res = await findSpore(client, args, scripts);

  if (!res) {
    throw new Error(`Spore ${ccc.hexFrom(args)} not found`);
  }

  return res;
}

/**
 * Create one Spore cell with the specified Spore data.
 *
 * @param signer who takes the responsibility to balance and sign the transaction
 * @param data specific format of data required by Spore protocol
 * @param to owner of new spore cell, signer if no provided
 * @param clusterMode how to process cluster cell **(if clusterId is not provided in SporeData, this parameter will be ignored)**
 *   - undefined: error if the spore has a cluster but the clusterMode is not set
 *   - lockProxy: put a cell that uses the same lock from Cluster cell in both Inputs and Outputs
 *   - clusterCell: directly put Cluster cell in Inputs and Outputs
 *   - skip: don't handle the cluster logic
 * @param tx the transaction skeleton, if not provided, a new one will be created
 * @param scriptInfo the script info of Spore cell, if not provided, the default script info will be used
 * @param scriptInfoHash the script info hash used in cobuild
 * @returns
 *  - **tx**: a new transaction that contains created Spore cells
 *  - **id**: the sporeId of created Spore cell
 */
export async function createSpore(params: {
  signer: ccc.Signer;
  data: SporeData;
  to?: ccc.ScriptLike;
  clusterMode?: "lockProxy" | "clusterCell" | "skip";
  tx?: ccc.TransactionLike;
  scriptInfo?: SporeScriptInfoLike;
  scriptInfoHash?: ccc.HexLike;
}): Promise<{
  tx: ccc.Transaction;
  id: ccc.Hex;
}> {
  const { signer, data, to, clusterMode, scriptInfoHash } = params;
  const scriptInfo = params.scriptInfo ?? getSporeScriptInfo(signer.client);

  // prepare transaction
  const actions = [];
  const ids: ccc.Hex[] = [];
  const tx = ccc.Transaction.from(params.tx ?? {});
  if (tx.inputs.length === 0) {
    await injectOneCapacityCell(signer, tx);
  }

  const { script: lock } = await signer.getRecommendedAddressObj();

  // build spore cell
  const id = ccc.hashTypeId(tx.inputs[0], tx.outputs.length);
  ids.push(id);

  const packedData = packRawSporeData(data);
  tx.addOutput(
    {
      lock: to ?? lock,
      type: {
        ...scriptInfo,
        args: id,
      },
    },
    packedData,
  );

  // create spore action
  if (scriptInfo.cobuild) {
    const output = tx.outputs[tx.outputs.length - 1];
    const createAction = assembleCreateSporeAction(
      output,
      packedData,
      scriptInfoHash,
    );
    actions.push(createAction);
  }

  // complete cellDeps
  await tx.addCellDepInfos(signer.client, scriptInfo.cellDeps);

  const action = await prepareCluster(signer, tx, data, clusterMode);
  if (action) {
    actions.push(action);
  }

  return {
    tx: await prepareSporeTransaction(signer, tx, actions),
    id,
  };
}

/**
 * Transfer one Spore cell
 *
 * @param signer who takes the responsibility to balance and sign the transaction
 * @param id sporeId
 * @param to Spore's new owner
 * @param tx the transaction skeleton, if not provided, a new one will be created
 * @param scriptInfoHash the script info hash used in cobuild
 * @returns
 *  - **tx**: a new transaction that contains transferred Spore cells
 */
export async function transferSpore(params: {
  signer: ccc.Signer;
  id: ccc.HexLike;
  to: ccc.ScriptLike;
  tx?: ccc.TransactionLike;
  scriptInfoHash?: ccc.HexLike;
}): Promise<{
  tx: ccc.Transaction;
}> {
  const { signer, id, to, scriptInfoHash } = params;

  // prepare transaction
  const tx = ccc.Transaction.from(params.tx ?? {});

  const { cell: sporeCell, scriptInfo } = await assertSpore(signer.client, id);
  await tx.addCellDepInfos(signer.client, scriptInfo.cellDeps);
  tx.inputs.push(
    ccc.CellInput.from({
      previousOutput: sporeCell.outPoint,
      ...sporeCell,
    }),
  );
  tx.addOutput(
    {
      lock: to,
      type: sporeCell.cellOutput.type,
    },
    sporeCell.outputData,
  );

  const actions = scriptInfo.cobuild
    ? [
        assembleTransferSporeAction(
          sporeCell.cellOutput,
          tx.outputs[tx.outputs.length - 1],
          scriptInfoHash,
        ),
      ]
    : [];

  return {
    tx: await prepareSporeTransaction(signer, tx, actions),
  };
}

/**
 * Melt one Spore cell
 *
 * @param signer who takes the responsibility to balance and sign the transaction
 * @param id sporeId to be melted
 * @param tx the transaction skeleton, if not provided, a new one will be created
 * @param scriptInfoHash the script info hash used in cobuild
 * @returns
 *  - **tx**: a new transaction that contains melted Spore cell
 */
export async function meltSpore(params: {
  signer: ccc.Signer;
  id: ccc.HexLike;
  tx?: ccc.TransactionLike;
  scriptInfoHash?: ccc.HexLike;
}): Promise<{
  tx: ccc.Transaction;
}> {
  const { signer, id, scriptInfoHash } = params;

  // prepare transaction
  const tx = ccc.Transaction.from(params.tx ?? {});

  // build spore cell
  const { cell: sporeCell, scriptInfo } = await assertSpore(signer.client, id);
  await tx.addCellDepInfos(signer.client, scriptInfo.cellDeps);
  tx.inputs.push(
    ccc.CellInput.from({
      previousOutput: sporeCell.outPoint,
      ...sporeCell,
    }),
  );

  const actions = scriptInfo.cobuild
    ? [assembleMeltSporeAction(sporeCell.cellOutput, scriptInfoHash)]
    : [];

  return {
    tx: await prepareSporeTransaction(signer, tx, actions),
  };
}
