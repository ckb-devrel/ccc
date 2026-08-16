"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { useState } from "react";
import { ModuleTextarea } from "../module-textarea";
import type { ModuleRuntimeProps } from "../modules";
import {
  reportModuleError,
  showTransaction,
  splitLines,
} from "./module-helpers";

const OutPointVec = ccc.mol.vector(ccc.OutPoint);

async function findDepGroup(client: ccc.Client, typeId: string) {
  if (ccc.bytesFrom(typeId).length !== 32) {
    throw new Error("Type ID length must be 32 bytes");
  }
  const type = await ccc.Script.fromKnownScript(
    client,
    ccc.KnownScript.TypeId,
    typeId,
  );
  const cell = await client.findSingletonCellByType(type, true);
  if (!cell) throw new Error(`Dep group ${typeId} not found`);
  return { cell, outPoints: OutPointVec.decode(cell.outputData) };
}

function parseOutPoints(value: string) {
  return splitLines(value).map((line) => {
    const separator = line.lastIndexOf(":");
    if (separator < 0) throw new Error(`Invalid outpoint: ${line}`);
    return ccc.OutPoint.from({
      txHash: line.slice(0, separator),
      index: line.slice(separator + 1),
    });
  });
}

async function saveDepGroup(
  signer: ccc.Signer,
  typeId: string,
  outPoints: ccc.OutPoint[],
) {
  if (!typeId) {
    const { script: lock } = await signer.getRecommendedAddressObj();
    const tx = ccc.Transaction.from({
      outputs: [
        {
          lock,
          type: await ccc.Script.fromKnownScript(
            signer.client,
            ccc.KnownScript.TypeId,
            "00".repeat(32),
          ),
        },
      ],
      outputsData: [OutPointVec.encode(outPoints)],
    });
    await tx.completeInputsAtLeastOne(signer);
    if (!tx.outputs[0].type) throw new Error("Type ID output disappeared");
    tx.outputs[0].type.args = ccc.hashTypeId(tx.inputs[0], 0);
    await tx.completeFeeBy(signer);
    return { tx, typeId: tx.outputs[0].type.args };
  }

  const { cell } = await findDepGroup(signer.client, typeId);
  const tx = ccc.Transaction.from({
    inputs: [cell],
    outputs: [{ ...cell.cellOutput, capacity: ccc.Zero }],
    outputsData: [OutPointVec.encode(outPoints)],
  });
  await tx.completeFeeBy(signer);
  return { tx, typeId };
}

export function DepGroupModule({
  client,
  log,
  show,
  signer,
}: ModuleRuntimeProps) {
  const [typeId, setTypeId] = useState("");
  const [outPoints, setOutPoints] = useState("");
  const [busy, setBusy] = useState(false);

  const search = async () => {
    try {
      const result = await findDepGroup(client, typeId);
      setOutPoints(
        result.outPoints
          .map(({ txHash, index }) => `${txHash}:${index}`)
          .join("\n"),
      );
      show({
        label: "DEP GROUP",
        tone: "success",
        content: (
          <strong>{`${result.outPoints.length} outpoints loaded`}</strong>
        ),
      });
      log(`${result.outPoints.length} outpoints loaded`, "success");
    } catch (cause) {
      reportModuleError(cause, show, log, "Dep group lookup failed");
    }
  };

  const save = async () => {
    if (!signer) return;
    setBusy(true);
    try {
      const result = await saveDepGroup(
        signer,
        typeId,
        parseOutPoints(outPoints),
      );
      const txHash = await signer.sendTransaction(result.tx);
      setTypeId(result.typeId);
      showTransaction(
        client,
        show,
        txHash,
        `Dep group ${typeId ? "updated" : "created"}`,
      );
      log(`Type ID ${result.typeId}; transaction sent: ${txHash}`);
      await signer.client.waitTransaction(txHash);
      showTransaction(
        client,
        show,
        txHash,
        "Dep group transaction committed",
        true,
      );
      log(`Transaction committed: ${txHash}`, "success");
    } catch (cause) {
      reportModuleError(cause, show, log, "Unable to save dep group");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="module-console">
      <div className="module-fields">
        <label className="module-field module-field-wide">
          <span>Type ID / empty to create</span>
          <input
            value={typeId}
            spellCheck={false}
            onChange={(event) => setTypeId(event.currentTarget.value)}
          />
        </label>
        <label className="module-field module-field-wide">
          <span>Outpoints / txHash:index, one per line</span>
          <ModuleTextarea
            className="module-output"
            value={outPoints}
            spellCheck={false}
            onChange={(event) => setOutPoints(event.currentTarget.value)}
          />
        </label>
      </div>
      <div className="module-actions">
        <button type="button" disabled={!typeId || busy} onClick={search}>
          Load
        </button>
        <button
          type="button"
          className="is-primary"
          disabled={!signer || busy}
          onClick={save}
        >
          {busy ? "Saving…" : typeId ? "Update dep group" : "Create dep group"}
        </button>
      </div>
    </div>
  );
}
