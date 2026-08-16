"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { createTypeId, transferTypeId } from "@ckb-ccc/type-id";
import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { CopyableText } from "../copyable-text";
import { ModuleItemList, ModuleSelectionItem } from "../module-item-list";
import type { ModuleRuntimeProps } from "../modules";
import { usePagedModuleItems } from "../use-paged-module-items";
import styles from "./deployer-module.module.css";
import { reportModuleError, showTransaction } from "./module-helpers";

function immutableLock() {
  return ccc.Script.from({
    codeHash: `0x${"00".repeat(32)}`,
    hashType: "data",
    args: "0x",
  });
}

function isCompleteTypeId(value: string) {
  try {
    return ccc.bytesFrom(value).length === 32;
  } catch {
    return false;
  }
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

type TypeIdCellInfo = {
  cell: ccc.Cell;
  createdAt?: number;
};

type TypeIdSelection = "cell" | "manual" | "new";

async function* findTypeIdCells(signer: ccc.Signer) {
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
    yield cell;
  }
}

async function prepareTypeIdCells(cells: ccc.Cell[], signer: ccc.Signer) {
  return Promise.all(
    cells.map(async (cell): Promise<TypeIdCellInfo> => {
      try {
        const result = await signer.client.getCellWithHeader(cell.outPoint);
        return {
          cell,
          createdAt: result?.header
            ? Number(result.header.timestamp)
            : undefined,
        };
      } catch {
        return { cell };
      }
    }),
  );
}

