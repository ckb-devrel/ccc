"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { useEffect, useState } from "react";
import type { ModuleRuntimeProps } from "../modules";
import { reportModuleError, showTransaction } from "./module-helpers";

type ClusterOption = { id: string; name: string };

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
  const [clusters, setClusters] = useState<ClusterOption[]>([]);
  const [clusterId, setClusterId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signer) return;
    let cancelled = false;
    void (async () => {
      try {
        const list: ClusterOption[] = [];
        for await (const {
          cluster,
          clusterData,
        } of ccc.spore.findSporeClustersBySigner({ signer, order: "desc" })) {
          const id = cluster.cellOutput.type?.args;
          if (id)
            list.push({ id, name: `${clusterData.name} (${id.slice(0, 10)})` });
        }
        if (!cancelled) {
          setClusters(list);
          setClusterId((current) => current || list[0]?.id || "");
        }
      } catch (cause) {
        if (!cancelled)
          reportModuleError(cause, show, log, "Unable to load clusters");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [log, show, signer]);

  const transfer = async () => {
    if (!signer || !clusterId) return;
    setBusy(true);
    try {
      const tx = await buildClusterTransfer(signer, clusterId, address);
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
        <label className="module-field module-field-wide">
          <span>Spore cluster</span>
          <select
            value={clusterId}
            onChange={(event) => setClusterId(event.currentTarget.value)}
          >
            <option value="">
              {clusters.length ? "Select a cluster" : "No clusters found"}
            </option>
            {clusters.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
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
          disabled={busy || !clusterId || !address}
          onClick={transfer}
        >
          {busy ? "Transmitting…" : "Transfer cluster"}
        </button>
      </div>
    </div>
  );
}
