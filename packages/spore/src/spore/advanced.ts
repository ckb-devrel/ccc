import { ccc } from "@ckb-ccc/core";
import { assembleTransferClusterAction } from "../advanced.js";
import { assertCluster } from "../cluster/index.js";
import { Action, SporeDataView } from "../codec/index.js";

function isLockProxyRestored(
  tx: ccc.Transaction,
  outPoint: ccc.OutPoint,
): boolean {
  return tx.outputs.some(
    (output) => output.lockProxyRestoredFrom?.eq(outPoint) === true,
  );
}

function addLockProxyRestore(
  tx: ccc.Transaction,
  proxyInput: ccc.CellInput,
  proxyCell: ccc.Cell,
): void {
  const restore = proxyCell.cellOutput.clone();
  restore.lockProxyRestoredFrom = proxyInput.previousOutput.clone();
  tx.addOutput(restore, proxyCell.outputData);
}

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

      // Restore this selected proxy input, not an arbitrary owner-locked
      // output. Tag the restore output with the input outPoint so the mark
      // lives on the transaction (survives clone/JSON, stays tx-local, and
      // clears if that output is removed).
      const proxyInput = tx.getInput(lockProxyInputIndex)!;
      const proxyCell = await proxyInput.getCell(signer.client);
      if (!isLockProxyRestored(tx, proxyInput.previousOutput)) {
        addLockProxyRestore(tx, proxyInput, proxyCell);
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
