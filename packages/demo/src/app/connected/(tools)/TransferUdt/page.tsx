"use client";

import { Button } from "@/src/components/Button";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { TextInput } from "@/src/components/Input";
import { Textarea } from "@/src/components/Textarea";
import { useApp } from "@/src/context";
import { useGetExplorerLink } from "@/src/utils";
import { ccc } from "@ckb-ccc/connector-react";
import { useEffect, useState } from "react";

export default function TransferUdt() {
  const { client } = ccc.useCcc();
  const { signer, createSender } = useApp();
  const { log } = createSender("Transfer xUDT");

  const { explorerTransaction } = useGetExplorerLink();

  const [udtTxHash, setUdtTxHash] = useState<string>("");
  const [udtIndex, setUdtIndex] = useState<string>("");
  const [udtCodeHash, setUdtCodeHash] = useState<string>("");
  const [udtHashType, setUdtHashType] = useState<string>("");
  const [udtArgs, setUdtArgs] = useState<string>("");
  const [transferTo, setTransferTo] = useState<string>("");
  const [amount, setAmount] = useState<string>("");

  useEffect(() => {
    (async () => {
      const script = await client.getKnownScript(ccc.KnownScript.XUdt);
      setUdtCodeHash(script.codeHash);
      setUdtHashType(script.hashType);
      setUdtTxHash(script.cellDeps[0].cellDep.outPoint.txHash);
      setUdtIndex(script.cellDeps[0].cellDep.outPoint.index.toString());
    })();
  }, [client]);

  return (
    <div className="flex w-full flex-col items-stretch">
      <Textarea
        label="Address"
        placeholder="Addresses to transfer to, separated by lines"
        state={[transferTo, setTransferTo]}
      />
      <TextInput
        label="Amount"
        placeholder="Amount to transfer for each"
        state={[amount, setAmount]}
      />
      <TextInput
        label="Args"
        placeholder="UDT args to transfer"
        state={[udtArgs, setUdtArgs]}
      />
      <TextInput
        label="Code Hash"
        placeholder="UDT args to transfer"
        state={[udtCodeHash, setUdtCodeHash]}
      />
      <TextInput
        label="Hash Type"
        placeholder="UDT hash type to transfer"
        state={[udtHashType, setUdtHashType]}
      />
      <TextInput
        label="Script Code Tx Hash"
        placeholder="Tx hash of the script code"
        state={[udtTxHash, setUdtTxHash]}
      />
      <TextInput
        label="Script Code index"
        placeholder="Index of the script code"
        state={[udtIndex, setUdtIndex]}
      />
      <ButtonsPanel>
        <Button
          className="self-center"
          onClick={async () => {
            if (!signer) {
              return;
            }
            const toAddresses = await Promise.all(
              transferTo
                .split("\n")
                .map((addr) => ccc.Address.fromString(addr, signer.client)),
            );
            const udt = new ccc.udt.Udt(
              {
                txHash: udtTxHash,
                index: udtIndex,
              },
              {
                codeHash: udtCodeHash,
                hashType: udtHashType,
                args: udtArgs,
              },
            );

            const { res: tx } = await udt.transfer(
              signer,
              toAddresses.map(({ script }) => ({
                to: script,
                amount: amount,
              })),
            );
            const completedTx = await udt.completeBy(tx, signer);
            await completedTx.completeInputsByCapacity(signer);
            await completedTx.completeFeeBy(signer);

            // Sign and send the transaction
            const txHash = await signer.sendTransaction(completedTx);
            log("Transaction sent:", explorerTransaction(txHash));
            await signer.client.waitTransaction(txHash);
            log("Transaction committed:", explorerTransaction(txHash));
          }}
        >
          Transfer
        </Button>
      </ButtonsPanel>
    </div>
  );
}
