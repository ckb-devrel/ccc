"use client";

import FileUploadArea from "@/src/app/utils/(tools)/FileUpload/page";
import { Button } from "@/src/components/Button";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { Message } from "@/src/components/Message";
import { useApp } from "@/src/context";
import { useGetExplorerLink } from "@/src/utils";
import { ccc } from "@ckb-ccc/connector-react";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BurnButton,
  CellFoundSection,
  DeploymentResultSection,
  TypeIdCellListItem,
} from "./deployComponents";
import { runBurn, runDeploy, type DeployResult } from "./deployLogic";
import { createImmutableLock } from "./helpers";
import { useDeployScript } from "./useDeployScript";

export default function DeployScript() {
  const { createSender } = useApp();
  const { log, error } = createSender("Deploy Script");
  const { explorerTransaction } = useGetExplorerLink();

  const [file, setFile] = useState<File | null>(null);
  const [immutable, setImmutable] = useState(false);
  const [operation, setOperation] = useState<
    "deploy" | "update" | "burn" | null
  >(null);
  const [lastDeployment, setLastDeployment] = useState<
    | (DeployResult & { immutable: boolean; action: "deployed" | "updated" })
    | null
  >(null);
  const [newCellOccupiedSizes, setNewCellOccupiedSizes] = useState<{
    signer: ccc.Signer;
    ownedBaseSize: number | null;
    immutableBaseSize: number | null;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refreshTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const {
    signer,
    typeIdArgs,
    typeIdCells,
    cellCreationTimestamps,
    isScanningCells,
    isLoadingMoreCells,
    hasMoreTypeIdCells,
    cellScanError,
    foundCell,
    handleSelectTypeIdCell,
    clearSelection,
    normalizeTypeIdArgs,
    refreshTypeIdCells,
    loadMoreTypeIdCells,
  } = useDeployScript();

  const isDeploying = operation !== null;

  const refreshCellsAfterTransaction = useCallback(() => {
    refreshTimersRef.current.forEach(clearTimeout);
    refreshTypeIdCells();
    refreshTimersRef.current = [
      setTimeout(refreshTypeIdCells, 1500),
      setTimeout(refreshTypeIdCells, 4000),
    ];
  }, [refreshTypeIdCells]);

  useEffect(() => () => refreshTimersRef.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (!signer) return;
    let cancelled = false;

    (async () => {
      try {
        const [{ script: lock }, type] = await Promise.all([
          signer.getRecommendedAddressObj(),
          ccc.Script.fromKnownScript(
            signer.client,
            ccc.KnownScript.TypeId,
            "00".repeat(32),
          ),
        ]);
        const ownedBaseSize = ccc.CellOutput.from({ lock, type }).occupiedSize;
        const immutableBaseSize = ccc.CellOutput.from({
          lock: createImmutableLock(),
          type,
        }).occupiedSize;
        if (!cancelled) {
          setNewCellOccupiedSizes({
            signer,
            ownedBaseSize,
            immutableBaseSize,
          });
        }
      } catch {
        if (!cancelled) {
          setNewCellOccupiedSizes({
            signer,
            ownedBaseSize: null,
            immutableBaseSize: null,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signer]);

  const handleBurn = useCallback(async () => {
    if (!signer || !foundCell) return;
    setOperation("burn");
    setLastDeployment(null);
    try {
      const txHash = await runBurn(signer, foundCell, log);
      if (!txHash) return;
      log("Transaction sent:", explorerTransaction(txHash));
      await signer.client.waitTransaction(txHash);
      log("Transaction committed:", explorerTransaction(txHash));
      clearSelection();
      refreshCellsAfterTransaction();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      error("Burn failed:", msg);
    } finally {
      setOperation(null);
    }
  }, [
    signer,
    foundCell,
    log,
    error,
    explorerTransaction,
    clearSelection,
    refreshCellsAfterTransaction,
  ]);

  const handleDeploy = useCallback(async () => {
    if (!signer) {
      error("Please connect a wallet first");
      return;
    }
    if (!file) {
      error("Please select a file to deploy");
      return;
    }

    const action = foundCell ? "updated" : "deployed";
    setOperation(foundCell ? "update" : "deploy");
    setLastDeployment(null);
    try {
      log("Reading file...");
      const result = await runDeploy(
        signer,
        file,
        immutable,
        typeIdArgs,
        foundCell,
        log,
        error,
      );

      if (!result) return;
      const { txHash } = result;

      log("Transaction sent:", explorerTransaction(txHash));
      await signer.client.waitTransaction(txHash);
      log("Transaction committed:", explorerTransaction(txHash));
      setLastDeployment({ ...result, immutable, action });
      if (foundCell) clearSelection();
      refreshCellsAfterTransaction();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      error("Deployment failed:", msg);
    } finally {
      setOperation(null);
    }
  }, [
    signer,
    file,
    immutable,
    typeIdArgs,
    foundCell,
    log,
    error,
    explorerTransaction,
    clearSelection,
    refreshCellsAfterTransaction,
  ]);

  const normalizedInput = normalizeTypeIdArgs(typeIdArgs);
  const baseOccupiedSize = (() => {
    if (foundCell) {
      if (!immutable) return foundCell.cellOutput.occupiedSize;
      return ccc.CellOutput.from({
        lock: createImmutableLock(),
        type: foundCell.cellOutput.type,
      }).occupiedSize;
    }
    if (newCellOccupiedSizes && newCellOccupiedSizes.signer === signer) {
      return immutable
        ? newCellOccupiedSizes.immutableBaseSize
        : newCellOccupiedSizes.ownedBaseSize;
    }
    return undefined;
  })();
  const toOccupy = !file
    ? undefined
    : baseOccupiedSize === null
      ? "Unavailable"
      : baseOccupiedSize === undefined
        ? signer
          ? "Calculating..."
          : "Connect wallet to calculate"
        : `${ccc.fixedPointToString(
            ccc.fixedPointFrom(baseOccupiedSize + file.size),
          )} CKB`;
  const deployButtonLabel =
    operation === "update"
      ? "Updating..."
      : operation === "deploy"
        ? "Deploying..."
        : !file
          ? "Select File"
          : typeIdArgs
            ? "Update"
            : "Deploy";

  return (
    <div className="flex w-full flex-col items-stretch">
      <Message title="Hint" type="info">
        Upload a file to deploy it as a CKB cell with Type ID trait. The file
        will be stored on-chain and can be referenced by its Type ID. Select an
        existing Type ID cell below to update it, or leave all cells unselected
        to create a new one.
      </Message>

      <FileUploadArea
        file={file}
        onFileChange={setFile}
        fileInputRef={fileInputRef}
        toOccupy={toOccupy}
        immutable={immutable}
        onImmutableChange={() => setImmutable((value) => !value)}
      >
        {foundCell && (
          <CellFoundSection foundCell={foundCell} onClear={clearSelection} />
        )}
      </FileUploadArea>

      {lastDeployment && <DeploymentResultSection result={lastDeployment} />}

      {cellScanError && (
        <Message title="Unable to load cells" type="error" expandable={false}>
          <div className="space-y-2">
            <p>{cellScanError}</p>
            <Button variant="info" onClick={refreshTypeIdCells}>
              Retry
            </Button>
          </div>
        </Message>
      )}

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium text-gray-700">
            Update Existing Cell
          </h2>
          <button
            type="button"
            onClick={refreshTypeIdCells}
            disabled={isScanningCells}
            className="flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${isScanningCells ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {!isScanningCells && !cellScanError && typeIdCells.length === 0 && (
          <p className="text-sm text-gray-500">
            No existing Type ID cells found.
          </p>
        )}

        {typeIdCells.length > 0 && (
          <>
            <div className="mt-2">
              <div className="flex flex-col gap-2">
                {typeIdCells.map((cell, index) => {
                  const cellNorm = normalizeTypeIdArgs(
                    cell.cellOutput.type?.args || "",
                  );
                  const isSelected =
                    cellNorm === normalizedInput && normalizedInput !== "";

                  return (
                    <TypeIdCellListItem
                      key={ccc.hexFrom(cell.outPoint.toBytes())}
                      cell={cell}
                      index={index}
                      onSelect={() => handleSelectTypeIdCell(cell)}
                      isSelected={isSelected}
                      creationTimestamp={
                        cellCreationTimestamps[
                          ccc.hexFrom(cell.outPoint.toBytes())
                        ]
                      }
                    />
                  );
                })}
              </div>
            </div>
            {hasMoreTypeIdCells && (
              <div className="mt-3 flex justify-center">
                <Button
                  variant="info"
                  onClick={loadMoreTypeIdCells}
                  disabled={isLoadingMoreCells}
                >
                  {isLoadingMoreCells ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <ButtonsPanel>
        <Button
          variant="success"
          className="self-center"
          onClick={file ? handleDeploy : () => fileInputRef.current?.click()}
          disabled={isDeploying}
        >
          {deployButtonLabel}
        </Button>
        {typeIdArgs && (
          <BurnButton
            onClick={handleBurn}
            disabled={isDeploying || !foundCell || !signer}
          />
        )}
      </ButtonsPanel>
    </div>
  );
}
