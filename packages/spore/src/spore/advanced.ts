import { ccc } from "@ckb-ccc/core";
import { assembleTransferClusterAction } from "../advanced.js";
import { assertCluster } from "../cluster/index.js";
import { Action, SporeDataView } from "../codec/index.js";

const restoredLockProxyInputs = new WeakMap<ccc.CellInput, true>();
const restoredLockProxyOutPoints = new WeakMap<ccc.Transaction, Set<string>>();

function lockProxyOutPointKey(outPoint: ccc.OutPoint): string {
  return `${outPoint.txHash}:${outPoint.index.toString()}`;
}

function hasRestoredLockProxy(
  tx: ccc.Transaction,
  input: ccc.CellInput,
): boolean {
  if (restoredLockProxyInputs.has(input)) {
    return true;
  }
  return (
    restoredLockProxyOutPoints
      .get(tx)
      ?.has(lockProxyOutPointKey(input.previousOutput)) === true
  );
}

function markRestoredLockProxy(
  tx: ccc.Transaction,
  input: ccc.CellInput,
): void {
  restoredLockProxyInputs.set(input, true);
  const restored = restoredLockProxyOutPoints.get(tx) ?? new Set<string>();
  restored.add(lockProxyOutPointKey(input.previousOutput));
  restoredLockProxyOutPoints.set(tx, restored);
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
      // output. A same-lock payment or Spore (even with the same type, data,
      // and capacity) is independent and must not skip the restore. Track the
      // input/outPoint so a second spore of this cluster reuses that restore.
      const proxyInput = tx.getInput(lockProxyInputIndex)!;
      if (!hasRestoredLockProxy(tx, proxyInput)) {
        tx.addOutput(await proxyInput.getCell(signer.client));
        markRestoredLockProxy(tx, proxyInput);
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
