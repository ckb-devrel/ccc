"use client";

import { ccc, spore } from "@ckb-ccc/connector-react";
import { useState } from "react";
import { ModuleItemList, ModuleSelectionItem } from "../module-item-list";
import { ModuleTextarea } from "../module-textarea";
import type { ModuleRuntimeProps } from "../modules";
import { usePagedModuleItems } from "../use-paged-module-items";
import { reportModuleError } from "./module-helpers";

type ClusterOption = { id: string; name: string };

async function* findSignerClusters(signer: ccc.Signer) {
  for await (const { cluster, clusterData } of spore.findSporeClustersBySigner({
    signer,
    order: "desc",
  })) {
    const id = cluster.cellOutput.type?.args;
    if (id) yield { id, name: clusterData.name };
  }
}

function normalizeSporeContent(content: string) {
  const trimmed = content.trim();
  return trimmed.startsWith("{") && trimmed.endsWith("}")
    ? JSON.stringify(JSON.parse(content))
    : content;
}

async function buildSpore(
  signer: ccc.Signer,
  tx: ccc.Transaction,
  contentType: string,
  content: string,
  clusterId: string,
) {
  return spore.createSpore({
    signer,
    tx,
    data: {
      contentType,
      content: ccc.bytesFrom(normalizeSporeContent(content), "utf8"),
      clusterId: clusterId || undefined,
    },
    clusterMode: clusterId ? "clusterCell" : "skip",
  });
}

// -----------------------------------------------------------------------------

export function MintSporeModule({
  log,
  show,
  signer,
  submitTransaction,
}: ModuleRuntimeProps) {
  const [contentType, setContentType] = useState("dob/1");
  const [content, setContent] = useState('{ "dna": "0123456789abcdef" }');
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
  const activeClusterId =
    clusterId === "" || clusters.some(({ id }) => id === clusterId)
      ? clusterId
      : "";

  const mint = async () => {
    if (!signer) return;
    setBusy(true);
    try {
      let sporeId = "";
      await submitTransaction("Mint Spore", async (tx) => {
        const { id, tx: next } = await buildSpore(
          signer,
          tx,
          contentType,
          content,
          activeClusterId,
        );
        sporeId = id;
        return next;
      });
      log(`Spore ID: ${sporeId}`, "success");
    } catch (cause) {
      reportModuleError(cause, show, log, "Spore mint failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="module-console">
      <div className="module-fields">
        <label className="module-field module-field-wide">
          <span>Content type</span>
          <input
            value={contentType}
            onChange={(event) => setContentType(event.currentTarget.value)}
          />
        </label>
        <ModuleItemList
          label="Cluster / optional"
          count={clusters.length}
          emptyText="No clusters found"
          hasMore={hasMore}
          loadingMore={loading}
          onLoadMore={loadMore}
          selection
        >
          {[{ id: "", name: "Without cluster" }, ...clusters].map(
            ({ id, name }) => {
              const selected = id === activeClusterId;
              return (
                <ModuleSelectionItem
                  selected={selected}
                  title={id || "Mint without a cluster"}
                  key={id || "without-cluster"}
                  onClick={() => setClusterId(id)}
                  label={clusterName(name, id)}
                  description={
                    id
                      ? `${id.slice(0, 10)}…${id.slice(-8)}`
                      : "Public / unclustered"
                  }
                />
              );
            },
          )}
        </ModuleItemList>
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

function clusterName(name: string, id: string) {
  const legacyIdSuffix = ` (${id.slice(0, 10)})`;
  return id && name.endsWith(legacyIdSuffix)
    ? name.slice(0, -legacyIdSuffix.length)
    : name;
}
