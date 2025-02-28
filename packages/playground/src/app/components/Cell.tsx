import { ccc } from "@ckb-ccc/connector-react";
import { formatString, getScriptColor, useGetExplorerLink } from "../utils";
import { useEffect, useMemo, useState } from "react";
import { RandomWalk } from "./RandomWalk";

function Capacity({
  capacity,
  profit,
}: {
  capacity?: ccc.NumLike;
  profit: ccc.NumLike;
}) {
  const profitNum = ccc.numFrom(profit);
  const [l, r] = useMemo(() => {
    if (capacity === undefined) {
      return ["?"];
    }
    return ccc.fixedPointToString(ccc.numFrom(capacity)).split(".");
  }, [capacity]);

  if (!r) {
    return (
      <>
        <span className="break-all text-4xl font-bold">{l}</span>
        <span className="break-all text-sm">
          {profitNum === ccc.Zero
            ? ""
            : `+ ${ccc.fixedPointToString(ccc.numFrom(profit))} `}
          CKB
        </span>
      </>
    );
  }

  return (
    <>
      <span className="break-all text-4xl font-bold">{l}</span>
      <span className="break-all text-sm">.{r}</span>
      <span className="break-all text-sm">
        {profitNum === ccc.Zero
          ? ""
          : `+ ${ccc.fixedPointToString(ccc.numFrom(profit))} `}
        CKB
      </span>
    </>
  );
}

export function Cell({
  cell,
}: {
  cell: {
    cellOutput?: ccc.CellOutput;
    previousOutput?: ccc.OutPoint;
    outputData?: ccc.Hex;
  };
}) {
  const { explorerTransaction } = useGetExplorerLink();
  const { client } = ccc.useCcc();

  const { previousOutput } = cell;
  const [cellOutput, setCellOutput] = useState(cell.cellOutput);
  const [outputData, setOutputData] = useState(cell.outputData);
  const [daoProfit, setDaoProfit] = useState(ccc.Zero);

  useEffect(() => {
    if (!previousOutput) {
      return;
    }

    const input = ccc.CellInput.from({
      ...cell,
      previousOutput, // For type checking
    });

    (async () => {
      try {
        const { cellOutput, outputData } = await input.getCell(client);
        const extraCapacity = await input.getExtraCapacity(client);

        setCellOutput(cellOutput);
        setOutputData(outputData);
        setDaoProfit(extraCapacity);
      } catch (err) {
        return;
      }
    })();
  }, [cell, previousOutput, cell.cellOutput, cell.outputData, client]);

  const freePercentage = useMemo(() => {
    if (!cellOutput || !outputData) {
      return 0;
    }

    const total = cellOutput.capacity;
    const freeSize =
      total -
      ccc.fixedPointFrom(
        cellOutput.occupiedSize + ccc.bytesFrom(outputData).length,
      );
    const free = (freeSize * ccc.numFrom(10000)) / total;

    return ccc.fixedPointToString(
      free >= ccc.numFrom(9500) ? ccc.numFrom(9500) : free,
      2,
    );
  }, [cellOutput, outputData]);

  const outputLength = useMemo(() => {
    if (!outputData) {
      return 0;
    }

    return ccc.bytesFrom(outputData).length;
  }, [outputData]);

  const lockColor = useMemo(
    () => (cellOutput ? getScriptColor(cellOutput.lock) : "#1f2937"),
    [cellOutput],
  );
  const typeColor = useMemo(
    () => (cellOutput?.type ? getScriptColor(cellOutput.type) : "#1f2937"),
    [cellOutput],
  );

  return (
    <RandomWalk
      className="relative flex h-40 w-40 flex-col items-center justify-center rounded-full border border-fuchsia-900 shadow-md"
      style={{
        backgroundColor: lockColor,
      }}
    >
      <div
        className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-gray-800"
        style={{
          borderWidth: "2rem",
          borderColor: typeColor,
        }}
      >
        <div
          className="absolute left-1/2 h-20 w-20 -translate-x-1/2 bg-white"
          style={{
            backgroundColor: lockColor,
            top: `${freePercentage}%`,
          }}
        ></div>
      </div>
      <div className="relative flex flex-col items-center">
        <Capacity capacity={cellOutput?.capacity} profit={daoProfit} />
      </div>
      {previousOutput ? (
        <div className="relative">
          {explorerTransaction(
            previousOutput.txHash,
            `${formatString(
              previousOutput.txHash,
              5,
              3,
            )}:${previousOutput.index.toString()}`,
          )}
        </div>
      ) : undefined}
      {outputLength ? (
        <div className="relative flex justify-center text-sm">
          {outputLength} bytes
        </div>
      ) : undefined}
    </RandomWalk>
  );
}
