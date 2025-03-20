import { ccc } from "@ckb-ccc/core";
import {
  assembleCreateSporeAction,
  assembleMeltSporeAction,
  assembleTransferSporeAction,
  prepareSporeTransaction,
} from "../advanced.js";
import {
  SporeDataView,
  packRawSporeData,
  unpackToRawSporeData,
} from "../codec/index.js";
import { findSingletonCellByArgs } from "../helper/index.js";
import {
  SporeScriptInfo,
  SporeScriptInfoLike,
  getSporeScriptInfo,
  getSporeScriptInfos,
} from "../predefined/index.js";
import { prepareCluster } from "./advanced.js";

export async function findSpore(
  client: ccc.Client,
  id: ccc.HexLike,
  scripts?: SporeScriptInfoLike[],
): Promise<
  | {
      cell: ccc.Cell;
      spore: ccc.Cell;
      sporeData: SporeDataView;
      scriptInfo: SporeScriptInfo;
    }
  | undefined
> {
  const found = await findSingletonCellByArgs(
    client,
    id,
    scripts ?? Object.values(getSporeScriptInfos(client)),
  );
  if (!found) {
    return undefined;
  }

  return {
    cell: found.cell,
    spore: found.cell,
    sporeData: unpackToRawSporeData(found.cell.outputData),
    scriptInfo: found.scriptInfo,
  };
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
 * @param params.signer who takes the responsibility to balance and sign the transaction
 * @param params.data specific format of data required by Spore protocol
 * @param params.to owner of new spore cell, signer if no provided
 * @param params.clusterMode how to process cluster cell **(if clusterId is not provided in SporeData, this parameter will be ignored)**
 *   - undefined: error if the spore has a cluster but the clusterMode is not set
 *   - lockProxy: put a cell that uses the same lock from Cluster cell in both Inputs and Outputs
 *   - clusterCell: directly put Cluster cell in Inputs and Outputs
 *   - skip: don't handle the cluster logic
 * @param params.tx the transaction skeleton, if not provided, a new one will be created
 * @param params.scriptInfo the script info of Spore cell, if not provided, the default script info will be used
 * @param params.scriptInfoHash the script info hash used in cobuild
 * @returns
 *  - **tx**: a new transaction that contains created Spore cells
 *  - **id**: the sporeId of created Spore cell
 */
export async function createSpore(params: {
  signer: ccc.Signer;
  data: SporeDataView;
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
  await tx.completeInputsAtLeastOne(signer);

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
 * @param params.signer who takes the responsibility to balance and sign the transaction
 * @param params.id sporeId
 * @param params.to Spore's new owner
 * @param params.tx the transaction skeleton, if not provided, a new one will be created
 * @param params.scriptInfoHash the script info hash used in cobuild
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
  tx.addInput(sporeCell);
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
 * @param params.signer who takes the responsibility to balance and sign the transaction
 * @param params.id sporeId to be melted
 * @param params.tx the transaction skeleton, if not provided, a new one will be created
 * @param params.scriptInfoHash the script info hash used in cobuild
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
  tx.addInput(sporeCell);

  const actions = scriptInfo.cobuild
    ? [assembleMeltSporeAction(sporeCell.cellOutput, scriptInfoHash)]
    : [];

  return {
    tx: await prepareSporeTransaction(signer, tx, actions),
  };
}

/**
 * Search on-chain spores under the signer's control, if cluster provided, filter spores belonging to this cluster
 *
 * @param params.signer the owner of spores
 * @param params.order the order in creation time of spores
 * @param params.clusterId the cluster that spores belong to. "" to find public spores
 * @param params.scriptInfos the deployed script infos of spores
 * @returns specified spore cells
 */
export async function* findSporesBySigner(params: {
  signer: ccc.Signer;
  order?: "asc" | "desc";
  limit?: number;
  clusterId?: ccc.HexLike;
  scriptInfos?: SporeScriptInfoLike[];
}): AsyncGenerator<{
  cell: ccc.Cell;
  spore: ccc.Cell;
  sporeData: SporeDataView;
  scriptInfo: SporeScriptInfo;
}> {
  const { signer, clusterId, scriptInfos, limit, order } = params;
  for (const scriptInfo of scriptInfos ??
    Object.values(getSporeScriptInfos(signer.client))) {
    if (!scriptInfo) {
      continue;
    }
    for await (const spore of signer.findCells(
      {
        script: {
          ...scriptInfo,
          args: [],
        },
      },
      true,
      order,
      limit,
    )) {
      const sporeData = unpackToRawSporeData(spore.outputData);
      if (
        !clusterId ||
        (clusterId === "" && !sporeData.clusterId) ||
        sporeData.clusterId === ccc.hexFrom(clusterId)
      ) {
        yield {
          cell: spore,
          spore,
          sporeData,
          scriptInfo: SporeScriptInfo.from(scriptInfo),
        };
      }
    }
  }
}

/**
 * Search on-chain spores under the specified lock or not, if cluster provided, filter spores belonging to this cluster
 *
 * @param params.client the client to search spores
 * @param params.lock the lock of spores
 * @param params.clusterId the cluster that spores belong to. "" to find public spores
 * @param params.scriptInfos the deployed script infos of spores
 * @param params.limit the limit of spores to search
 * @param params.order the order in creation time of spores
 * @returns specified spore cells
 */
export async function* findSpores(params: {
  client: ccc.Client;
  lock?: ccc.ScriptLike;
  clusterId?: ccc.HexLike;
  scriptInfos?: SporeScriptInfoLike[];
  limit?: number;
  order?: "asc" | "desc";
}): AsyncGenerator<{
  cell: ccc.Cell;
  spore: ccc.Cell;
  sporeData: SporeDataView;
  scriptInfo: SporeScriptInfo;
}> {
  const { client, lock, clusterId, scriptInfos, limit, order } = params;
  for (const scriptInfo of scriptInfos ??
    Object.values(getSporeScriptInfos(client))) {
    if (!scriptInfo) {
      continue;
    }
    for await (const spore of client.findCells(
      {
        script: {
          ...scriptInfo,
          args: [],
        },
        scriptType: "type",
        scriptSearchMode: "prefix",
        withData: true,
        filter: lock
          ? {
              script: lock,
            }
          : undefined,
      },
      order,
      limit,
    )) {
      const sporeData = unpackToRawSporeData(spore.outputData);
      if (
        !clusterId ||
        (clusterId === "" && !sporeData.clusterId) ||
        sporeData.clusterId === ccc.hexFrom(clusterId)
      ) {
        yield {
          cell: spore,
          spore,
          sporeData,
          scriptInfo: SporeScriptInfo.from(scriptInfo),
        };
      }
    }
  }
}
