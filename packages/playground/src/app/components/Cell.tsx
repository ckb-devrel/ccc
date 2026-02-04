import { ccc } from "@ckb-ccc/connector-react";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../context";
import {
  formatString,
  formatTimestamp,
  getScriptBagua,
  getScriptColor,
  useGetExplorerLink,
} from "../utils";
import { Address } from "./Address";
import { Bagua, Taiji } from "./Bagua";

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
        <span className="text-3xl font-bold break-all">{l}</span>
        <span className="text-xs break-all">
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
      <span className="text-3xl font-bold break-all">{l}</span>
      <span className="-mt-1 text-xs break-all">.{r}</span>
      <span className="text-xs break-all">
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

    const total = ccc.numMax(cellOutput.capacity, 1);
    const freeSize =
      total -
      ccc.fixedPointFrom(
        cellOutput.occupiedSize + ccc.bytesFrom(outputData).length,
      );

    return ccc.fixedPointToString((freeSize * ccc.numFrom(7500)) / total, 2);
  }, [cellOutput, outputData]);

  const outputLength = useMemo(() => {
    if (!outputData) {
      return 0;
    }

    return ccc.bytesFrom(outputData).length;
  }, [outputData]);

  const lockColor = useMemo(
    () => getScriptColor(cellOutput?.lock),
    [cellOutput],
  );
  const typeColor = useMemo(
    () => getScriptColor(cellOutput?.type),
    [cellOutput],
  );

  return (
    <div
      className="relative flex h-32 w-32 cursor-pointer flex-col items-center justify-center rounded-full"
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
      <Bagua
        value={getScriptBagua(cellOutput?.lock)}
        thickness={3.2}
        padding={1}
        space={3}
        margin={2}
        fill={lockColor}
        stroke="#000000a0"
        className="absolute top-1/2 left-1/2 h-33 w-33 -translate-x-1/2 -translate-y-1/2"
      />
      <Bagua
        value={getScriptBagua(cellOutput?.type)}
        thickness={6}
        padding={1}
        space={3}
        margin={3}
        fill={typeColor}
        stroke="#000000a0"
        className="absolute top-1/2 left-1/2 h-22 w-22 -translate-x-1/2 -translate-y-1/2"
      />
      <Taiji
        className="absolute top-1/2 left-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 animate-spin overflow-hidden rounded-full"
        style={{ animationDuration: "16s" }}
        yangColor={lockColor}
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: `${freePercentage}%`,
            height: `${freePercentage}%`,
            backgroundColor: typeColor,
          }}
        ></div>
      </Taiji>
      <div className="relative flex flex-col items-center">
        <Capacity capacity={cellOutput?.capacity} profit={daoProfit} />
      </div>
      {previousOutput ? (
        <div className="relative text-xs">
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
    </div>
  );
}