async function deploy(
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

export function DeployerModule({
  client,
  log,
  show,
  signer,
}: ModuleRuntimeProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const activeSigner = useRef(signer);
  const refreshTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [file, setFile] = useState<File>();
  const [typeId, setTypeId] = useState("");
  const [typeIdSelection, setTypeIdSelection] =
    useState<TypeIdSelection>("new");
  const [manualTypeIdCell, setManualTypeIdCell] = useState<TypeIdCellInfo>();
  const [fileDataHash, setFileDataHash] = useState<string>();
  const [newCellBaseSizes, setNewCellBaseSizes] = useState<{
    immutable: number;
    owned: number;
  }>();
  const [immutable, setImmutable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const {
    hasMore: hasMoreTypeIdCells,
    items: typeIdCells,
    loadMore: loadMoreTypeIdCells,
    loading: loadingTypeIdCells,
  } = usePagedModuleItems({
    source: signer,
    revision: refreshNonce,
    iterate: findTypeIdCells,
    preparePage: prepareTypeIdCells,
    onError: (cause) =>
      reportModuleError(cause, show, log, "Unable to load Type ID cells"),
  });

  useEffect(() => {
    let cancelled = false;
    if (!file) return;

    file
      .arrayBuffer()
      .then((buffer) => {
        if (!cancelled) setFileDataHash(ccc.hashCkb(new Uint8Array(buffer)));
      })
      .catch(() => {
        if (!cancelled) setFileDataHash("Unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    if (!signer) return;
    let cancelled = false;
    Promise.all([
      signer.getRecommendedAddressObj(),
      ccc.Script.fromKnownScript(
        signer.client,
        ccc.KnownScript.TypeId,
        "00".repeat(32),
      ),
    ])
      .then(([{ script: lock }, type]) => {
        if (cancelled) return;
        setNewCellBaseSizes({
          owned: ccc.CellOutput.from({ lock, type }).occupiedSize,
          immutable: ccc.CellOutput.from({
            lock: immutableLock(),
            type,
          }).occupiedSize,
        });
      })
      .catch(() => {
        if (!cancelled) setNewCellBaseSizes(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [signer]);

  useEffect(() => {
    if (activeSigner.current !== signer) {
      activeSigner.current = signer;
      setTypeId("");
      setTypeIdSelection("new");
      setManualTypeIdCell(undefined);
    }
  }, [signer]);

  useEffect(
    () => () => {
      refreshTimers.current.forEach(clearTimeout);
    },
    [],
  );

  useEffect(() => {
    if (typeIdSelection !== "manual" || !isCompleteTypeId(typeId) || !signer) {
      return;
    }
    let cancelled = false;
    findTypeIdCell(signer.client, typeId)
      .then(async (cell) => {
        if (!cell || cancelled) return;
        try {
          const result = await signer.client.getCellWithHeader(cell.outPoint);
          if (!cancelled) {
            setManualTypeIdCell({
              cell,
              createdAt: result?.header
                ? Number(result.header.timestamp)
                : undefined,
            });
          }
        } catch {
          if (!cancelled) setManualTypeIdCell({ cell });
        }
      })
      .catch(() => {
        if (!cancelled) setManualTypeIdCell(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [signer, typeId, typeIdSelection]);

  const submit = async (mode: "burn" | "deploy") => {
    if (!signer) return;
    setBusy(true);
    const action =
      mode === "burn"
        ? "burn"
        : typeIdSelection === "new"
          ? "deployment"
          : "update";
    try {
      let tx: ccc.Transaction;
      let detail = "";
      if (mode === "burn") {
        tx = await burnTypeId(signer, typeId);
      } else {
        if (!file) throw new Error("Select a file to deploy");
        const result = await deploy(signer, file, typeId, immutable);
        tx = result.tx;
        detail = `; Type ID: ${result.id}; Data hash: ${result.dataHash}`;
        setTypeId(result.id);
        if (typeIdSelection === "new") setTypeIdSelection("cell");
      }
      const txHash = await signer.sendTransaction(tx);
      showTransaction(client, show, txHash, `Cell ${action} sent`);
      log(`Transaction sent: ${txHash}${detail}`);
      await signer.client.waitTransaction(txHash);
      showTransaction(client, show, txHash, `Cell ${action} committed`, true);
      log(`Transaction committed: ${txHash}`, "success");
      if (mode === "burn") setTypeId("");
      refreshTimers.current.forEach(clearTimeout);
      setRefreshNonce((value) => value + 1);
      refreshTimers.current = [
        setTimeout(() => setRefreshNonce((value) => value + 1), 1500),
        setTimeout(() => setRefreshNonce((value) => value + 1), 4000),
      ];
    } catch (cause) {
      reportModuleError(cause, show, log, `Cell ${action} failed`);
    } finally {
      setBusy(false);
    }
  };

  const selectedTypeIdCell =
    typeIdSelection === "cell"
      ? typeIdCells.find(({ cell }) => cell.cellOutput.type?.args === typeId)
      : typeIdSelection === "manual"
        ? manualTypeIdCell
        : undefined;
  const selectedCellBaseSize = selectedTypeIdCell
    ? immutable
      ? ccc.CellOutput.from({
          lock: immutableLock(),
          type: selectedTypeIdCell.cell.cellOutput.type,
        }).occupiedSize
      : selectedTypeIdCell.cell.cellOutput.occupiedSize
    : undefined;
  const newCellBaseSize = immutable
    ? newCellBaseSizes?.immutable
    : newCellBaseSizes?.owned;
  const deployedCellSize = selectedCellBaseSize ?? newCellBaseSize;
  const capacityToOccupy =
    file && deployedCellSize !== undefined
      ? ccc.fixedPointToString(ccc.fixedPointFrom(deployedCellSize + file.size))
      : undefined;

  return (
    <div className="module-console">
      <div className="module-fields">
        <div className="module-field module-field-wide">
          <span id="deployer-file-label">File</span>
          <div className="module-file-input">
            <input
              ref={fileInput}
              type="file"
              aria-labelledby="deployer-file-label"
              onChange={(event) => {
                setFileDataHash(undefined);
                setFile(event.currentTarget.files?.[0]);
              }}
            />
            {file ? (
              <button
                type="button"
                className="module-file-clear"
                title="Clear selected file"
                aria-label="Clear selected file"
                onClick={() => {
                  setFile(undefined);
                  setFileDataHash(undefined);
                  if (fileInput.current) fileInput.current.value = "";
                }}
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
          {file ? (
            <DeployDetails
              title="File readout"
              footer={
                <label className={styles["deploy-lock-toggle"]}>
                  <input
                    type="checkbox"
                    checked={immutable}
                    onChange={(event) =>
                      setImmutable(event.currentTarget.checked)
                    }
                  />
                  <span className={styles["deploy-lock-copy"]}>
                    <strong>Immutable lock</strong>
                    <small>
                      Make this cell immutable. It can never be updated.
                    </small>
                  </span>
                  <span
                    className={styles["deploy-lock-indicator"]}
                    aria-hidden="true"
                  />
                </label>
              }
            >
              <DeployDetail label="Name" value={file.name} wide />
              <DeployDetail label="Size" value={formatFileSize(file.size)} />
              <DeployDetail
                label="To occupy"
                value={
                  capacityToOccupy ? `${capacityToOccupy} CKB` : "Calculating…"
                }
              />
              <DeployCopyDetail
                label="Data hash"
                value={fileDataHash ?? "Calculating…"}
                wide
              />
            </DeployDetails>
          ) : null}
        </div>
        {typeIdSelection === "manual" ? (
          <label className="module-field module-field-wide">
            <span>Type ID</span>
            <input
              value={typeId}
              spellCheck={false}
              placeholder="0x…"
              onChange={(event) => {
                setTypeId(event.currentTarget.value);
                setManualTypeIdCell(undefined);
              }}
            />
          </label>
        ) : null}
        <ModuleItemList
          label="Type ID cells"
          count={typeIdCells.length}
          emptyText="No Type ID cells found"
          hasMore={hasMoreTypeIdCells}
          loadingMore={loadingTypeIdCells}
          onLoadMore={loadMoreTypeIdCells}
          selection
        >
          <ModuleSelectionItem
            selected={typeIdSelection === "new"}
            title="Deploy a new Type ID cell"
            onClick={() => {
              setTypeIdSelection("new");
              setTypeId("");
              setManualTypeIdCell(undefined);
            }}
            label="Deploy new"
            description="Create a new Type ID cell"
          />
          <ModuleSelectionItem
            selected={typeIdSelection === "manual"}
            title="Enter a Type ID manually"
            onClick={() => {
              setTypeIdSelection("manual");
              setTypeId("");
              setManualTypeIdCell(undefined);
            }}
            label="Enter manually"
            description="Use a Type ID that is not listed"
          />
          {typeIdCells.map(({ cell }) => {
            const id = cell.cellOutput.type?.args;
            if (!id) return null;
            const outPoint = `${cell.outPoint.txHash}:${cell.outPoint.index}`;
            const occupied = ccc.fixedPointToString(
              ccc.fixedPointFrom(cell.occupiedSize),
            );
            const capacity = ccc.fixedPointToString(cell.cellOutput.capacity);
            return (
              <ModuleSelectionItem
                selected={typeIdSelection === "cell" && id === typeId}
                title={`Type ID: ${id}\nOut point: ${outPoint}`}
                key={ccc.hexFrom(cell.outPoint.toBytes())}
                onClick={() => {
                  setTypeIdSelection("cell");
                  setTypeId(id);
                  setManualTypeIdCell(undefined);
                }}
                label={`Type ID · ${shortHex(id)}`}
                description={`${occupied} / ${capacity} CKB · ${shortHex(cell.outPoint.txHash)}`}
              />
            );
          })}
        </ModuleItemList>
        {selectedTypeIdCell ? (
          <DeployDetails title="Cell to update">
            <DeployCopyDetail label="Type ID" value={typeId} wide />
            <DeployCopyDetail
              label="Out point"
              value={`${selectedTypeIdCell.cell.outPoint.txHash}:${selectedTypeIdCell.cell.outPoint.index}`}
              wide
            />
            <DeployDetail
              label="Occupied / capacity"
              value={`${ccc.fixedPointToString(ccc.fixedPointFrom(selectedTypeIdCell.cell.occupiedSize))} / ${ccc.fixedPointToString(selectedTypeIdCell.cell.cellOutput.capacity)} CKB`}
            />
            <DeployDetail
              label="Created"
              value={formatCreationDate(selectedTypeIdCell.createdAt)}
            />
            <DeployCopyDetail
              label="Data hash"
              value={ccc.hashCkb(selectedTypeIdCell.cell.outputData ?? "0x")}
              wide
            />
            {selectedTypeIdCell.cell.cellOutput.type ? (
              <DeployCopyDetail
                label="Type hash"
                value={selectedTypeIdCell.cell.cellOutput.type.hash()}
                wide
              />
            ) : null}
          </DeployDetails>
        ) : null}
      </div>
      <div className="module-actions">
        <button
          type="button"
          disabled={
            !signer ||
            busy ||
            typeIdSelection === "new" ||
            !isCompleteTypeId(typeId)
          }
          onClick={() => submit("burn")}
        >
          Burn
        </button>
        <button
          type="button"
          className="is-primary"
          disabled={
            !signer ||
            busy ||
            !file ||
            (typeIdSelection === "manual" && !isCompleteTypeId(typeId))
          }
          onClick={() => submit("deploy")}
        >
          {busy
            ? "Deploying…"
            : typeIdSelection === "new"
              ? "Deploy file"
              : "Update cell"}
        </button>
      </div>
    </div>
  );
}

function shortHex(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function DeployDetails({
  children,
  footer,
  title,
}: {
  children: ReactNode;
  footer?: ReactNode;
  title: string;
}) {
  return (
    <section className={styles["deploy-details"]}>
      <h3>{title}</h3>
      <dl>{children}</dl>
      {footer}
    </section>
  );
}

function DeployDetail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={
        wide
          ? `${styles["deploy-detail"]} ${styles["deploy-detail-wide"]}`
          : styles["deploy-detail"]
      }
    >
      <dt>{label}</dt>
      <dd title={value}>{value}</dd>
    </div>
  );
}

function DeployCopyDetail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={
        wide
          ? `${styles["deploy-detail"]} ${styles["deploy-detail-wide"]}`
          : styles["deploy-detail"]
      }
    >
      <dt>{label}</dt>
      <dd>
        <CopyableText
          className={styles["deploy-detail-copy"]}
          value={value}
          ariaLabel={`Copy ${label.toLowerCase()}`}
        >
          <span>{value}</span>
        </CopyableText>
      </dd>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) {
    return `${(bytes / 1024).toFixed(2)} KiB · ${bytes} bytes`;
  }
  return `${(bytes / 1024 ** 2).toFixed(2)} MiB · ${bytes} bytes`;
}

function formatCreationDate(timestamp?: number) {
  if (timestamp === undefined) return "Unavailable";
  try {
    return new Date(timestamp).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Unavailable";
  }
}
