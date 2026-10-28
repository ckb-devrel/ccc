import { ccc } from "@ckb-ccc/core";
import { assembleTransferClusterAction } from "../advanced.js";
import { assertCluster } from "../cluster/index.js";
import { Action, SporeDataView } from "../codec/index.js";

export async function prepareCluster(
  signer: ccc.Signer,
  tx: ccc.Transaction,
  data: SporeDataView,
  clusterMode?: "lockProxy" | "clusterCell" | "skip",
  scriptInfoHash?: ccc.HexLike,
): Promise<ccc.EncodableType<typeof Action> | undefined> {
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

      // Restore the selected owner/proxy input unless an output already
      // reproduces it. Compare lock by value (`eq`, not `===`) so a second
      // spore of the same cluster reuses that restore. Also match type and
      // data so a same-lock Spore output is not treated as the restore.
      const proxyCell = await tx
        .getInput(lockProxyInputIndex)!
        .getCell(signer.client);
      const { lock: proxyLock, type: proxyType } = proxyCell.cellOutput;
      if (
        !tx.outputs.some((output, i) => {
          const sameType = proxyType
            ? output.type?.eq(proxyType) === true
            : !output.type;
          return (
            output.lock.eq(proxyLock) &&
            sameType &&
            (tx.outputsData[i] ?? "0x") === proxyCell.outputData
          );
        })
      ) {
        tx.addOutput(proxyCell);
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
