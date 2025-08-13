import { Button } from "@/src/components/Button";
import { ccc } from "@ckb-ccc/connector-react";
import JsonView from "@uiw/react-json-view";
import { darkTheme } from "@uiw/react-json-view/dark";
import { ReactNode } from "react";
import { MethodParam, ParamValue } from "../types";

interface TransactionSkeletonPanelProps {
  transactionResult: ccc.Transaction;
  setTransactionResult: (tx: ccc.Transaction) => void;
  signer?: ccc.Signer;
  methodParams: MethodParam[];
  paramValues: Record<string, ParamValue>;
  contractOutPointTx: string;
  contractOutPointIndex: string;
  log: (message: string, ...args: ReactNode[]) => void;
}

export function TransactionSkeletonPanel({
  transactionResult,
  setTransactionResult,
  signer,
  methodParams,
  paramValues,
  contractOutPointTx,
  contractOutPointIndex,
  log,
}: TransactionSkeletonPanelProps) {
  return (
    <div className="mt-4">
      <label className="text-medium block font-bold text-gray-700">
        Transaction Skeleton (Advanced Feature, Use only if you know what you
        are doing with caution and only on Testnet)
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={async () => {
            if (!signer) return;
            const newTransactionResult = transactionResult.clone();
            await newTransactionResult.completeInputsAtLeastOne(signer);
            setTransactionResult(newTransactionResult);
          }}
        >
          completeInputsAtLeastOne
        </Button>
        <Button
          onClick={async () => {
            if (!signer) {
              alert("No signer found");
              return;
            }
            const newTransactionResult = transactionResult.clone();
            let udtScript: ccc.ScriptLike | undefined;
            for (let index = 0; index < methodParams.length; index++) {
              const param = methodParams[index];
              if (param.type === "contextScript") {
                udtScript = paramValues[`Parameter${index}`] as ccc.ScriptLike;
              }
            }
            if (!udtScript) {
              alert("No UDT script found from contextScript parameter");
              return;
            }
            await newTransactionResult.completeInputsByUdt(signer, udtScript);
            const balanceDiff =
              (await newTransactionResult.getInputsUdtBalance(
                signer.client,
                udtScript,
              )) - newTransactionResult.getOutputsUdtBalance(udtScript);
            const { script: changeScript } =
              await signer.getRecommendedAddressObj();
            if (balanceDiff > ccc.Zero) {
              newTransactionResult.addOutput(
                {
                  lock: changeScript,
                  type: udtScript,
                },
                ccc.numLeToBytes(balanceDiff, 16),
              );
            }
            setTransactionResult(newTransactionResult);
          }}
        >
          completeInputsByUdt and complete UDT change
        </Button>
        <Button
          onClick={async () => {
            if (!signer) {
              alert("No signer found");
              return;
            }
            const newTransactionResult = transactionResult.clone();
            await newTransactionResult.completeInputsByCapacity(signer);
            setTransactionResult(newTransactionResult);
          }}
        >
          completeInputsByCapacity
        </Button>
        <Button
          onClick={async () => {
            if (!signer) {
              alert("No signer found");
              return;
            }
            const newTransactionResult = transactionResult.clone();
            newTransactionResult.addCellDeps({
              outPoint: {
                txHash: contractOutPointTx,
                index: contractOutPointIndex,
              },
              depType: "code",
            });
            setTransactionResult(newTransactionResult);
          }}
        >
          Add Cell Dep
        </Button>
        <Button
          onClick={async () => {
            if (!signer) {
              alert("No signer found");
              return;
            }
            const newTransactionResult = transactionResult.clone();
            await newTransactionResult.completeFeeBy(signer);
            setTransactionResult(newTransactionResult);
          }}
        >
          completeFeeBy
        </Button>
        <Button
          onClick={async () => {
            if (!signer) {
              alert("No signer found");
              return;
            }
            const txHash = await signer.sendTransaction(transactionResult);
            log("Transaction sent with hash:", txHash);
          }}
        >
          Sign and Send Transaction
        </Button>
      </div>
      <JsonView value={transactionResult} style={darkTheme} />
    </div>
  );
}
