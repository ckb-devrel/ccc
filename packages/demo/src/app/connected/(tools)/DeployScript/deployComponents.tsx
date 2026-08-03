"use client";

import { Button } from "@/src/components/Button";
import { Message } from "@/src/components/Message";
import { useGetExplorerLink } from "@/src/utils";
import { ccc } from "@ckb-ccc/connector-react";
import { FileCode, X } from "lucide-react";
import type { DeployResult } from "./deployLogic";

function formatCellCreationDate(timestampMs: number): string {
  try {
    return new Date(timestampMs).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function TypeIdCellListItem({
  cell,
  index,
  onSelect,
  isSelected,
  creationTimestamp,
}: {
  cell: ccc.Cell;
  index: number;
  onSelect: () => void;
  isSelected: boolean;
  creationTimestamp?: number;
}) {
  const outPoint = `${cell.outPoint.txHash}:${cell.outPoint.index}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full flex-col gap-2 rounded-lg border p-4 text-left text-sm transition-colors hover:border-purple-300 hover:bg-purple-50/50 ${
        isSelected
          ? "border-purple-400 bg-purple-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-gray-700">
          <span>#{index + 1}</span>
          <span>Type ID</span>
        </div>
        <span className="text-xs text-gray-600">
          <span className="font-medium">Occupied / Capacity:</span>{" "}
          {ccc.fixedPointToString(ccc.fixedPointFrom(cell.occupiedSize))} /{" "}
          {ccc.fixedPointToString(cell.cellOutput.capacity)} CKB
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span
          className="min-w-0 truncate font-mono text-xs text-gray-600"
          title={outPoint}
        >
          <span className="font-sans font-medium">Out Point:</span> {outPoint}
        </span>
        <span className="shrink-0 text-xs text-gray-500">
          {creationTimestamp == null
            ? "Unavailable"
            : formatCellCreationDate(creationTimestamp)}
        </span>
      </div>
    </button>
  );
}

export function CellFoundSection({
  foundCell,
  onClear,
}: {
  foundCell: ccc.Cell;
  onClear: () => void;
}) {
  const { explorerTransaction } = useGetExplorerLink();
  const typeScript = foundCell.cellOutput.type;
  const typeId = typeScript?.args;

  return (
    <div>
      <div className="flex items-center justify-between text-gray-800">
        <div className="flex items-center gap-2">
          <FileCode className="h-5 w-5 text-purple-500" />
          <p className="font-semibold">Cell to Update</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-full p-1 text-gray-400 transition-colors hover:text-gray-700"
          aria-label="Clear selected cell"
          title="Clear selection"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-3 space-y-1 text-sm text-gray-700">
        <p>
          <span className="font-medium">Out Point:</span>{" "}
          {explorerTransaction(
            foundCell.outPoint.txHash,
            `${foundCell.outPoint.txHash}:${foundCell.outPoint.index}`,
          )}
        </p>
        <p>
          <span className="font-medium">Occupied / Capacity:</span>{" "}
          {ccc.fixedPointToString(ccc.fixedPointFrom(foundCell.occupiedSize))} /{" "}
          {ccc.fixedPointToString(foundCell.cellOutput.capacity)} CKB
        </p>
        <p>
          <span className="font-medium">Data Hash:</span>{" "}
          <span className="font-mono break-all">
            {ccc.hashCkb(foundCell.outputData ?? "0x")}
          </span>
        </p>
        {typeScript && (
          <p>
            <span className="font-medium">Type Hash:</span>{" "}
            <span className="font-mono break-all">{typeScript.hash()}</span>
          </p>
        )}
        {typeId && typeId !== "0x" && (
          <p>
            <span className="font-medium">Type ID:</span>{" "}
            <span className="font-mono break-all">{typeId}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export function DeploymentResultSection({
  result,
}: {
  result: DeployResult & {
    immutable: boolean;
    action: "deployed" | "updated";
  };
}) {
  const { explorerTransaction } = useGetExplorerLink();
  const outPoint = `${result.txHash}:0`;

  return (
    <Message
      title={`Cell ${result.action === "deployed" ? "Deployed" : "Updated"}`}
      type="success"
      expandable={false}
    >
      <div className="space-y-1 text-sm text-gray-700">
        <p>
          <span className="font-medium">Out Point:</span>{" "}
          {explorerTransaction(result.txHash, outPoint)}
        </p>
        <p>
          <span className="font-medium">Type ID:</span>{" "}
          <span className="font-mono break-all">{result.typeId}</span>
        </p>
        <p>
          <span className="font-medium">Data Hash:</span>{" "}
          <span className="font-mono break-all">{result.dataHash}</span>
        </p>
        {result.immutable && (
          <p className="text-green-700">
            This cell is immutable and can never be updated.
          </p>
        )}
      </div>
    </Message>
  );
}

export function BurnButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="danger"
      className="ml-2"
      onClick={onClick}
      disabled={disabled}
    >
      Burn
    </Button>
  );
}
