import { ccc } from "@ckb-ccc/connector-react";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context";
import {
  formatString,
  formatTimestamp,
  getScriptColor,
  useGetExplorerLink,
} from "../utils";
import { Address } from "./Address";
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
        <span className="text-4xl font-bold break-all">{l}</span>
        <span className="text-sm break-all">
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
      <span className="text-4xl font-bold break-all">{l}</span>
      <span className="text-sm break-all">.{r}</span>
      <span className="text-sm break-all">
        {profitNum === ccc.Zero
          ? ""
          : `+ ${ccc.fixedPointToString(ccc.numFrom(profit))} `}
        CKB
      </span>
    </>
  );
}

export function CellInfo({
  cell,
  client,
}: {
  cell: {
    cellOutput?: ccc.CellOutput;
    outPoint?: ccc.OutPoint;
    outputData?: ccc.Hex;
  };
  client: ccc.Client;
}) {
  const { explorerTransaction } = useGetExplorerLink();

  const { outPoint } = cell;
  const [cellOutput, setCellOutput] = useState(cell.cellOutput);
  const [outputData, setOutputData] = useState(cell.outputData);
  const [daoProfit, setDaoProfit] = useState(ccc.Zero);

  useEffect(() => {
    if (!outPoint) {
      return;
    }

    const input = ccc.CellInput.from({
      ...cell,
      previousOutput: outPoint, // For type checking
    });

    (async () => {
      try {
        const { cellOutput, outputData } = await input.getCell(client);
        const extraCapacity = await input.getExtraCapacity(client);

        setCellOutput(cellOutput);
        setOutputData(outputData);
        setDaoProfit(extraCapacity);
      } catch (_err) {
        return;
      }
    })();
  }, [cell, outPoint, cell.cellOutput, cell.outputData, client]);

  return (
    <div>
      {outPoint
        ? explorerTransaction(
            outPoint?.txHash,
            `${outPoint?.txHash}:${outPoint?.index}`,
          )
        : undefined}
      <div className="my-1">
        Capacity {ccc.apply(ccc.fixedPointToString, cellOutput?.capacity)}
        {daoProfit !== ccc.Zero
          ? ` + ${ccc.fixedPointToString(daoProfit)} `
          : " "}
        CKB
      </div>
      <div className="mt-1">Lock</div>
      {cellOutput?.lock ? (
        <Address address={ccc.Address.fromScript(cellOutput.lock, client)} />
      ) : undefined}
      {cellOutput?.type ? (
        <>
          <div className="mt-1">Type</div>
          <Address address={ccc.Address.fromScript(cellOutput.type, client)} />
        </>
      ) : (
        <div className="mt-1">Type is Empty</div>
      )}
      {outputData ? <div className="my-1">Data: {outputData}</div> : undefined}
    </div>
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

  const { sendMessage } = useApp();

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
      } catch (_err) {
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
      className="relative flex h-40 w-40 cursor-pointer flex-col items-center justify-center rounded-full border border-fuchsia-900 shadow-md"
      style={{
        backgroundColor: lockColor,
      }}
      onClick={() => {
        sendMessage("info", formatTimestamp(Date.now()), [
          <CellInfo
            key="0"
            cell={{ outPoint: previousOutput, outputData, cellOutput }}
            client={client}
          />,
        ]);
      }}
    >
      <div
        className="absolute top-1/2 left-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-gray-800"
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
