import { ccc } from "@ckb-ccc/connector-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "./Button";
import { Cell } from "./Cell";

export function Transaction({
  tx,
  client,
  isDefaultOpen,
}: {
  tx: ccc.Transaction;
  client: ccc.Client;
  isDefaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState<boolean | undefined>();

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
  const txHash = useMemo(() => tx.hash(), [tx]);

  if (!(isOpen ?? isDefaultOpen ?? true)) {
    return (
      <div
        className="flex grow cursor-pointer flex-col items-center rounded-md bg-gray-400/25 py-4"
        onClick={() => setIsOpen(true)}
      >
        Show transaction {txHash.substring(0, 8)}...
        {txHash.substring(txHash.length - 6)}
      </div>
    );
  }

  return (
    <div className="flex grow flex-col">
      <div className="flex flex-col items-center">
        <span>Transaction</span>
        <span>{txHash}</span>
      </div>

      <div className="flex basis-1/2 flex-col">
        <div className="p-3 pb-0">
          Inputs ({ccc.fixedPointToString(inputAmount - inputAmountExtra)}
          {inputAmountExtra === ccc.Zero
            ? " "
            : ` + ${ccc.fixedPointToString(inputAmountExtra)} `}
          CKB)
        </div>
        <div className="grow p-5">
          <div className="flex flex-wrap justify-center gap-4">{inputs}</div>
        </div>
      </div>

      <div className="flex basis-1/2 flex-col border-t border-neutral-400/50">
        <div className="p-3 pb-0">
          Outputs ({ccc.fixedPointToString(outputAmount)} +
          {outputAmount > inputAmount
            ? " ? "
            : ` ${ccc.fixedPointToString(inputAmount - outputAmount)} `}
          CKB)
        </div>
        <div className="grow p-5">
          <div className="flex flex-wrap justify-center gap-4">{outputs}</div>
        </div>
      </div>

      <div className="flex justify-center">
        <Button onClick={() => setIsOpen(false)} className="my-2 rounded-sm">
          Hide
        </Button>
      </div>
    </div>
  );
}
