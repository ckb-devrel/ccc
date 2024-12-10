"use client";

import React, { useEffect, useState } from "react";
import { TextInput } from "@/src/components/Input";
import { Button } from "@/src/components/Button";
import { useGetExplorerLink } from "@/src/utils";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { findSporesBySigner, meltSpore } from "@ckb-ccc/spore";
import { Dropdown } from "@/src/components/Dropdown";

export default function MeltSpore() {
  const { signer, createSender } = useApp();
  const { log } = createSender("Melt Spore");
  const { explorerTransaction } = useGetExplorerLink();
  const [sporeId, SetSporeId] = useState<string>("");

  const [sporeList, setSporeList] = useState([
    {
      id: "",
    },
  ]);
  useEffect(() => {
    let synced = false;

    if (!signer) {
      return;
    }

    (async () => {
      // Search Cluster cells
      let list = [];
      for await (const spore of findSporesBySigner({
        signer,
        order: "desc",
      })) {
        if (synced) return;
        console.log(spore);
        list.push({
          id: spore.spore.cellOutput.type?.args || "",
        });
      }
      setSporeList((prevState) => [...prevState, ...list]);
    })();
    return () => {
      synced = true;
    };
  }, [signer]);

  return (
    <div className="flex w-full flex-col items-stretch">
      <label className="text-sm">Select a Spore to melt</label>
      <Dropdown
        options={sporeList.map((spore, i) => ({
          name: spore.id,
          displayName: spore.id,
          iconName: "Flower2",
        }))}
        selected={sporeId}
        onSelect={(sporeId) => {
          SetSporeId(sporeId);
          log("Use sporeId", sporeId);
        }}
      />



      <ButtonsPanel>
        <Button
          className="self-center"
          onClick={async () => {
            if (!signer || !sporeId) return;

            // Build transaction
            let { tx } = await meltSpore({
              signer,
              // Change this if you have a different sporeId
              id: sporeId,
            });
            log("Melt Spore tokenID:", sporeId);
            // Complete transaction
            await tx.completeFeeBy(signer);
            tx = await signer.signTransaction(tx);

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
