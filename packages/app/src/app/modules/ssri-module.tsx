"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { ssri } from "@ckb-ccc/ssri";
import { useState } from "react";
import { CopyableReadoutValue } from "../copyable-readout-value";
import { ModuleItemList, ModuleSelectionItem } from "../module-item-list";
import { ModuleTextarea } from "../module-textarea";
import type { ModuleRuntimeProps } from "../modules";
import { reportModuleError, splitLines } from "./module-helpers";

type ContextLevel = "none" | "script" | "cell" | "transaction";
type ContractSource = "typeId" | "outPoint";

function contextName(level: Exclude<ContextLevel, "none">) {
  return level[0].toUpperCase() + level.slice(1);
}

function parseContext(level: ContextLevel, value: string) {
  if (level === "none") return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${contextName(level)} context must be valid JSON`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${contextName(level)} context must be a JSON object`);
  }

  if (level === "cell") {
    return {
      cell: ccc.CellAny.from(parsed as ccc.CellAnyLike),
    } satisfies ssri.ContextCell;
  }
  if (level === "script") {
    return {
      script: ccc.Script.from(parsed as ccc.ScriptLike),
    } satisfies ssri.ContextScript;
  }
  return {
    tx: ccc.Transaction.from(parsed as ccc.TransactionLike),
  } satisfies ssri.ContextTransaction;
}

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

async function resolveContractOutPoint(
  client: ccc.Client,
  source: ContractSource,
  typeIdArgs: string,
  outPoint: string,
) {
  if (source === "outPoint") return outPoint;
  const found = await findContract(client, typeIdArgs);
  return `${found.txHash}:${found.index}`;
}

function parseOutPoint(value: string) {
  const separator = value.lastIndexOf(":");
  if (separator < 0) throw new Error("OutPoint must use txHash:index format");
  return ccc.OutPoint.from({
    txHash: value.slice(0, separator),
    index: value.slice(separator + 1),
  });
}

async function callSsri(
  client: ccc.Client,
  executorUrl: string,
  outPointText: string,
  method: string,
  argsText: string,
  contextLevel: ContextLevel,
  contextText: string,
) {
  const outPoint = parseOutPoint(outPointText);
  const scriptCell = await client.getCell(outPoint);
  if (!scriptCell) throw new Error("SSRI contract cell not found");
  const args = splitLines(argsText).map((value) => ccc.hexFrom(value));
  const context = parseContext(contextLevel, contextText);
  const executor = new ssri.ExecutorJsonRpc(executorUrl);
  const contract = new ssri.Trait(scriptCell.outPoint, executor);
  return contract
    .assertExecutor()
    .runScript(contract.code, method, args, context);
}

// -----------------------------------------------------------------------------

