import { ccc } from "@ckb-ccc/connector-react";
import { MutableRefObject, useEffect, useMemo, useState } from "react";
import { Cell } from "../components/Cell";
import { Play } from "lucide-react";

export function Transaction({
  tx,
  disableScroll,
  onRun,
  innerRef,
}: {
  tx?: ccc.Transaction;
  disableScroll?: boolean;
  onRun?: () => void;
  innerRef?: MutableRefObject<HTMLDivElement | null>;
}) {
  const { client } = ccc.useCcc();

  const [inputAmount, setInputAmount] = useState(ccc.Zero);
  const [inputAmountExtra, setInputAmountExtra] = useState(ccc.Zero);
  useEffect(() => {
    (async () => {
      const amountExtra = await tx?.getInputsCapacityExtra(client);
      const inputAmount = await tx?.getInputsCapacity(client);
      setInputAmountExtra(amountExtra ?? ccc.Zero);
      setInputAmount(inputAmount ?? ccc.Zero);
    })();
  }, [tx, client]);
  const outputAmount = useMemo(
    () => tx?.getOutputsCapacity() ?? ccc.Zero,
    [tx],
  );

  const inputs = useMemo(
    () => tx?.inputs.map((input, i) => <Cell cell={input} key={i} />),
    [tx],
  );
  const outputs = useMemo(
    () =>
      tx?.outputs.map((cellOutput, i) => (
        <Cell cell={{ cellOutput, outputData: tx.outputsData[i] }} key={i} />
      )),
    [tx],
  );

  if (!tx) {
    return (
      <div
        ref={innerRef}
        className="flex grow flex-col items-center justify-center"
      >
        <button className="mb-4 rounded-full bg-green-400 p-6" onClick={onRun}>
          <Play size="32" />
        </button>
        <p className="text-lg">Run code to generate transaction</p>
      </div>
    );
  }

  return (
    <div
      ref={innerRef}
      className={`flex grow flex-col ${disableScroll ? "" : "overflow-hidden"}`}
    >
      <div
        className={`flex basis-1/2 flex-col ${
          disableScroll ? "" : "overflow-y-hidden"
        }`}
      >
        <div className="p-3 pb-0">
          Inputs ({ccc.fixedPointToString(inputAmount - inputAmountExtra)}
          {inputAmountExtra === ccc.Zero
            ? " "
            : ` + ${ccc.fixedPointToString(inputAmountExtra)} `}
          CKB)
        </div>
        <div className={`${disableScroll ? "" : "overflow-y-auto"} grow p-3`}>
          <div className="flex flex-wrap justify-center gap-2">{inputs}</div>
        </div>
      </div>

      <div
        className={`flex basis-1/2 flex-col border-t border-fuchsia-900 ${
          disableScroll ? "" : "overflow-y-hidden"
        }`}
      >
        <div className="p-3 pb-0">
          Outputs ({ccc.fixedPointToString(outputAmount)} +
          {outputAmount > inputAmount
            ? " ?"
            : ` ${ccc.fixedPointToString(inputAmount - outputAmount)} `}
          CKB)
        </div>
        <div className={`${disableScroll ? "" : "overflow-y-auto"} grow p-3`}>
          <div className="flex flex-wrap justify-center gap-2">{outputs}</div>
        </div>
      </div>
    </div>
  );
}
