"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { useEffect, useState } from "react";
import type { ModuleRuntimeProps } from "../modules";
import { reportModuleError, showTransaction } from "./module-helpers";

type SporeOption = { id: string; name: string };

async function transferSpore(signer: ccc.Signer, id: string, address: string) {
  const { script: to } = await ccc.Address.fromString(address, signer.client);
  const { tx } = await ccc.spore.transferSpore({ signer, id, to });
  await tx.completeFeeBy(signer);
  return tx;
}

async function meltSpore(signer: ccc.Signer, id: string) {
  const { tx } = await ccc.spore.meltSpore({ signer, id });
  await tx.completeFeeBy(signer);
  return tx;
}

export function TransferSporeModule({
  client,
  log,
  show,
  signer,
}: ModuleRuntimeProps) {
  const [address, setAddress] = useState("");
  const [spores, setSpores] = useState<SporeOption[]>([]);
  const [sporeId, setSporeId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signer) return;
    let cancelled = false;
    void (async () => {
      try {
        const list: SporeOption[] = [];
        for await (const { spore, sporeData } of ccc.spore.findSporesBySigner({
          signer,
          order: "desc",
        })) {
          const id = spore.cellOutput.type?.args;
          if (!id) continue;
          let name = `Public Spore (${id.slice(0, 10)})`;
          if (sporeData.clusterId) {
            const cluster = await ccc.spore.findCluster(
              signer.client,
              sporeData.clusterId,
            );
            if (cluster)
              name = `${cluster.clusterData.name} (${id.slice(0, 10)})`;
          }
          list.push({ id, name });
        }
        if (!cancelled) {
          setSpores(list);
          setSporeId((current) => current || list[0]?.id || "");
        }
      } catch (cause) {
        if (!cancelled)
          reportModuleError(cause, show, log, "Unable to load spores");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [log, show, signer]);

  const submit = async (mode: "melt" | "transfer") => {
    if (!signer || !sporeId) return;
    setBusy(true);
    try {
      const tx =
        mode === "transfer"
          ? await transferSpore(signer, sporeId, address)
          : await meltSpore(signer, sporeId);
      const txHash = await signer.sendTransaction(tx);
      showTransaction(client, show, txHash, `Spore ${mode} sent`);
      log(`Transaction sent: ${txHash}`);
      await signer.client.waitTransaction(txHash);
      showTransaction(client, show, txHash, `Spore ${mode} committed`, true);
      log(`Transaction committed: ${txHash}`, "success");
    } catch (cause) {
      reportModuleError(cause, show, log, `Spore ${mode} failed`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="module-console">
      <div className="module-fields">
        <label className="module-field module-field-wide">
          <span>Spore</span>
          <select
            value={sporeId}
            onChange={(event) => setSporeId(event.currentTarget.value)}
          >
            <option value="">
              {spores.length ? "Select a spore" : "No spores found"}
            </option>
            {spores.map(({ id, name }) => (
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
          disabled={busy || !sporeId}
          onClick={() => submit("melt")}
        >
          Melt
        </button>
        <button
          type="button"
          className="is-primary"
          disabled={busy || !sporeId || !address}
          onClick={() => submit("transfer")}
        >
          Transfer
        </button>
      </div>
    </div>
  );
}
