"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { createTypeId, transferTypeId } from "@ckb-ccc/type-id";
import { useState } from "react";
import type { ModuleRuntimeProps } from "../modules";
import { reportModuleError, showTransaction } from "./module-helpers";

function immutableLock() {
  return ccc.Script.from({
    codeHash: `0x${"00".repeat(32)}`,
    hashType: "data",
    args: "0x",
  });
}

async function findTypeIdCell(client: ccc.Client, args: string) {
  if (!args) return undefined;
  const type = await ccc.Script.fromKnownScript(
    client,
    ccc.KnownScript.TypeId,
    args,
  );
  const cell = await client.findSingletonCellByType(type, true);
  if (!cell) throw new Error(`Type ID cell ${args} not found`);
  return cell;
}

async function deployScript(
  signer: ccc.Signer,
  file: File,
  typeIdArgs: string,
  immutable: boolean,
) {
  const data = ccc.hexFrom(new Uint8Array(await file.arrayBuffer()));
  const existing = await findTypeIdCell(signer.client, typeIdArgs);
  let tx: ccc.Transaction;
  let id: string;
  if (existing) {
    if (!existing.cellOutput.type?.args)
      throw new Error("Selected cell has no Type ID");
    ({ tx } = await transferTypeId({
      client: signer.client,
      id: existing.cellOutput.type.args,
      receiver: immutable ? immutableLock() : existing.cellOutput.lock,
      data,
    }));
    id = existing.cellOutput.type.args;
  } else {
    const created = await createTypeId({
      signer,
      data,
      receiver: immutable ? immutableLock() : undefined,
    });
    tx = created.tx;
    id = created.id;
  }
  await tx.completeFeeBy(signer);
  return { dataHash: ccc.hashCkb(data), id, tx };
}

async function burnTypeId(signer: ccc.Signer, typeIdArgs: string) {
  const cell = await findTypeIdCell(signer.client, typeIdArgs);
  if (!cell) throw new Error("Select a Type ID cell to burn");
  const tx = ccc.Transaction.from({
    inputs: [{ previousOutput: cell.outPoint }],
    outputs: [{ lock: cell.cellOutput.lock, capacity: ccc.Zero }],
    outputsData: ["0x"],
  });
  await tx.addCellDepsOfKnownScripts(signer.client, ccc.KnownScript.TypeId);
  await tx.completeFeeChangeToOutput(signer, 0);
  return tx;
}

export function DeployScriptModule({
  client,
  log,
  show,
  signer,
}: ModuleRuntimeProps) {
  const [file, setFile] = useState<File>();
  const [typeId, setTypeId] = useState("");
  const [immutable, setImmutable] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (mode: "burn" | "deploy") => {
    if (!signer) return;
    setBusy(true);
    try {
      let tx: ccc.Transaction;
      let detail = "";
      if (mode === "burn") {
        tx = await burnTypeId(signer, typeId);
      } else {
        if (!file) throw new Error("Select a file to deploy");
        const result = await deployScript(signer, file, typeId, immutable);
        tx = result.tx;
        detail = `; Type ID: ${result.id}; Data hash: ${result.dataHash}`;
        setTypeId(result.id);
      }
      const txHash = await signer.sendTransaction(tx);
      showTransaction(client, show, txHash, `Script ${mode} sent`);
      log(`Transaction sent: ${txHash}${detail}`);
      await signer.client.waitTransaction(txHash);
      showTransaction(client, show, txHash, `Script ${mode} committed`, true);
      log(`Transaction committed: ${txHash}`, "success");
    } catch (cause) {
      reportModuleError(cause, show, log, `Script ${mode} failed`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="module-console">
      <div className="module-fields">
        <label className="module-field module-field-wide">
          <span>Script file</span>
          <input
            type="file"
            onChange={(event) => setFile(event.currentTarget.files?.[0])}
          />
        </label>
        <label className="module-field module-field-wide">
          <span>Type ID args / empty to deploy new</span>
          <input
            value={typeId}
            spellCheck={false}
            onChange={(event) => setTypeId(event.currentTarget.value)}
          />
        </label>
        <label className="module-check">
          <input
            type="checkbox"
            checked={immutable}
            onChange={(event) => setImmutable(event.currentTarget.checked)}
          />
          <span>Deploy with immutable lock</span>
        </label>
      </div>
      <div className="module-actions">
        <button
          type="button"
          disabled={!signer || busy || !typeId}
          onClick={() => submit("burn")}
        >
          Burn
        </button>
        <button
          type="button"
          className="is-primary"
          disabled={!signer || busy || !file}
          onClick={() => submit("deploy")}
        >
          {busy ? "Deploying…" : typeId ? "Update script" : "Deploy script"}
        </button>
      </div>
    </div>
  );
}
