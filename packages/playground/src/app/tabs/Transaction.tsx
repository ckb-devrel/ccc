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
  useEffect(() => {
    (async () => {
      const inputAmount = await tx?.getInputsCapacity(client);
      setInputAmount(inputAmount ?? ccc.Zero);
    })();
  }, [tx, client]);
  const outputAmount = useMemo(
    () => tx?.getOutputsCapacity() ?? ccc.Zero,
    [tx]
  );

  const inputs = useMemo(
    () => tx?.inputs.map((input, i) => <Cell cell={input} key={i} />),
    [tx]
  );
  const outputs = useMemo(
    () =>
      tx?.outputs.map((cellOutput, i) => (
        <Cell cell={{ cellOutput, outputData: tx.outputsData[i] }} key={i} />
      )),
    [tx]
  );

  if (!tx) {
    return (
      <div
        ref={innerRef}
        className="flex flex-col grow justify-center items-center"
      >
        <button className="p-6 rounded-full bg-green-400 mb-4" onClick={onRun}>
          <Play size="32" />
        </button>
        <p className="text-lg">Run code to generate transaction</p>
      </div>
    );
  }

  return (
    <div
      ref={innerRef}
      className={`flex flex-col grow ${disableScroll ? "" : "overflow-hidden"}`}
    >
      <div
        className={`flex flex-col basis-1/2 ${
          disableScroll ? "" : "overflow-y-hidden"
        }`}
      >
        <div className="p-3 pb-0">
          Inputs ({ccc.fixedPointToString(inputAmount)} CKB)
        </div>
        <div className={`${disableScroll ? "" : "overflow-y-auto"} p-3 grow`}>
          <div className="flex gap-2 flex-wrap justify-center">{inputs}</div>
        </div>
      </div>

      <div
        className={`flex flex-col border-t border-fuchsia-900 basis-1/2 ${
          disableScroll ? "" : "overflow-y-hidden"
        }`}
      >
        <div className="p-3 pb-0">
          Outputs ({ccc.fixedPointToString(outputAmount)} +{" "}
          {outputAmount > inputAmount
            ? "?"
            : ccc.fixedPointToString(inputAmount - outputAmount)}{" "}
          CKB)
        </div>
        <div className={`${disableScroll ? "" : "overflow-y-auto"} p-3 grow`}>
          <div className="flex gap-2 flex-wrap justify-center">{outputs}</div>
        </div>
      </div>
    </div>
  );
}
