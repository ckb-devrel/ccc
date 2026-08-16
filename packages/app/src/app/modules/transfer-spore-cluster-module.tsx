"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { useState } from "react";
import { ModuleItemList, ModuleSelectionItem } from "../module-item-list";
import type { ModuleRuntimeProps } from "../modules";
import { usePagedModuleItems } from "../use-paged-module-items";
import { reportModuleError, showTransaction } from "./module-helpers";

type ClusterOption = { id: string; name: string };

async function* findSignerClusters(signer: ccc.Signer) {
  for await (const {
    cluster,
    clusterData,
  } of ccc.spore.findSporeClustersBySigner({ signer, order: "desc" })) {
    const id = cluster.cellOutput.type?.args;
    if (id) yield { id, name: clusterData.name };
  }
}

async function buildClusterTransfer(
  signer: ccc.Signer,
  id: string,
  address: string,
) {
  const { script: to } = await ccc.Address.fromString(address, signer.client);
  const { tx } = await ccc.spore.transferSporeCluster({ signer, id, to });
  await tx.completeFeeBy(signer);
  return tx;
}

export function TransferSporeClusterModule({
  client,
  log,
  show,
  signer,
}: ModuleRuntimeProps) {
  const [address, setAddress] = useState("");
  const [clusterId, setClusterId] = useState("");
  const [busy, setBusy] = useState(false);
  const {
    hasMore,
    items: clusters,
    loadMore,
    loading,
  } = usePagedModuleItems<ccc.Signer, ClusterOption>({
    source: signer,
    iterate: findSignerClusters,
    onError: (cause) =>
      reportModuleError(cause, show, log, "Unable to load clusters"),
  });
  const activeClusterId = clusters.some(({ id }) => id === clusterId)
    ? clusterId
    : (clusters[0]?.id ?? "");

  const transfer = async () => {
    if (!signer || !activeClusterId) return;
    setBusy(true);
    try {
      const tx = await buildClusterTransfer(signer, activeClusterId, address);
      const txHash = await signer.sendTransaction(tx);
      showTransaction(client, show, txHash, "Cluster transfer sent");
      log(`Transaction sent: ${txHash}`);
      await signer.client.waitTransaction(txHash);
      showTransaction(client, show, txHash, "Cluster transfer committed", true);
      log(`Transaction committed: ${txHash}`, "success");
    } catch (cause) {
      reportModuleError(cause, show, log, "Cluster transfer failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="module-console">
      <div className="module-fields">
        <ModuleItemList
          label="Spore clusters"
          count={clusters.length}
          emptyText="No clusters found"
          hasMore={hasMore}
          loadingMore={loading}
          onLoadMore={loadMore}
          selection
        >
          {clusters.map(({ id, name }) => (
            <ModuleSelectionItem
              selected={id === activeClusterId}
              title={id}
              key={id}
              onClick={() => setClusterId(id)}
              label={name}
              description={`${id.slice(0, 10)}…${id.slice(-8)}`}
            />
          ))}
        </ModuleItemList>
        <label className="module-field module-field-wide">
          <span>Receiver address</span>
          <input
            value={address}
            onChange={(event) => setAddress(event.currentTarget.value)}
          />
        </label>
      </div>
      <div className="module-actions">
        <button
          type="button"
          className="is-primary"
          disabled={busy || !activeClusterId || !address}
          onClick={transfer}
        >
          {busy ? "Transmitting…" : "Transfer cluster"}
        </button>
      </div>
    </div>
  );
}
