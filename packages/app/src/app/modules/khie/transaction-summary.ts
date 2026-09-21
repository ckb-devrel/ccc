import { ccc } from "@ckb-ccc/connector-react";

export type TransferSummary = {
  /** CKB leaving this wallet, grouped by recipient lock. */
  outgoing: { lock: ccc.Script; capacity: ccc.Num }[];
  /** Own outputs minus own inputs; undefined while any input is unresolved. */
  netChange?: ccc.Num;
  /** Capacity contributed by inputs that do not belong to this wallet. */
  otherParticipantsInputCapacity: ccc.Num;
  /** Any cell carries a type script or output data, so capacity alone does not describe the transaction. */
  involvesSpecialData: boolean;
};

export function summarizeTransfer(
  inputs: {
    cellOutput?: ccc.CellOutput;
    extraCapacity?: ccc.Num;
    outputData?: string;
  }[],
  outputs: ccc.CellOutput[],
  ownLocks: ccc.Script[],
  outputsData: string[] = [],
): TransferSummary {
  const own = (lock: ccc.Script) => ownLocks.some((item) => item.eq(lock));
  let netChange: ccc.Num | undefined = ccc.Zero;
  let otherParticipantsInputCapacity = ccc.Zero;
  for (const { cellOutput, extraCapacity } of inputs) {
    if (!cellOutput) {
      netChange = undefined;
    } else {
      const capacity = cellOutput.capacity + (extraCapacity ?? ccc.Zero);
      if (own(cellOutput.lock)) {
        if (netChange !== undefined) {
          netChange -= capacity;
        }
      } else {
        otherParticipantsInputCapacity += capacity;
      }
    }
  }
  const outgoing = new Map<string, { lock: ccc.Script; capacity: ccc.Num }>();
  for (const output of outputs) {
    if (own(output.lock)) {
      if (netChange !== undefined) {
        netChange += output.capacity;
      }
      continue;
    }
    const key = output.lock.hash();
    outgoing.set(key, {
      lock: output.lock,
      capacity: (outgoing.get(key)?.capacity ?? ccc.Zero) + output.capacity,
    });
  }
  const hasOutputData = (data: string | undefined) =>
    data !== undefined && data !== "0x";
  const involvesSpecialData =
    [...inputs.map(({ cellOutput }) => cellOutput), ...outputs].some(
      (cell) => cell?.type,
    ) ||
    inputs.some(({ outputData }) => hasOutputData(outputData)) ||
    outputsData.some(hasOutputData);

  return {
    involvesSpecialData,
    netChange,
    otherParticipantsInputCapacity,
    outgoing: [...outgoing.values()],
  };
}
