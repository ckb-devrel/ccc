"use client";

import { Button } from "@/src/components/Button";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { Dropdown } from "@/src/components/Dropdown";
import { TextInput } from "@/src/components/Input";
import { useApp } from "@/src/context";
import { useGetExplorerLink } from "@/src/utils";
import { ccc } from "@ckb-ccc/connector-react";
import { useEffect, useState } from "react";

export default function TransferSporeCluster() {
  const { signer, createSender } = useApp();
  const { log } = createSender("Transfer Cluster");
  const { explorerTransaction } = useGetExplorerLink();
  const [address, setAddress] = useState<string>("");
  const [clusterId, setClusterId] = useState<string>("");

  const [clusterList, setClusterList] = useState([
    { id: "", name: "Loading..." },
  ]);

  useEffect(() => {
    if (!signer) {
      return;
    }

    (async () => {
      const list: { id: string; name: string }[] = [];
      for await (const {
        cluster,
        clusterData,
      } of ccc.spore.findSporeClustersBySigner({
        signer,
        order: "desc",
      })) {
        if (!cluster.cellOutput.type?.args) {
          continue;
        }

        list.push({
          id: cluster.cellOutput.type.args,
          name: `${clusterData.name} (${cluster.cellOutput.type.args.slice(0, 10)})`,
        });
      }
      setClusterList(list);
      setClusterId((clusterId) => (clusterId === "" ? list[0].id : clusterId));
    })();
  }, [signer]);

  return (
    <div className="flex w-full flex-col items-stretch">
      <TextInput
        label="Address"
        placeholder="Receiver address"
        state={[address, setAddress]}
      />

      <label className="mt-4 text-sm">Select a Cluster to transfer</label>
      <Dropdown
        className="mt-2"
        options={clusterList.map(({ id, name }) => ({
          name: id,
          displayName: name,
          iconName: "Wheat",
        }))}
        selected={clusterId}
        onSelect={setClusterId}
      />

      <ButtonsPanel>
        <Button
          disabled={clusterId === ""}
          onClick={async () => {
            if (!signer || !address || clusterId === "") return;
            // Create a new owner
            const { script: to } = await ccc.Address.fromString(
              address,
              signer.client,
            );

            // Build transaction
            const { tx } = await ccc.spore.transferSporeCluster({
              signer,
              id: clusterId,
              to,
            });
            await tx.completeFeeBy(signer);

            const txHash = await signer.sendTransaction(tx);
            log("Transaction sent:", explorerTransaction(txHash));
            await signer.client.waitTransaction(txHash);
            log("Transaction committed:", explorerTransaction(txHash));
          }}
        >
          Transfer Spore
        </Button>
      </ButtonsPanel>
    </div>
  );
}