export function SsriModule({ client, log, show }: ModuleRuntimeProps) {
  const [executor, setExecutor] = useState("http://localhost:9090");
  const [typeId, setTypeId] = useState(
    "0x8fd55df879dc6176c95f3c420631f990ada2d4ece978c9512c39616dead2ed56",
  );
  const [contractSource, setContractSource] =
    useState<ContractSource>("typeId");
  const [directOutPoint, setDirectOutPoint] = useState("");
  const [method, setMethod] = useState("SSRI.version");
  const [args, setArgs] = useState("");
  const [contextLevel, setContextLevel] = useState<ContextLevel>("none");
  const [context, setContext] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  const execute = async () => {
    setBusy(true);
    show({
      label: "SSRI",
      tone: "pending",
      content: <strong>{`Calling ${method}…`}</strong>,
    });
    try {
      const outPoint = await resolveContractOutPoint(
        client,
        contractSource,
        typeId,
        directOutPoint,
      );
      const response = await callSsri(
        client,
        executor,
        outPoint,
        method,
        args,
        contextLevel,
        context,
      );
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
        <ModuleItemList
          count={CONTRACT_SOURCES.length}
          emptyText="No contract references"
          label="Contract reference"
          selection
        >
          {CONTRACT_SOURCES.map(({ source, label, description }) => (
            <ModuleSelectionItem
              key={source}
              label={label}
              description={description}
              selected={contractSource === source}
              onClick={() => setContractSource(source)}
            />
          ))}
        </ModuleItemList>
        {contractSource === "typeId" ? (
          <div className="module-field module-field-wide">
            <span>Contract Type ID args</span>
            <input
              aria-label="Contract Type ID args"
              value={typeId}
              spellCheck={false}
              onChange={(event) => setTypeId(event.currentTarget.value)}
            />
          </div>
        ) : (
          <label className="module-field module-field-wide">
            <span>Contract outpoint / txHash:index</span>
            <input
              value={directOutPoint}
              spellCheck={false}
              onChange={(event) => setDirectOutPoint(event.currentTarget.value)}
            />
          </label>
        )}
        <ModuleItemList
          count={CONTEXT_LEVELS.length}
          emptyText="No context levels"
          label="Context level"
          selection
        >
          {CONTEXT_LEVELS.map(({ level, label, description }) => (
            <ModuleSelectionItem
              key={level}
              label={label}
              description={description}
              selected={contextLevel === level}
              onClick={() => {
                setContextLevel(level);
                setContext(contextExample(level));
              }}
            />
          ))}
        </ModuleItemList>
        {contextLevel === "none" ? null : (
          <label className="module-field module-field-wide">
            <span>{contextLabel(contextLevel)}</span>
            <ModuleTextarea
              value={context}
              placeholder={contextPlaceholder(contextLevel)}
              spellCheck={false}
              onChange={(event) => setContext(event.currentTarget.value)}
            />
          </label>
        )}
        <label className="module-field module-field-wide">
          <span>Molecule-encoded hex arguments / one per line</span>
          <ModuleTextarea
            value={args}
            placeholder={"0x…\n0x…"}
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
        <button
          type="button"
          className="is-primary"
          disabled={
            (contractSource === "typeId" ? !typeId : !directOutPoint) ||
            !method ||
            busy ||
            (contextLevel !== "none" && !context.trim())
          }
          onClick={execute}
        >
          {busy ? "Executing…" : "Execute method"}
        </button>
      </div>
    </div>
  );
}

function contextLabel(level: Exclude<ContextLevel, "none">) {
  return `${contextName(level)} context / JSON object`;
}

function contextPlaceholder(level: Exclude<ContextLevel, "none">) {
  return `Paste ${contextName(level)} JSON`;
}

const EMPTY_SCRIPT = {
  codeHash: `0x${"00".repeat(32)}`,
  hashType: "type",
  args: "0x",
};

const CONTRACT_SOURCES: {
  source: ContractSource;
  label: string;
  description: string;
}[] = [
  {
    source: "typeId",
    label: "Type ID",
    description: "Locate the singleton cell",
  },
  {
    source: "outPoint",
    label: "Outpoint",
    description: "Address the contract cell directly",
  },
];

const CONTEXT_LEVELS: {
  level: ContextLevel;
  label: string;
  description: string;
}[] = [
  { level: "none", label: "No context", description: "Code level" },
  { level: "script", label: "Script", description: "Script level" },
  { level: "cell", label: "Cell", description: "Cell level" },
  {
    level: "transaction",
    label: "Transaction",
    description: "Transaction level",
  },
];

function contextExample(level: ContextLevel) {
  const value = (() => {
    switch (level) {
      case "script":
        return EMPTY_SCRIPT;
      case "cell":
        return {
          cellOutput: {
            capacity: "0x0",
            lock: EMPTY_SCRIPT,
            type: null,
          },
          outputData: "0x",
        };
      case "transaction":
        return {
          version: "0x0",
          cellDeps: [],
          headerDeps: [],
          inputs: [],
          outputs: [],
          outputsData: [],
          witnesses: [],
        };
      default:
        return "";
    }
  })();
  return value === "" ? value : JSON.stringify(value, null, 2);
}

function stringify(value: unknown) {
  return JSON.stringify(
    value,
    (_, nested) => (typeof nested === "bigint" ? nested.toString() : nested),
    2,
  );
}
