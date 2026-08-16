"use client";

import { ccc, spore } from "@ckb-ccc/connector-react";
import { useEffect, useState } from "react";
import { ModuleTextarea } from "../module-textarea";
import type { ModuleRuntimeProps } from "../modules";
import { reportModuleError, showTransaction } from "./module-helpers";

type ClusterOption = { id: string; name: string };

async function buildSpore(
  signer: ccc.Signer,
  contentType: string,
  content: string,
  clusterId: string,
) {
  const trimmed = content.trim();
  const normalized =
    trimmed.startsWith("{") && trimmed.endsWith("}")
      ? JSON.stringify(JSON.parse(content))
      : content;
  const { tx, id } = await spore.createSpore({
    signer,
    data: {
      contentType,
      content: ccc.bytesFrom(normalized, "utf8"),
      clusterId: clusterId || undefined,
    },
    clusterMode: clusterId ? "clusterCell" : "skip",
  });
  await tx.completeFeeBy(signer);
  return { id, tx };
}

export function MintSporeModule({
  client,
  log,
  show,
  signer,
}: ModuleRuntimeProps) {
  const [contentType, setContentType] = useState("dob/1");
  const [content, setContent] = useState('{ "dna": "0123456789abcdef" }');
  const [clusterId, setClusterId] = useState("");
  const [clusters, setClusters] = useState<ClusterOption[]>([]);
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
        } of spore.findSporeClustersBySigner({ signer, order: "desc" })) {
          const id = cluster.cellOutput.type?.args;
          if (id)
            list.push({ id, name: `${clusterData.name} (${id.slice(0, 10)})` });
        }
        if (!cancelled) setClusters(list);
      } catch (cause) {
        if (!cancelled)
          reportModuleError(cause, show, log, "Unable to load clusters");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [log, show, signer]);

  const mint = async () => {
    if (!signer) return;
    setBusy(true);
    try {
      const { id, tx } = await buildSpore(
        signer,
        contentType,
        content,
        clusterId,
      );
      const txHash = await signer.sendTransaction(tx);
      showTransaction(client, show, txHash, `Spore ${id.slice(0, 10)} minted`);
      log(`Transaction sent: ${txHash}; Spore ID: ${id}`);
      await signer.client.waitTransaction(txHash);
      showTransaction(client, show, txHash, "Spore mint committed", true);
      log(`Transaction committed: ${txHash}`, "success");
    } catch (cause) {
      reportModuleError(cause, show, log, "Spore mint failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="module-console">
      <div className="module-fields">
        <label className="module-field">
          <span>Content type</span>
          <input
            value={contentType}
            onChange={(event) => setContentType(event.currentTarget.value)}
          />
        </label>
        <label className="module-field">
          <span>Cluster / optional</span>
          <select
            value={clusterId}
            onChange={(event) => setClusterId(event.currentTarget.value)}
          >
            <option value="">Without cluster</option>
            {clusters.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="module-field module-field-wide">
          <span>Content</span>
          <ModuleTextarea
            value={content}
            onChange={(event) => setContent(event.currentTarget.value)}
          />
        </label>
      </div>
      <div className="module-actions">
        <button
          type="button"
          className="is-primary"
          disabled={!signer || busy || !contentType}
          onClick={mint}
        >
          {busy ? "Minting…" : "Mint spore"}
        </button>
      </div>
    </div>
  );
}
