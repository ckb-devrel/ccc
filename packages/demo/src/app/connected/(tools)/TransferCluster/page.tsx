"use client";

import React, {useState } from "react";
import { TextInput } from "@/src/components/Input";
import { Button } from "@/src/components/Button";
import { useGetExplorerLink } from "@/src/utils";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { ccc } from "@ckb-ccc/connector-react";
import { transferSporeCluster } from "@ckb-ccc/spore";

export default function TransferCluster() {
    const { signer, createSender } = useApp();
    const { log } = createSender("Transfer Cluster");
    const { explorerTransaction } = useGetExplorerLink();
    const [address, SetAddress] = useState<string>("");
    const [clusterId, SetClusterId] = useState<string>("");




    return (
        <div className="flex w-full flex-col items-stretch">
            <TextInput
                label="Address"
                placeholder="Recevier address"
                state={[address, SetAddress]}
            />
            <TextInput
                label="Cluster ID"
                placeholder="Cluster Token ID"
                state={[clusterId, SetClusterId]}
            />


            <ButtonsPanel>
                <Button
                    className="self-center"
                    onClick={async () => {
                        if (!signer||!address||!clusterId) return
                        // Create a new owner
                        const owner = await ccc.Address.fromString(
                            address,
                            signer.client,
                        );

                        // Build transaction
                        let { tx } = await transferSporeCluster({
                            signer,
                            // Change this if you have a different clusterId
                            id: clusterId,
                            to: owner.script,
                        });
                         // Complete transaction
                        await tx.completeFeeBy(signer);
                        tx = await signer.signTransaction(tx);
                       
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
