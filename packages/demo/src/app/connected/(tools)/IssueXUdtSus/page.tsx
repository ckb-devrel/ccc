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

export default function IssueXUdtSul() {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("Issue xUDT (SUS)");

  const { explorerTransaction } = useGetExplorerLink();

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
          label="Name"
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
              if (decimals === "" || symbol === "") {
                error("Invalid token info");
                return;
              }

              const { script } = await signer.getRecommendedAddressObj();

              const susTx = ccc.Transaction.from({
                outputs: [
                  {
                    lock: script,
                  },
                ],
              });
              await susTx.completeInputsByCapacity(signer);
              await susTx.completeFeeBy(signer);
              const susTxHash = await signer.sendTransaction(susTx);
              log("Transaction sent:", explorerTransaction(susTxHash));
              await signer.client.cache.markUnusable({
                txHash: susTxHash,
                index: 0,
              });

              const singleUseLock = await ccc.Script.fromKnownScript(
                signer.client,
                ccc.KnownScript.SingleUseLock,
                ccc.OutPoint.from({
                  txHash: susTxHash,
                  index: 0,
                }).toBytes(),
              );
              const lockTx = ccc.Transaction.from({
                outputs: [
                  // Owner cell
                  {
                    lock: singleUseLock,
                  },
                ],
              });
              await lockTx.completeInputsByCapacity(signer);
              await lockTx.completeFeeBy(signer);
              const lockTxHash = await signer.sendTransaction(lockTx);
              log("Transaction sent:", explorerTransaction(lockTxHash));

              const mintTx = ccc.Transaction.from({
                inputs: [
                  // SUS
                  {
                    previousOutput: {
                      txHash: susTxHash,
                      index: 0,
                    },
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
                  // Issued xUDT
                  {
                    lock: script,
                    type: await ccc.Script.fromKnownScript(
                      signer.client,
                      ccc.KnownScript.XUdt,
                      singleUseLock.hash(),
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
                  ccc.numLeToBytes(amount, 16),
                  tokenInfoToBytes(decimals, symbol, name),
                ],
              });
              await mintTx.addCellDepsOfKnownScripts(
                signer.client,
                ccc.KnownScript.SingleUseLock,
                ccc.KnownScript.XUdt,
                ccc.KnownScript.UniqueType,
              );
              await mintTx.completeInputsByCapacity(signer);
              if (!mintTx.outputs[1].type) {
                error("Unexpected disappeared output");
                return;
              }
              mintTx.outputs[1].type!.args = ccc.hexFrom(
                ccc.bytesFrom(ccc.hashTypeId(mintTx.inputs[0], 1)).slice(0, 20),
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
