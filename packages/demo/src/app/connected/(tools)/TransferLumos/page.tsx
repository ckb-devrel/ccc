"use client";

import { Button } from "@/src/components/Button";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { TextInput } from "@/src/components/Input";
import { Textarea } from "@/src/components/Textarea";
import { useApp } from "@/src/context";
import { useGetExplorerLink } from "@/src/utils";
import { ccc } from "@ckb-ccc/connector-react";
import { generateDefaultScriptInfos } from "@ckb-ccc/lumos-patches";
import { Indexer } from "@ckb-lumos/ckb-indexer";
import common, {
  registerCustomLockScriptInfos,
} from "@ckb-lumos/common-scripts/lib/common";
import { predefined } from "@ckb-lumos/config-manager";
import { TransactionSkeleton } from "@ckb-lumos/helpers";
import { useState } from "react";

export default function TransferLumos() {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("Transfer with Lumos");

  const { explorerTransaction } = useGetExplorerLink();

  const [transferTo, setTransferTo] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [data, setData] = useState<string>("");

  return (
    <>
      <div className="flex w-full flex-col items-stretch">
        <TextInput
          label="Address"
          placeholder="Address to transfer to"
          state={[transferTo, setTransferTo]}
        />
        <TextInput
          label="Amount"
          placeholder="Amount to transfer"
          state={[amount, setAmount]}
        />
        <Textarea
          label="Output Data(options)"
          state={[data, setData]}
          placeholder="Data in the cell. Hex string will be parsed."
        />
        <ButtonsPanel>
          <Button
            className="self-center"
            onClick={async () => {
              if (!signer) {
                return;
              }
              // Verify destination address
              await ccc.Address.fromString(transferTo, signer.client);

              const fromAddresses = await signer.getAddresses();
              // === Composing transaction with Lumos ===
              registerCustomLockScriptInfos(generateDefaultScriptInfos());
              const indexer = new Indexer(
                signer.client.url
                  .replace("wss://", "https://")
                  .replace("ws://", "http://")
                  .replace(new RegExp("/ws/?$"), "/"),
              );
              let txSkeleton = new TransactionSkeleton({
                cellProvider: indexer,
              });
              txSkeleton = await common.transfer(
                txSkeleton,
                fromAddresses,
                transferTo,
                ccc.fixedPointFrom(amount),
                undefined,
                undefined,
                {
                  config:
                    signer.client.addressPrefix === "ckb"
                      ? predefined.LINA
                      : predefined.AGGRON4,
                },
              );
              txSkeleton = await common.payFeeByFeeRate(
                txSkeleton,
                fromAddresses,
                BigInt(3600),
                undefined,
                {
                  config:
                    signer.client.addressPrefix === "ckb"
                      ? predefined.LINA
                      : predefined.AGGRON4,
                },
              );
              // ======

              const tx = ccc.Transaction.fromLumosSkeleton(txSkeleton);

              // CCC transactions are easy to be edited
              const dataBytes = (() => {
                try {
                  return ccc.bytesFrom(data);
                } catch (_e) {}

                return ccc.bytesFrom(data, "utf8");
              })();
              if (
                tx.outputs[0].capacity < ccc.fixedPointFrom(dataBytes.length)
              ) {
                error("Insufficient capacity to store data");
                return;
              }
              tx.outputsData[0] = ccc.hexFrom(dataBytes);

              // Sign and send the transaction
              const txHash = await signer.sendTransaction(tx);
              log("Transaction sent:", explorerTransaction(txHash));
              await signer.client.waitTransaction(txHash);
              log("Transaction committed:", explorerTransaction(txHash));
            }}
          >
            Transfer
          </Button>
        </ButtonsPanel>
      </div>
    </>
  );
}
