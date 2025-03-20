import { ccc } from "@ckb-ccc/core";
import {
  assembleCreateClusterAction,
  assembleTransferClusterAction,
  prepareSporeTransaction,
} from "../advanced.js";
import {
  ClusterDataView,
  packRawClusterData,
  unpackToRawClusterData,
} from "../codec/index.js";
import { findSingletonCellByArgs } from "../helper/index.js";
import {
  SporeScriptInfo,
  SporeScriptInfoLike,
  getClusterScriptInfo,
  getClusterScriptInfos,
} from "../predefined/index.js";

export async function findCluster(
  client: ccc.Client,
  id: ccc.HexLike,
  scripts?: SporeScriptInfoLike[],
): Promise<
  | {
      cell: ccc.Cell;
      cluster: ccc.Cell;
      clusterData: ClusterDataView;
      scriptInfo: SporeScriptInfo;
    }
  | undefined
> {
  const found = await findSingletonCellByArgs(
    client,
    id,
    scripts ?? Object.values(getClusterScriptInfos(client)),
  );
  if (!found) {
    return;
  }

  return {
    cell: found.cell,
    cluster: found.cell,
    clusterData: unpackToRawClusterData(found.cell.outputData),
    scriptInfo: found.scriptInfo,
  };
}

export async function assertCluster(
  client: ccc.Client,
  args: ccc.HexLike,
  scripts?: SporeScriptInfoLike[],
): Promise<{
  cell: ccc.Cell;
  scriptInfo: SporeScriptInfo;
}> {
  const res = await findCluster(client, args, scripts);

  if (!res) {
    throw new Error(`Cluster ${ccc.hexFrom(args)} not found`);
  }

  return res;
}

/**
 * Create a new Cluster cell
 *
 * @param params.signer who takes the responsibility to balance and sign the transaction
 * @param params.data specific format of data required by Cluster protocol
 * @param params.to the owner of the Cluster cell, which will be replaced with signer if not provided
 * @param params.tx the transaction skeleton, if not provided, a new one will be created
 * @param params.scriptInfo the script info of new cluster, default spore version if undefined
 * @param params.scriptInfoHash the script info hash used in cobuild
 * @returns
 *  - **tx**: a new transaction that contains created Cluster cell
 *  - **id**: the id of the created Cluster cell
 */
export async function createSporeCluster(params: {
  signer: ccc.Signer;
  data: ClusterDataView;
  to?: ccc.ScriptLike;
  tx?: ccc.TransactionLike;
  scriptInfo?: SporeScriptInfoLike;
  scriptInfoHash?: ccc.HexLike;
}): Promise<{
  tx: ccc.Transaction;
  id: ccc.Hex;
}> {
  const { signer, data, to, scriptInfoHash } = params;
  const scriptInfo = params.scriptInfo ?? getClusterScriptInfo(signer.client);

  // prepare transaction
  const tx = ccc.Transaction.from(params.tx ?? {});
  await tx.completeInputsAtLeastOne(signer);

  // build cluster cell
  const id = ccc.hashTypeId(tx.inputs[0], tx.outputs.length);
  const packedClusterData = packRawClusterData(data);
  tx.addOutput(
    {
      lock: to ?? (await signer.getRecommendedAddressObj()).script,
      type: {
        ...scriptInfo,
        args: id,
      },
    },
    packedClusterData,
  );

  // complete cellDeps
  await tx.addCellDepInfos(signer.client, scriptInfo.cellDeps);

  // generate cobuild action
  const actions = scriptInfo.cobuild
    ? [
        assembleCreateClusterAction(
          tx.outputs[tx.outputs.length - 1],
          packedClusterData,
          scriptInfoHash,
        ),
      ]
    : [];

  return {
    tx: await prepareSporeTransaction(signer, tx, actions),
    id,
  };
}

/**
 * Transfer a Cluster cell
 *
 * @param params.signer who takes the responsibility to balance and sign the transaction
 * @param params.id the id of the Cluster cell to be transferred
 * @param params.to the new owner of the Cluster cell
 * @param params.tx the transaction skeleton, if not provided, a new one will be created
 * @param params.scriptInfoHash the script info hash used in cobuild
 * @returns
 *  - **tx**: a new transaction that contains transferred Cluster cell
 */
export async function transferSporeCluster(params: {
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

  // build cluster cell
  const { cell: cluster, scriptInfo } = await assertCluster(signer.client, id);

  tx.addInput(cluster);
  tx.addOutput(
    {
      lock: to,
      type: cluster.cellOutput.type,
    },
    cluster.outputData,
  );

  // complete cellDeps
  await tx.addCellDepInfos(signer.client, scriptInfo.cellDeps);

  // generate cobuild action
  const actions = scriptInfo.cobuild
    ? [
        assembleTransferClusterAction(
          cluster.cellOutput,
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
 * Search on-chain clusters under the signer's control
 *
 * @param params.signer the owner of clusters
 * @param params.order the order in creation time of clusters
 * @param params.scriptInfos the deployed script infos of clusters
 */
export async function* findSporeClustersBySigner(params: {
  signer: ccc.Signer;
  order?: "asc" | "desc";
  limit?: number;
  scriptInfos?: SporeScriptInfoLike[];
}): AsyncGenerator<{
  cell: ccc.Cell;
  cluster: ccc.Cell;
  clusterData: ClusterDataView;
  scriptInfo: SporeScriptInfo;
}> {
  const { signer, order, limit, scriptInfos } = params;
  for (const scriptInfo of scriptInfos ??
    Object.values(getClusterScriptInfos(signer.client))) {
    if (!scriptInfo) {
      continue;
    }

    for await (const cluster of signer.findCells(
      {
        script: {
          ...scriptInfo,
          args: "",
        },
      },
      true,
      order,
      limit,
    )) {
      yield {
        cell: cluster,
        cluster,
        clusterData: unpackToRawClusterData(cluster.outputData),
        scriptInfo: SporeScriptInfo.from(scriptInfo),
      };
    }
  }
}

/**
 * Search on-chain clusters under the specified lock or not
 *
 * @param params.client the client to search clusters
 * @param params.lock the lock of clusters
 */
export async function* findSporeClusters(params: {
  client: ccc.Client;
  lock?: ccc.ScriptLike;
  order?: "asc" | "desc";
  limit?: number;
  scriptInfos?: SporeScriptInfoLike[];
}): AsyncGenerator<{
  cell: ccc.Cell;
  cluster: ccc.Cell;
  clusterData: ClusterDataView;
  scriptInfo: SporeScriptInfo;
}> {
  const { client, lock, order, limit, scriptInfos } = params;
  for (const scriptInfo of scriptInfos ??
    Object.values(getClusterScriptInfos(client))) {
    if (!scriptInfo) {
      continue;
    }

    for await (const cluster of client.findCells(
      {
        script: {
          ...scriptInfo,
          args: "",
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
      yield {
        cell: cluster,
        cluster,
        clusterData: unpackToRawClusterData(cluster.outputData),
        scriptInfo: SporeScriptInfo.from(scriptInfo),
      };
    }
  }
}
