"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { useState } from "react";
import { ModuleItemList, ModuleSelectionItem } from "../module-item-list";
import type { ModuleRuntimeProps } from "../modules";
import { usePagedModuleItems } from "../use-paged-module-items";
import { reportModuleError } from "./module-helpers";

async function* findSignerSpores(signer: ccc.Signer) {
  for await (const { spore, sporeData } of ccc.spore.findSporesBySigner({
    signer,
    order: "desc",
  })) {
    const id = spore.cellOutput.type?.args;
    if (!id) continue;
    yield {
      id,
      clusterId: sporeData.clusterId
        ? ccc.hexFrom(sporeData.clusterId)
        : undefined,
    };
  }
}

async function transferSpore(
  signer: ccc.Signer,
  tx: ccc.Transaction,
  id: string,
  address: string,
) {
  const { script: to } = await ccc.Address.fromString(address, signer.client);
  return (await ccc.spore.transferSpore({ signer, tx, id, to })).tx;
}

async function meltSpore(signer: ccc.Signer, tx: ccc.Transaction, id: string) {
  return (await ccc.spore.meltSpore({ signer, tx, id })).tx;
}

// -----------------------------------------------------------------------------

type SporeOption = {
  clusterId?: string;
  clusterName: string;
  id: string;
};

type RawSporeOption = Omit<SporeOption, "clusterName">;

async function prepareSpores(items: RawSporeOption[], signer: ccc.Signer) {
  return Promise.all(
    items.map(async ({ clusterId, id }): Promise<SporeOption> => {
      if (!clusterId) return { clusterId, clusterName: "Public Spore", id };
      const cluster = await ccc.spore.findCluster(signer.client, clusterId);
      return {
        clusterId,
        clusterName: cluster?.clusterData.name ?? "Unknown cluster",
        id,
      };
    }),
  );
}

export function TransferSporeModule({
  log,
  show,
  signer,
  submitTransaction,
}: ModuleRuntimeProps) {
  const [address, setAddress] = useState("");
  const [sporeId, setSporeId] = useState("");
  const [busy, setBusy] = useState(false);
  const {
    hasMore,
    items: spores,
    loadMore,
    loading,
  } = usePagedModuleItems({
    source: signer,
    iterate: findSignerSpores,
    preparePage: prepareSpores,
    onError: (cause) =>
      reportModuleError(cause, show, log, "Unable to load spores"),
  });
  const activeSporeId = spores.some(({ id }) => id === sporeId)
    ? sporeId
    : (spores[0]?.id ?? "");

  const submit = async (mode: "melt" | "transfer") => {
    if (!signer || !activeSporeId) return;
    setBusy(true);
    try {
      await submitTransaction(
        mode === "transfer" ? "Transfer Spore" : "Melt Spore",
        (tx) =>
          mode === "transfer"
            ? transferSpore(signer, tx, activeSporeId, address)
            : meltSpore(signer, tx, activeSporeId),
      );
    } catch (cause) {
      reportModuleError(cause, show, log, `Spore ${mode} failed`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="module-console">
      <div className="module-fields">
        <ModuleItemList
          label="Spores"
          count={spores.length}
          emptyText="No spores found"
          hasMore={hasMore}
          loadingMore={loading}
          onLoadMore={loadMore}
          selection
        >
          {spores.map(({ clusterId, clusterName, id }) => {
            const selected = id === activeSporeId;
            return (
              <ModuleSelectionItem
                selected={selected}
                title={
                  clusterId
                    ? `Spore: ${id}\nCluster: ${clusterId}`
                    : `Spore: ${id}\nNo cluster`
                }
                key={id}
                onClick={() => setSporeId(id)}
                label={shortId(id)}
                description={
                  clusterId
                    ? `${shortId(clusterId)} · ${clusterName}`
                    : "No cluster · Public Spore"
                }
              />
            );
          })}
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
          disabled={busy || !activeSporeId}
          onClick={() => submit("melt")}
        >
          Melt
        </button>
        <button
          type="button"
          className="is-primary"
          disabled={busy || !activeSporeId || !address}
          onClick={() => submit("transfer")}
        >
          Transfer
        </button>
      </div>
    </div>
  );
}

function shortId(id: string) {
  return `${id.slice(0, 10)}…${id.slice(-8)}`;
}
