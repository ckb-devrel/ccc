"use client";

import { useApp } from "@/src/context";
import { ccc } from "@ckb-ccc/connector-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeTypeIdArgs } from "./helpers";

export function useDeployScript() {
  const { signer } = useApp();
  const { client } = ccc.useCcc();

  const [userAddress, setUserAddress] = useState("");
  const [typeIdArgs, setTypeIdArgs] = useState("");
  const [typeIdCells, setTypeIdCells] = useState<ccc.Cell[]>([]);
  const [isScanningCells, setIsScanningCells] = useState(false);
  const [foundCell, setFoundCell] = useState<ccc.Cell | null>(null);
  const [foundCellAddress, setFoundCellAddress] = useState("");
  const [isAddressMatch, setIsAddressMatch] = useState<boolean | null>(null);
  const [isCheckingCell, setIsCheckingCell] = useState(false);
  const [cellCheckError, setCellCheckError] = useState("");
  const [cellCreationTimestamps, setCellCreationTimestamps] = useState<
    Record<string, number>
  >({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const lastCheckedTypeIdRef = useRef("");
  const isCheckingRef = useRef(false);

  const resetCellCheckState = useCallback((errorMessage = "") => {
    setFoundCell(null);
    setFoundCellAddress("");
    setIsAddressMatch(null);
    setCellCheckError(errorMessage);
  }, []);

  // User address
  useEffect(() => {
    if (!signer) {
      setUserAddress("");
      setIsAddressMatch(null);
      return;
    }
    signer
      .getRecommendedAddress()
      .then(setUserAddress)
      .catch(() => setUserAddress(""));
  }, [signer]);

  // Scan Type ID cells (runs on signer change or force refresh)
  const refreshTypeIdCells = useCallback(() => {
    setRefreshTrigger((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!signer) {
      setTypeIdCells([]);
      return;
    }
    setIsScanningCells(true);
    (async () => {
      try {
        const { script: lock } = await signer.getRecommendedAddressObj();
        const typeIdScript = await ccc.Script.fromKnownScript(
          signer.client,
          ccc.KnownScript.TypeId,
          "",
        );
        const cells: ccc.Cell[] = [];
        for await (const cell of signer.client.findCells({
          script: typeIdScript,
          scriptType: "type",
          scriptSearchMode: "prefix",
          withData: true,
          filter: { script: lock },
        })) {
          cells.push(cell);
          setTypeIdCells([...cells]);
        }
      } catch {
        // ignore
      } finally {
        setIsScanningCells(false);
      }
    })();
  }, [signer, refreshTrigger]);

  // Fetch block header timestamp for each type_id cell (creation date)
  useEffect(() => {
    if (!client || typeIdCells.length === 0) {
      setCellCreationTimestamps({});
      return;
    }
    let cancelled = false;
    const next: Record<string, number> = {};
    (async () => {
      for (const cell of typeIdCells) {
        if (cancelled) return;
        try {
          const res = await client.getCellWithHeader(cell.outPoint);
          if (cancelled || !res?.header) continue;
          const key = ccc.hexFrom(cell.outPoint.toBytes());
          next[key] = Number(res.header.timestamp);
        } catch {
          // ignore per-cell errors
        }
      }
      if (!cancelled) setCellCreationTimestamps(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [client, typeIdCells]);

  // Derive address match from user + found cell address
  useEffect(() => {
    if (userAddress && foundCellAddress) {
      setIsAddressMatch(userAddress === foundCellAddress);
    } else {
      setIsAddressMatch(null);
    }
  }, [userAddress, foundCellAddress]);

  const handleSelectTypeIdCell = useCallback(
    async (cell: ccc.Cell) => {
      const cellTypeIdArgs = cell.cellOutput.type?.args || "";
      setTypeIdArgs(cellTypeIdArgs);
      setFoundCell(cell);
      try {
        const address = ccc.Address.fromScript(
          cell.cellOutput.lock,
          client,
        ).toString();
        setFoundCellAddress(address);
        setCellCheckError("");
        setIsAddressMatch(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        resetCellCheckState(`Error getting cell address: ${msg}`);
      }
      lastCheckedTypeIdRef.current = normalizeTypeIdArgs(cellTypeIdArgs);
    },
    [client, resetCellCheckState],
  );

  const clearSelection = useCallback(() => {
    setTypeIdArgs("");
    setFoundCell(null);
    setFoundCellAddress("");
    setIsAddressMatch(null);
    setCellCheckError("");
  }, []);

  // Debounced Type ID cell check when typeIdArgs changes (manual input)
  useEffect(() => {
    const normalized = normalizeTypeIdArgs(typeIdArgs);

    if (lastCheckedTypeIdRef.current === normalized || isCheckingRef.current) {
      return;
    }

    if (!typeIdArgs.trim()) {
      lastCheckedTypeIdRef.current = "";
      resetCellCheckState();
      return;
    }

    const timeoutId = setTimeout(async () => {
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;
      lastCheckedTypeIdRef.current = normalized;

      try {
        const typeIdBytes = ccc.bytesFrom(normalized);
        if (typeIdBytes.length !== 32) {
          resetCellCheckState(
            "Type ID args must be 32 bytes (64 hex characters)",
          );
          return;
        }
      } catch {
        resetCellCheckState("Invalid Type ID args format");
        return;
      } finally {
        isCheckingRef.current = false;
      }

      isCheckingRef.current = true;

      setIsCheckingCell(true);
      setCellCheckError("");

      try {
        const typeIdScript = await ccc.Script.fromKnownScript(
          client,
          ccc.KnownScript.TypeId,
          normalized,
        );
        const cell = await client.findSingletonCellByType(typeIdScript, true);

        if (cell) {
          setFoundCell(cell);
          const address = ccc.Address.fromScript(
            cell.cellOutput.lock,
            client,
          ).toString();
          setFoundCellAddress(address);
          setCellCheckError("");
        } else {
          resetCellCheckState("Type ID cell not found on-chain");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        resetCellCheckState(`Error checking Type ID: ${msg}`);
      } finally {
        setIsCheckingCell(false);
        isCheckingRef.current = false;
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [typeIdArgs, client, resetCellCheckState]);

  return {
    signer,
    client,
    userAddress,
    typeIdArgs,
    setTypeIdArgs,
    typeIdCells,
    cellCreationTimestamps,
    isScanningCells,
    foundCell,
    foundCellAddress,
    isAddressMatch,
    isCheckingCell,
    cellCheckError,
    handleSelectTypeIdCell,
    clearSelection,
    normalizeTypeIdArgs,
    refreshTypeIdCells,
  };
}
