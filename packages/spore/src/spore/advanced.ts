import { ccc, mol } from "@ckb-ccc/core";
import { assembleTransferClusterAction } from "../advanced.js";
import { assertCluster } from "../cluster/index.js";
import { Action, SporeDataView } from "../codec/index.js";

export async function prepareCluster(
  signer: ccc.Signer,
  tx: ccc.Transaction,
  data: SporeDataView,
  clusterMode?: "lockProxy" | "clusterCell" | "skip",
  scriptInfoHash?: ccc.HexLike,
): Promise<mol.EncodableType<typeof Action> | undefined> {
  // skip if the spore is not belong to a cluster
  if (!data.clusterId || clusterMode === "skip") {
    return;
  }

  if (!clusterMode) {
    throw Error("clusterMode is undefined but the spore has a cluster");
  }

  const { cell: cluster, scriptInfo } = await assertCluster(
    signer.client,
    data.clusterId,
  );

  // If this cluster has been processed, nothing will happen to the tx
  switch (clusterMode) {
    case "lockProxy": {
      const lock = cluster.cellOutput.lock;

      // Ensure a lock-proxy input is present, add one if absent
      let lockProxyInputIndex = await tx.findInputIndexByLock(
        lock,
        signer.client,
      );
      if (lockProxyInputIndex === undefined) {
        await tx.completeInputsAddOne(
          new ccc.SignerCkbScriptReadonly(signer.client, lock),
        );
        lockProxyInputIndex = await tx.findInputIndexByLock(
          lock,
          signer.client,
        );
        if (lockProxyInputIndex === undefined) {
          throw new Error("Lock proxy input not found");
        }
      }

      // Add the output only if there's not already one with proxy lock
      if (!tx.outputs.some((output) => output.lock === lock)) {
        tx.addOutput(
          await tx.getInput(lockProxyInputIndex)!.getCell(signer.client),
        );
      }

      tx.addCellDeps({
        outPoint: cluster.outPoint,
        depType: "code",
      });
      return;
    }
    case "clusterCell": {
      if (tx.inputs.some((i) => i.previousOutput.eq(cluster.outPoint))) {
        return;
      }

      tx.addInput(cluster);
      tx.addOutput(cluster.cellOutput, cluster.outputData);
      await tx.addCellDepInfos(signer.client, scriptInfo.cellDeps);
      // note: add cluster as cellDep, which will be used in Spore contract
      tx.addCellDeps({
        outPoint: cluster.outPoint,
        depType: "code",
      });

      if (scriptInfo.cobuild) {
        return assembleTransferClusterAction(
          cluster.cellOutput,
          cluster.cellOutput,
          scriptInfoHash,
        );
      }
      return;
    }
  }
}
