import { ccc } from "@ckb-ccc/connector-react";
import { formatString, getScriptColor, useGetExplorerLink } from "../utils";
import { useMemo } from "react";
import { RandomWalk } from "./RandomWalk";

function Capacity({ capacity }: { capacity?: ccc.NumLike }) {
  const [l, r] = useMemo(() => {
    if (capacity === undefined) {
      return ["?"];
    }
    return ccc.fixedPointToString(ccc.numFrom(capacity)).split(".");
  }, [capacity]);

  if (!r) {
    return (
      <>
        <span className="text-4xl break-all font-bold">{l}</span>
        <span className="text-sm break-all">CKB</span>
      </>
    );
  }

  return (
    <>
      <span className="text-4xl break-all font-bold">{l}</span>
      <span className="text-sm break-all">.{r} CKB</span>
    </>
  );
}

export function Cell({
  cell: { cellOutput, previousOutput, outputData },
}: {
  cell: {
    cellOutput?: ccc.CellOutput;
    previousOutput?: ccc.OutPoint;
    outputData?: ccc.Hex;
  };
}) {
  const { explorerTransaction } = useGetExplorerLink();

  const freePercentage = useMemo(() => {
    if (!cellOutput || !outputData) {
      return 0;
    }

    const total = cellOutput.capacity;
    const freeSize =
      total -
      ccc.fixedPointFrom(
        cellOutput.occupiedSize + ccc.bytesFrom(outputData).length
      );
    const free = (freeSize * ccc.numFrom(10000)) / total;

    return ccc.fixedPointToString(
      free >= ccc.numFrom(9500) ? ccc.numFrom(9500) : free,
      2
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
    [cellOutput]
  );
  const typeColor = useMemo(
    () => (cellOutput?.type ? getScriptColor(cellOutput.type) : "#1f2937"),
    [cellOutput]
  );

  return (
    <RandomWalk
      className="relative w-40 h-40 border border-fuchsia-900 rounded-full shadow-md flex flex-col justify-center items-center"
      style={{
        backgroundColor: lockColor,
      }}
    >
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 h-28 w-28 rounded-full overflow-hidden"
        style={{
          borderWidth: "2rem",
          borderColor: typeColor,
        }}
      >
        <div
          className="absolute bg-white left-1/2 -translate-x-1/2 h-20 w-20"
          style={{
            backgroundColor: lockColor,
            top: `${freePercentage}%`,
          }}
        ></div>
      </div>
      <div className="relative flex flex-col items-center">
        <Capacity capacity={cellOutput?.capacity} />
      </div>
      {previousOutput ? (
        <div className="relative">
          {explorerTransaction(
            previousOutput.txHash,
            `${formatString(
              previousOutput.txHash,
              5,
              3
            )}:${previousOutput.index.toString()}`
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
