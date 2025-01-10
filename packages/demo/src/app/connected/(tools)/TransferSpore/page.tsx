"use client";

import React, { useEffect, useState } from "react";
import { TextInput } from "@/src/components/Input";
import { Button } from "@/src/components/Button";
import { useGetExplorerLink } from "@/src/utils";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { Dropdown } from "@/src/components/Dropdown";
import { ccc } from "@ckb-ccc/connector-react";

export default function TransferSpore() {
  const { signer, createSender } = useApp();
  const { log } = createSender("Transfer Spore");
  const { explorerTransaction } = useGetExplorerLink();
  const [address, setAddress] = useState<string>("");
  const [sporeId, setSporeId] = useState<string>("");

  const [sporeList, setSporeList] = useState([{ id: "", name: "Loading..." }]);

  useEffect(() => {
    if (!signer) {
      return;
    }

    (async () => {
      let list = [];
      for await (const { spore, sporeData } of ccc.spore.findSporesBySigner({
        signer,
        order: "desc",
      })) {
        if (!spore.cellOutput.type?.args) {
          continue;
        }

        if (sporeData.clusterId) {
          const cluster = await ccc.spore.findCluster(
            signer.client,
            sporeData.clusterId,
          );

          if (cluster) {
            list.push({
              id: spore.cellOutput.type.args,
              name: `${cluster.clusterData.name} (${ccc
                .hexFrom(sporeData.clusterId)
                .slice(0, 10)}-${spore.cellOutput.type.args.slice(0, 10)})`,
            });
            continue;
          }
        }

        list.push({
          id: spore.cellOutput.type.args,
          name: "Public Spore",
        });
      }
      setSporeList(list);
      setSporeId((sporeId) => (sporeId === "" ? list[0].id : sporeId));
    })();
  }, [signer]);

  return (
    <div className="flex w-full flex-col items-stretch">
      <TextInput
        label="Address"
        placeholder="Receiver address"
        state={[address, setAddress]}
      />

      <label className="mt-4 text-sm">Select a Spore to transfer</label>
      <Dropdown
        className="mt-2"
        options={sporeList.map((spore) => ({
          name: spore.id,
          displayName: spore.name,
          iconName: "Cherry",
        }))}
        selected={sporeId}
        onSelect={setSporeId}
      />

      <ButtonsPanel>
        <Button
          disabled={sporeId === ""}
          onClick={async () => {
            if (!signer || !address || sporeId === "") {
              return;
            }
            const { script: to } = await ccc.Address.fromString(
              address,
              signer.client,
            );

            // Build transaction
            const { tx } = await ccc.spore.transferSpore({
              signer,
              id: sporeId,
              to,
            });
            await tx.completeFeeBy(signer);

            // Send transaction
            const txHash = await signer.sendTransaction(tx);
            log("Transaction sent:", explorerTransaction(txHash));
            await signer.client.waitTransaction(txHash);
            log("Transaction committed:", explorerTransaction(txHash));
          }}
        >
          Transfer Spore
        </Button>
        <Button
          variant="danger"
          className="ml-2"
          disabled={sporeId === ""}
          onClick={async () => {
            if (!signer || sporeId === "") {
              return;
            }

            // Build transaction
            const { tx } = await ccc.spore.meltSpore({
              signer,
              id: sporeId,
            });
            await tx.completeFeeBy(signer);

            // Send transaction
            const txHash = await signer.sendTransaction(tx);
            log("Transaction sent:", explorerTransaction(txHash));
            await signer.client.waitTransaction(txHash);
            log("Transaction committed:", explorerTransaction(txHash));
          }}
        >
          Melt Spore
        </Button>
      </ButtonsPanel>
    </div>
  );
}
