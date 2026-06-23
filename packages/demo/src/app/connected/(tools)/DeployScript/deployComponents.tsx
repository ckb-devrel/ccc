"use client";

import { formatFileSize } from "@/src/app/utils/(tools)/FileUpload/page";
import { BigButton } from "@/src/components/BigButton";
import { Button } from "@/src/components/Button";
import { Message } from "@/src/components/Message";
import { formatString, useGetExplorerLink } from "@/src/utils";
import { ccc } from "@ckb-ccc/connector-react";
import { Loader2 } from "lucide-react";
import { typeIdArgsToFourLines } from "./helpers";

function formatCellCreationDate(timestampMs: number): string {
  try {
    return new Date(timestampMs).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function TypeIdCellButton({
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
  const typeIdArgs = cell.cellOutput.type?.args || "";
  const dataSize = cell.outputData ? ccc.bytesFrom(cell.outputData).length : 0;
  const fourLines = typeIdArgsToFourLines(typeIdArgs.slice(2));

  return (
    <BigButton
      key={ccc.hexFrom(cell.outPoint.toBytes())}
      size="sm"
      iconName="FileCode"
      onClick={onSelect}
      className={isSelected ? "border-2 border-purple-500 bg-purple-50" : ""}
    >
      <div className="text-md flex w-full min-w-0 flex-col">
        <span className="shrink-0 text-xs font-medium text-gray-500">
          #{index + 1}
        </span>
        {creationTimestamp != null && (
          <span className="mt-0.5 shrink-0 text-[10px] font-normal text-gray-400">
            {formatCellCreationDate(creationTimestamp)}
          </span>
        )}
        <div className="mt-1 flex w-full min-w-0 flex-col font-mono text-[10px]">
          {fourLines.map((line, i) => (
            <span key={i} className="truncate">
              {line}
            </span>
          ))}
        </div>
        <span className="mt-2 shrink-0 truncate text-xs text-gray-500">
          {formatFileSize(dataSize)}
        </span>
      </div>
    </BigButton>
  );
}

export function LoadingMessage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Message title={title} type="info">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
        <span>{children}</span>
      </div>
    </Message>
  );
}

export function CellFoundSection({
  foundCell,
  foundCellAddress,
  isAddressMatch,
  userAddress,
}: {
  foundCell: ccc.Cell;
  foundCellAddress: string;
  isAddressMatch: boolean | null;
  userAddress: string;
}) {
  const { explorerTransaction, explorerAddress } = useGetExplorerLink();

  return (
    <>
      <Message title="Cell Found" type="success" expandable={false}>
        <div className="space-y-1 text-sm">
          <p>
            <span className="font-medium">Transaction:</span>{" "}
            {explorerTransaction(foundCell.outPoint.txHash)}
          </p>
          <p>
            <span className="font-medium">Index:</span>{" "}
            {foundCell.outPoint.index}
          </p>
          <p>
            <span className="font-medium">Capacity:</span>{" "}
            {ccc.fixedPointToString(foundCell.cellOutput.capacity)} CKB
          </p>
          <p>
            <span className="font-medium">Lock Address:</span>{" "}
            {explorerAddress(
              foundCellAddress,
              formatString(foundCellAddress, 8, 6),
            )}
          </p>
          {foundCell.outputData && (
            <p>
              <span className="font-medium">Data Size:</span>{" "}
              {formatFileSize(ccc.bytesFrom(foundCell.outputData).length)}
            </p>
          )}
        </div>
      </Message>
      {isAddressMatch === false && (
        <Message
          title="Address Mismatch Warning"
          type="error"
          expandable={false}
        >
          <div className="space-y-1 text-sm">
            <p>
              The cell&apos;s lock address does not match your wallet address.
              You will not be able to unlock this cell to update it.
            </p>
            <p className="mt-2">
              <span className="font-medium">Cell Lock:</span>{" "}
              {explorerAddress(
                foundCellAddress,
                formatString(foundCellAddress, 8, 6),
              )}
            </p>
            <p>
              <span className="font-medium">Your Address:</span>{" "}
              {userAddress
                ? explorerAddress(userAddress, formatString(userAddress, 8, 6))
                : "Not connected"}
            </p>
            <p className="mt-2 font-semibold">
              Deployment will fail because you cannot unlock this cell.
            </p>
          </div>
        </Message>
      )}
      {isAddressMatch === true && (
        <Message title="Address Match" type="success" expandable={false}>
          <div className="text-sm">
            The cell&apos;s lock address matches your wallet address. You can
            update this cell.
          </div>
        </Message>
      )}
    </>
  );
}

export function ClearSelectionButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="info" className="mt-2" onClick={onClick}>
      Clear Selection
    </Button>
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
      className="mt-2"
      onClick={onClick}
      disabled={disabled}
    >
      Burn
    </Button>
  );
}
