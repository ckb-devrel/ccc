import { ccc } from "@ckb-ccc/connector-react";
import { useEffect, useState } from "react";
import { getExplorerLink, getScriptColor } from "../utils";
import { Address } from "./Address";
import { CellCapacity } from "./CellCapacity";
import { CellFingerprint } from "./CellFingerprint";

type CellLike = {
  cellOutput?: ccc.CellOutput;
  outPoint?: ccc.OutPoint;
  previousOutput?: ccc.OutPoint;
  outputData?: ccc.Hex;
};

type ResolvedCell = {
  cellOutput?: ccc.CellOutput;
  outputData?: ccc.Hex;
  extra?: ccc.Num;
  error?: string;
};

function useResolvedCell(cell: CellLike, client: ccc.Client): ResolvedCell {
  const [resolved, setResolved] = useState<{
    cell: CellLike;
    client: ccc.Client;
    value: ResolvedCell;
  }>();
  useEffect(() => {
    let active = true;
    const outPoint = cell.previousOutput ?? cell.outPoint;
    if (!outPoint) {
      return;
    }
    const input = ccc.CellInput.from({ ...cell, previousOutput: outPoint });
    void (async () => {
      try {
        const { cellOutput, outputData } = await input.getCell(client);
        // Keep resolved cell data useful even if DAO accounting fails.
        if (active) {
          setResolved({ cell, client, value: { cellOutput, outputData } });
        }
        const extra = await input.getExtraCapacity(client);
        if (active) {
          setResolved({
            cell,
            client,
            value: { cellOutput, outputData, extra },
          });
        }
      } catch (error) {
        if (active) {
          setResolved((previous) => ({
            cell,
            client,
            value: {
              ...(previous?.cell === cell && previous.client === client
                ? previous.value
                : cell),
              error: String(error),
            },
          }));
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [cell, client]);
  return resolved?.cell === cell && resolved.client === client
    ? resolved.value
    : {
        cellOutput: cell.cellOutput,
        outputData: cell.outputData,
        extra: cell.outPoint || cell.previousOutput ? undefined : ccc.Zero,
      };
}

function CellDetails({
  cell,
  value,
  client,
}: {
  cell: CellLike;
  value: ResolvedCell;
  client: ccc.Client;
}) {
  const outPoint = cell.previousOutput ?? cell.outPoint;
  const { cellOutput, outputData, extra, error } = value;
  const { explorerTransaction } = getExplorerLink(client.addressPrefix);
  return (
    <div className="cell-detail-body">
      {outPoint && (
        <div className="cell-outpoint">
          {explorerTransaction(
            outPoint.txHash,
            `${outPoint.txHash}:${outPoint.index}`,
          )}
        </div>
      )}
      {error && (
        <p className="result-warning">
          Some cell information could not be resolved. {error}
        </p>
      )}
      <CellCapacity
        capacity={cellOutput?.capacity}
        occupied={
          cellOutput && outputData !== undefined
            ? ccc.fixedPointFrom(
                cellOutput.occupiedSize + ccc.bytesFrom(outputData).length,
              )
            : undefined
        }
        extra={extra}
        hasOutPoint={!!outPoint}
      />
      <dl className="detail-grid">
        <dt>Data</dt>
        <dd>{outputData ?? "Unknown"}</dd>
        <dt>Lock script</dt>
        <dd>
          {cellOutput ? (
            <Address
              address={ccc.Address.fromScript(cellOutput.lock, client)}
            />
          ) : (
            "Unknown"
          )}
        </dd>
        <dt>Type script</dt>
        <dd>
          {cellOutput?.type ? (
            <Address
              address={ccc.Address.fromScript(cellOutput.type, client)}
            />
          ) : cellOutput ? (
            "None"
          ) : (
            "Unknown"
          )}
        </dd>
      </dl>
    </div>
  );
}

export function CellInfo({
  cell,
  client,
}: {
  cell: CellLike;
  client: ccc.Client;
}) {
  const value = useResolvedCell(cell, client);
  return (
    <div className="cell-card">
      <CellDetails cell={cell} value={value} client={client} />
    </div>
  );
}

export function Cell({
  cell,
  client,
  index,
  kind,
  onInspect,
  selected = false,
  inspectorId,
}: {
  cell: CellLike;
  client: ccc.Client;
  index?: number;
  kind?: "Input" | "Output";
  onInspect?: (trigger: HTMLButtonElement) => void;
  selected?: boolean;
  inspectorId?: string;
}) {
  const value = useResolvedCell(cell, client);
  const { cellOutput, outputData, extra } = value;
  const summaryContent = (
    <>
      <span className="cell-summary-copy">
        <span className="cell-index">
          {kind ?? "Cell"}
          {index === undefined ? "" : ` ${index}`}
        </span>
        <span className="cell-capacity">
          {cellOutput ? ccc.fixedPointToString(cellOutput.capacity) : "Unknown"}{" "}
          <small>CKB</small>
        </span>
        <span className="cell-meta">
          <span>
            {cellOutput
              ? cellOutput.type
                ? "Typed cell"
                : "Plain cell"
              : "Unresolved cell"}
          </span>
          <span>
            {outputData === undefined
              ? "Data unknown"
              : `${ccc.bytesFrom(outputData).length} bytes`}
          </span>
        </span>
        {extra !== undefined && extra !== ccc.Zero && (
          <span className="cell-extra">
            + {ccc.fixedPointToString(extra)} CKB DAO extra
          </span>
        )}
        <span className="cell-inspect">
          {onInspect ? (
            selected ? (
              "Close details"
            ) : (
              "Inspect cell"
            )
          ) : (
            <>
              <span className="cell-inspect-closed">Inspect cell</span>
              <span className="cell-inspect-open">Close details</span>
            </>
          )}
        </span>
      </span>
      <CellFingerprint lock={cellOutput?.lock} type={cellOutput?.type} />
    </>
  );
  if (onInspect) {
    return (
      <button
        type="button"
        className="cell-card cell-summary cell-selector"
        data-output-inspect
        style={{ borderLeftColor: getScriptColor(cellOutput?.lock) }}
        aria-expanded={selected}
        aria-controls={inspectorId}
        onClick={(event) => onInspect(event.currentTarget)}
      >
        {summaryContent}
      </button>
    );
  }
  return (
    <details
      className="cell-card"
      style={{ borderLeftColor: getScriptColor(cellOutput?.lock) }}
    >
      <summary className="cell-summary">{summaryContent}</summary>
      <CellDetails cell={cell} value={value} client={client} />
    </details>
  );
}
