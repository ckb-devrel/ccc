"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { ssri } from "@ckb-ccc/ssri";
import { useState } from "react";
import { CopyableReadoutValue } from "../copyable-readout-value";
import { ModuleTextarea } from "../module-textarea";
import type { ModuleRuntimeProps } from "../modules";
import { reportModuleError } from "./module-helpers";

async function findContract(client: ccc.Client, typeIdArgs: string) {
  const type = await ccc.Script.fromKnownScript(
    client,
    ccc.KnownScript.TypeId,
    typeIdArgs,
  );
  const cell = await client.findSingletonCellByType(type);
  if (!cell) throw new Error("SSRI contract cell not found");
  return cell.outPoint;
}

async function callSsri(
  client: ccc.Client,
  executorUrl: string,
  outPointText: string,
  method: string,
  argsText: string,
) {
  const separator = outPointText.lastIndexOf(":");
  if (separator < 0) throw new Error("OutPoint must use txHash:index format");
  const outPoint = ccc.OutPoint.from({
    txHash: outPointText.slice(0, separator),
    index: outPointText.slice(separator + 1),
  });
  const scriptCell = await client.getCell(outPoint);
  if (!scriptCell) throw new Error("SSRI contract cell not found");
  const rawArgs = argsText.trim() ? JSON.parse(argsText) : [];
  if (!Array.isArray(rawArgs))
    throw new Error("Arguments must be a JSON array");
  const args = rawArgs.map((value) => ccc.hexFrom(value));
  const executor = new ssri.ExecutorJsonRpc(executorUrl);
  const contract = new ssri.Trait(scriptCell.outPoint, executor);
  return contract.assertExecutor().runScript(contract.code, method, args);
}

export function SsriModule({ client, log, show }: ModuleRuntimeProps) {
  const [executor, setExecutor] = useState("http://localhost:9090");
  const [typeId, setTypeId] = useState(
    "0x8fd55df879dc6176c95f3c420631f990ada2d4ece978c9512c39616dead2ed56",
  );
  const [outPoint, setOutPoint] = useState("");
  const [method, setMethod] = useState("SSRI.version");
  const [args, setArgs] = useState("[]");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  const search = async () => {
    try {
      const found = await findContract(client, typeId);
      const value = `${found.txHash}:${found.index}`;
      setOutPoint(value);
      show({
        label: "CONTRACT",
        tone: "success",
        content: (
          <CopyableReadoutValue
            value={value}
            onError={(cause) =>
              reportModuleError(cause, show, log, "Unable to copy contract")
            }
          />
        ),
      });
      log(`Contract found: ${value}`, "success");
    } catch (cause) {
      reportModuleError(cause, show, log, "SSRI contract lookup failed");
    }
  };

  const execute = async () => {
    setBusy(true);
    show({
      label: "SSRI",
      tone: "pending",
      content: <strong>{`Calling ${method}…`}</strong>,
    });
    try {
      const response = await callSsri(client, executor, outPoint, method, args);
      const text = stringify(response);
      setResult(text);
      show({
        label: "RESULT",
        tone: "success",
        content: (
          <CopyableReadoutValue
            value={text}
            onError={(cause) =>
              reportModuleError(cause, show, log, "Unable to copy result")
            }
          />
        ),
      });
      log(`${method}: ${text}`, "success");
    } catch (cause) {
      reportModuleError(cause, show, log, "SSRI call failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="module-console">
      <div className="module-fields">
        <label className="module-field">
          <span>Executor URL</span>
          <input
            value={executor}
            onChange={(event) => setExecutor(event.currentTarget.value)}
          />
        </label>
        <label className="module-field">
          <span>Method path</span>
          <input
            value={method}
            onChange={(event) => setMethod(event.currentTarget.value)}
          />
        </label>
        <label className="module-field module-field-wide">
          <span>Contract Type ID args</span>
          <input
            value={typeId}
            spellCheck={false}
            onChange={(event) => setTypeId(event.currentTarget.value)}
          />
        </label>
        <label className="module-field module-field-wide">
          <span>Contract outpoint / txHash:index</span>
          <input
            value={outPoint}
            spellCheck={false}
            onChange={(event) => setOutPoint(event.currentTarget.value)}
          />
        </label>
        <label className="module-field module-field-wide">
          <span>Molecule-encoded hex arguments / JSON array</span>
          <ModuleTextarea
            value={args}
            spellCheck={false}
            onChange={(event) => setArgs(event.currentTarget.value)}
          />
        </label>
        {result ? (
          <label className="module-field module-field-wide">
            <span>Raw result</span>
            <ModuleTextarea className="module-output" readOnly value={result} />
          </label>
        ) : null}
      </div>
      <div className="module-actions">
        <button type="button" disabled={!typeId || busy} onClick={search}>
          Resolve Type ID
        </button>
        <button
          type="button"
          className="is-primary"
          disabled={!outPoint || !method || busy}
          onClick={execute}
        >
          {busy ? "Executing…" : "Execute method"}
        </button>
      </div>
    </div>
  );
}

function stringify(value: unknown) {
  return JSON.stringify(
    value,
    (_, nested) => (typeof nested === "bigint" ? nested.toString() : nested),
    2,
  );
}
