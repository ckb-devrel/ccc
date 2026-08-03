"use client";

import { useApp } from "@/src/context";
import { ccc } from "@ckb-ccc/connector-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeTypeIdArgs } from "./helpers";

const TYPE_ID_PAGE_SIZE = 8;

async function takeCells(
  iterator: AsyncGenerator<ccc.Cell>,
  count: number,
): Promise<ccc.Cell[]> {
  const cells: ccc.Cell[] = [];
  while (cells.length < count) {
    const next = await iterator.next();
    if (next.done) break;
    cells.push(next.value);
  }
  return cells;
}

async function prepareCellPage(client: ccc.Client, cells: ccc.Cell[]) {
  const metadata = await Promise.all(
    cells.map(async (cell) => {
      const key = ccc.hexFrom(cell.outPoint.toBytes());
      try {
        const res = await client.getCellWithHeader(cell.outPoint);
        if (!res?.header) return { key };
        return {
          key,
          blockNumber: res.header.number,
          timestamp: Number(res.header.timestamp),
        };
      } catch {
        return { key };
      }
    }),
  );
  const metadataByKey = new Map(metadata.map((item) => [item.key, item]));
  const timestamps: Record<string, number> = {};

  for (const item of metadata) {
    if (item.timestamp != null) timestamps[item.key] = item.timestamp;
  }

  return {
    cells: [...cells].sort((a, b) => {
      const aBlock = metadataByKey.get(
        ccc.hexFrom(a.outPoint.toBytes()),
      )?.blockNumber;
      const bBlock = metadataByKey.get(
        ccc.hexFrom(b.outPoint.toBytes()),
      )?.blockNumber;
      if (aBlock == null && bBlock == null) return 0;
      if (aBlock == null) return 1;
      if (bBlock == null) return -1;
      if (aBlock === bBlock) return 0;
      return bBlock > aBlock ? 1 : -1;
    }),
    timestamps,
  };
}

export function useDeployScript() {
  const { signer } = useApp();

  const [typeIdArgs, setTypeIdArgs] = useState("");
  const [typeIdCells, setTypeIdCells] = useState<ccc.Cell[]>([]);
  const [isScanningCells, setIsScanningCells] = useState(false);
  const [isLoadingMoreCells, setIsLoadingMoreCells] = useState(false);
  const [hasMoreTypeIdCells, setHasMoreTypeIdCells] = useState(false);
  const [bufferedTypeIdCell, setBufferedTypeIdCell] = useState<ccc.Cell | null>(
    null,
  );
  const [cellScanError, setCellScanError] = useState("");
  const [foundCell, setFoundCell] = useState<ccc.Cell | null>(null);
  const [cellCreationTimestamps, setCellCreationTimestamps] = useState<
    Record<string, number>
  >({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const scanGenerationRef = useRef(0);
  const activeSignerRef = useRef<ccc.Signer | undefined>(undefined);
  const cellIteratorRef = useRef<AsyncGenerator<ccc.Cell> | null>(null);

  // Scan Type ID cells (runs on signer change or force refresh)
  const refreshTypeIdCells = useCallback(() => {
    setRefreshTrigger((t) => t + 1);
  }, []);

  useEffect(() => {
    const generation = ++scanGenerationRef.current;
    let cancelled = false;
    let iterator: AsyncGenerator<ccc.Cell> | null = null;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;

      const signerChanged = activeSignerRef.current !== signer;
      activeSignerRef.current = signer;
      setIsLoadingMoreCells(false);
      setIsScanningCells(false);
      setCellScanError("");

      if (signerChanged) {
        setTypeIdCells([]);
        setBufferedTypeIdCell(null);
        setHasMoreTypeIdCells(false);
        setCellCreationTimestamps({});
        setTypeIdArgs("");
        setFoundCell(null);
      }

      if (!signer) return;
      setIsScanningCells(true);
      try {
        const { script: lock } = await signer.getRecommendedAddressObj();
        const typeIdScript = await ccc.Script.fromKnownScript(
          signer.client,
          ccc.KnownScript.TypeId,
          "",
        );
        iterator = signer.client.findCells(
          {
            script: typeIdScript,
            scriptType: "type",
            scriptSearchMode: "prefix",
            withData: true,
            filter: { script: lock },
          },
          "desc",
          TYPE_ID_PAGE_SIZE + 1,
        );
        cellIteratorRef.current = iterator;
        const cells = await takeCells(iterator, TYPE_ID_PAGE_SIZE + 1);
        const page = await prepareCellPage(
          signer.client,
          cells.slice(0, TYPE_ID_PAGE_SIZE),
        );
        if (cancelled || scanGenerationRef.current !== generation) return;
        setCellCreationTimestamps(page.timestamps);
        setTypeIdCells(page.cells);
        setBufferedTypeIdCell(cells[TYPE_ID_PAGE_SIZE] ?? null);
        setHasMoreTypeIdCells(cells.length > TYPE_ID_PAGE_SIZE);
      } catch (err) {
        if (cancelled || scanGenerationRef.current !== generation) return;
        const msg = err instanceof Error ? err.message : String(err);
        setCellScanError(`Failed to load Type ID cells: ${msg}`);
      } finally {
        if (!cancelled && scanGenerationRef.current === generation) {
          setIsScanningCells(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (cellIteratorRef.current === iterator) {
        cellIteratorRef.current = null;
      }
      if (iterator) void iterator.return(undefined);
    };
  }, [signer, refreshTrigger]);

  const loadMoreTypeIdCells = useCallback(async () => {
    if (
      !signer ||
      !cellIteratorRef.current ||
      !bufferedTypeIdCell ||
      !hasMoreTypeIdCells ||
      isLoadingMoreCells
    ) {
      return;
    }

    setIsLoadingMoreCells(true);
    setCellScanError("");
    const generation = scanGenerationRef.current;
    const iterator = cellIteratorRef.current;
    try {
      const cells = await takeCells(iterator, TYPE_ID_PAGE_SIZE);
      const candidates = [bufferedTypeIdCell, ...cells];
      const page = await prepareCellPage(
        signer.client,
        candidates.slice(0, TYPE_ID_PAGE_SIZE),
      );
      if (scanGenerationRef.current !== generation) return;
      setTypeIdCells((current) => [...current, ...page.cells]);
      setCellCreationTimestamps((current) => ({
        ...current,
        ...page.timestamps,
      }));
      setBufferedTypeIdCell(candidates[TYPE_ID_PAGE_SIZE] ?? null);
      setHasMoreTypeIdCells(candidates.length > TYPE_ID_PAGE_SIZE);
    } catch (err) {
      if (scanGenerationRef.current !== generation) return;
      const msg = err instanceof Error ? err.message : String(err);
      setCellScanError(`Failed to load more Type ID cells: ${msg}`);
    } finally {
      if (scanGenerationRef.current === generation) {
        setIsLoadingMoreCells(false);
      }
    }
  }, [signer, bufferedTypeIdCell, hasMoreTypeIdCells, isLoadingMoreCells]);

  const handleSelectTypeIdCell = useCallback((cell: ccc.Cell) => {
    setTypeIdArgs(cell.cellOutput.type?.args || "");
    setFoundCell(cell);
  }, []);

  const clearSelection = useCallback(() => {
    setTypeIdArgs("");
    setFoundCell(null);
  }, []);

  return {
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
  };
}
