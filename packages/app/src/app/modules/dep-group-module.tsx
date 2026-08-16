"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { useEffect, useRef, useState } from "react";
import { ModuleItemList, ModuleSelectionItem } from "../module-item-list";
import { ModuleTextarea } from "../module-textarea";
import type { ModuleRuntimeProps } from "../modules";
import { usePagedModuleItems } from "../use-paged-module-items";
import {
  reportModuleError,
  showTransaction,
  splitLines,
} from "./module-helpers";

const OutPointVec = ccc.mol.vector(ccc.OutPoint);

function isCompleteTypeId(value: string) {
  try {
    return ccc.bytesFrom(value).length === 32;
  } catch {
    return false;
  }
}

type DepGroupCell = {
  cell: ccc.Cell;
  outPoints: ccc.OutPoint[];
};

type TypeIdSelection = "cell" | "manual" | "new";

async function* findDepGroups(signer: ccc.Signer) {
  const { script: lock } = await signer.getRecommendedAddressObj();
  const type = await ccc.Script.fromKnownScript(
    signer.client,
    ccc.KnownScript.TypeId,
    "",
  );
  for await (const cell of signer.client.findCells(
    {
      script: type,
      scriptType: "type",
      scriptSearchMode: "prefix",
      withData: true,
      filter: { script: lock },
    },
    "desc",
  )) {
    try {
      yield { cell, outPoints: OutPointVec.decode(cell.outputData) };
    } catch {
      // A Type ID cell is only a dep group when its data is a valid OutPointVec.
    }
  }
}

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
  const activeSigner = useRef(signer);
  const refreshTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [typeId, setTypeId] = useState("");
  const [typeIdSelection, setTypeIdSelection] =
    useState<TypeIdSelection>("new");
  const [outPoints, setOutPoints] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const {
    hasMore: hasMoreDepGroups,
    items: depGroups,
    loadMore: loadMoreDepGroups,
    loading: loadingDepGroups,
  } = usePagedModuleItems<ccc.Signer, DepGroupCell>({
    source: signer,
    revision: refreshNonce,
    iterate: findDepGroups,
    onError: (cause) =>
      reportModuleError(cause, show, log, "Unable to load dep groups"),
  });

  useEffect(() => {
    if (activeSigner.current !== signer) {
      activeSigner.current = signer;
      setTypeId("");
      setTypeIdSelection("new");
      setOutPoints("");
    }
  }, [signer]);

  useEffect(
    () => () => {
      refreshTimers.current.forEach(clearTimeout);
    },
    [],
  );

  useEffect(() => {
    if (typeIdSelection !== "manual" || !isCompleteTypeId(typeId)) return;
    let cancelled = false;
    findDepGroup(client, typeId)
      .then(({ outPoints: loadedOutPoints }) => {
        if (cancelled) return;
        setOutPoints(
          loadedOutPoints
            .map(({ txHash, index }) => `${txHash}:${index}`)
            .join("\n"),
        );
      })
      .catch(() => {
        if (!cancelled) setOutPoints("");
      });
    return () => {
      cancelled = true;
    };
  }, [client, typeId, typeIdSelection]);

  const selectDepGroup = (depGroup?: DepGroupCell) => {
    setTypeIdSelection(depGroup ? "cell" : "new");
    setTypeId(depGroup?.cell.cellOutput.type?.args ?? "");
    setOutPoints(
      depGroup?.outPoints
        .map(({ txHash, index }) => `${txHash}:${index}`)
        .join("\n") ?? "",
    );
  };

  const save = async () => {
    if (!signer) return;
    setBusy(true);
    const updating = typeIdSelection !== "new";
    try {
      const result = await saveDepGroup(
        signer,
        typeId,
        parseOutPoints(outPoints),
      );
      const txHash = await signer.sendTransaction(result.tx);
      setTypeId(result.typeId);
      if (!updating) setTypeIdSelection("cell");
      showTransaction(
        client,
        show,
        txHash,
        `Dep group ${updating ? "updated" : "created"}`,
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
      refreshTimers.current.forEach(clearTimeout);
      setRefreshNonce((value) => value + 1);
      refreshTimers.current = [
        setTimeout(() => setRefreshNonce((value) => value + 1), 1500),
        setTimeout(() => setRefreshNonce((value) => value + 1), 4000),
      ];
    } catch (cause) {
      reportModuleError(cause, show, log, "Unable to save dep group");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="module-console">
      <div className="module-fields">
        {typeIdSelection === "manual" ? (
          <label className="module-field module-field-wide">
            <span>Type ID</span>
            <input
              value={typeId}
              spellCheck={false}
              placeholder="0x…"
              onChange={(event) => {
                setTypeId(event.currentTarget.value);
                setOutPoints("");
              }}
            />
          </label>
        ) : null}
        <ModuleItemList
          label="Dep groups"
          count={depGroups.length}
          emptyText="No dep groups found"
          hasMore={hasMoreDepGroups}
          loadingMore={loadingDepGroups}
          onLoadMore={loadMoreDepGroups}
          selection
        >
          <ModuleSelectionItem
            selected={typeIdSelection === "new"}
            title="Create a new dep group"
            onClick={() => selectDepGroup()}
            label="Create new"
            description="Create a new Type ID dep group"
          />
          <ModuleSelectionItem
            selected={typeIdSelection === "manual"}
            title="Enter a Type ID manually"
            onClick={() => {
              setTypeIdSelection("manual");
              setTypeId("");
              setOutPoints("");
            }}
            label="Enter manually"
            description="Use a Type ID that is not listed"
          />
          {depGroups.map((depGroup) => {
            const id = depGroup.cell.cellOutput.type?.args;
            if (!id) return null;
            const count = depGroup.outPoints.length;
            return (
              <ModuleSelectionItem
                selected={typeIdSelection === "cell" && id === typeId}
                title={`Type ID: ${id}\nOut point: ${depGroup.cell.outPoint.txHash}:${depGroup.cell.outPoint.index}`}
                key={ccc.hexFrom(depGroup.cell.outPoint.toBytes())}
                onClick={() => selectDepGroup(depGroup)}
                label={`Type ID · ${shortHex(id)}`}
                description={`${count} ${count === 1 ? "outpoint" : "outpoints"} · ${shortHex(depGroup.cell.outPoint.txHash)}`}
              />
            );
          })}
        </ModuleItemList>
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
        <button
          type="button"
          className="is-primary"
          disabled={
            !signer ||
            busy ||
            (typeIdSelection === "manual" && !isCompleteTypeId(typeId))
          }
          onClick={save}
        >
          {busy
            ? "Saving…"
            : typeIdSelection === "new"
              ? "Create dep group"
              : "Update dep group"}
        </button>
      </div>
    </div>
  );
}

function shortHex(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}
