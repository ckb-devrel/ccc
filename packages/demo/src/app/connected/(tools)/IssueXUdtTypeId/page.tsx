"use client";

import { Button } from "@/src/components/Button";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { TextInput } from "@/src/components/Input";
import { Message } from "@/src/components/Message";
import { useApp } from "@/src/context";
import { tokenInfoToBytes, useGetExplorerLink } from "@/src/utils";
import { ccc } from "@ckb-ccc/connector-react";
import Link from "next/link";
import { useState } from "react";

export default function IssueXUdtTypeId() {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("Issue xUDT (Type ID)");

  const { explorerTransaction } = useGetExplorerLink();

  const [typeIdArgs, setTypeIdArgs] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [decimals, setDecimals] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [symbol, setSymbol] = useState<string>("");

  return (
    <>
      <div className="flex w-full flex-col items-stretch">
        <Message title="Hint" type="info">
          You will need to sign two or three transactions.
          <br />
          Learn more on{" "}
          <Link
            className="underline"
            href="https://talk.nervos.org/t/en-cn-misc-single-use-seals/8279"
            target="_blank"
          >
            [EN/CN] Misc: Single-Use-Seals - 杂谈：一次性密封
          </Link>
        </Message>
        <TextInput
          label="Type ID(options)"
          placeholder="Type ID args, empty to create new"
          state={[typeIdArgs, setTypeIdArgs]}
        />
        <TextInput
          label="Amount"
          placeholder="Amount to issue"
          state={[amount, setAmount]}
        />
        <TextInput
          label="Decimals"
          placeholder="Decimals of the token"
          state={[decimals, setDecimals]}
        />
        <TextInput
          label="Symbol"
          placeholder="Symbol of the token"
          state={[symbol, setSymbol]}
        />
        <TextInput
          label="Name (options)"
          placeholder="Name of the token, same as symbol if empty"
          state={[name, setName]}
        />
        <ButtonsPanel>
          <Button
            className="self-center"
            onClick={async () => {
              if (!signer) {
                return;
              }
              const { script } = await signer.getRecommendedAddressObj();
              if (decimals === "" || symbol === "") {
                error("Invalid token info");
                return;
              }

              const typeId = await (async () => {
                if (typeIdArgs !== "") {
                  return ccc.Script.fromKnownScript(
                    signer.client,
                    ccc.KnownScript.TypeId,
                    typeIdArgs,
                  );
                }
                const typeIdTx = ccc.Transaction.from({
                  outputs: [
                    {
                      lock: script,
                      type: await ccc.Script.fromKnownScript(
                        signer.client,
                        ccc.KnownScript.TypeId,
                        "00".repeat(32),
                      ),
                    },
                  ],
                });
                await typeIdTx.completeInputsByCapacity(signer);
                if (!typeIdTx.outputs[0].type) {
                  error("Unexpected disappeared output");
                  return;
                }
                typeIdTx.outputs[0].type.args = ccc.hashTypeId(
                  typeIdTx.inputs[0],
                  0,
                );
                await typeIdTx.completeFeeBy(signer);
                log(
                  "Transaction sent:",
                  explorerTransaction(await signer.sendTransaction(typeIdTx)),
                );
                log("Type ID created: ", typeIdTx.outputs[0].type.args);
                return typeIdTx.outputs[0].type;
              })();
              if (!typeId) {
                return;
              }

              const outputTypeLock = await ccc.Script.fromKnownScript(
                signer.client,
                ccc.KnownScript.OutputTypeProxyLock,
                typeId.hash(),
              );
              const lockTx = ccc.Transaction.from({
                outputs: [
                  // Owner cell
                  {
                    lock: outputTypeLock,
                  },
                ],
              });
              await lockTx.completeInputsByCapacity(signer);
              await lockTx.completeFeeBy(signer);
              const lockTxHash = await signer.sendTransaction(lockTx);
              log("Transaction sent:", explorerTransaction(lockTxHash));

              const typeIdCell =
                await signer.client.findSingletonCellByType(typeId);
              if (!typeIdCell) {
                error("Type ID cell not found");
                return;
              }
              const mintTx = ccc.Transaction.from({
                inputs: [
                  // Type ID
                  {
                    previousOutput: typeIdCell.outPoint,
                  },
                  // Owner cell
                  {
                    previousOutput: {
                      txHash: lockTxHash,
                      index: 0,
                    },
                  },
                ],
                outputs: [
                  // Keep the Type ID cell
                  typeIdCell.cellOutput,
                  // Issued xUDT
                  {
                    lock: script,
                    type: await ccc.Script.fromKnownScript(
                      signer.client,
                      ccc.KnownScript.XUdt,
                      outputTypeLock.hash(),
                    ),
                  },
                  // xUDT Info
                  {
                    lock: script,
                    type: await ccc.Script.fromKnownScript(
                      signer.client,
                      ccc.KnownScript.UniqueType,
                      "00".repeat(32),
                    ),
                  },
                ],
                outputsData: [
                  typeIdCell.outputData,
                  ccc.numLeToBytes(amount, 16),
                  tokenInfoToBytes(decimals, symbol, name),
                ],
              });
              await mintTx.addCellDepsOfKnownScripts(
                signer.client,
                ccc.KnownScript.OutputTypeProxyLock,
                ccc.KnownScript.XUdt,
                ccc.KnownScript.UniqueType,
              );
              await mintTx.completeInputsByCapacity(signer);
              if (!mintTx.outputs[2].type) {
                throw new Error("Unexpected disappeared output");
              }
              mintTx.outputs[2].type!.args = ccc.hexFrom(
                ccc.bytesFrom(ccc.hashTypeId(mintTx.inputs[0], 2)).slice(0, 20),
              );
              await mintTx.completeFeeBy(signer);
              const mintTxHash = await signer.sendTransaction(mintTx);
              log("Transaction sent:", explorerTransaction(mintTxHash));
              await signer.client.waitTransaction(mintTxHash);
              log("Transaction committed:", explorerTransaction(mintTxHash));
            }}
          >
            Issue
          </Button>
        </ButtonsPanel>
      </div>
    </>
  );
}
