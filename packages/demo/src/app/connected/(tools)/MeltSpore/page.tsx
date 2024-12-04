"use client";

import React, { useEffect, useState } from "react";
import { TextInput } from "@/src/components/Input";
import { Button } from "@/src/components/Button";
import { useGetExplorerLink } from "@/src/utils";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { meltSpore } from "@ckb-ccc/spore";


export default function MeltSpore() {
    const { signer, createSender } = useApp();
    const { log } = createSender("Melt Spore");
    const { explorerTransaction } = useGetExplorerLink();
    const [sporeId, SetSporeId] = useState<string>("");




    return (
        <div className="flex w-full flex-col items-stretch">
            
            <TextInput
                label="Spore ID"
                placeholder="Spore Token ID"
                state={[sporeId, SetSporeId]}
            />


            <ButtonsPanel>
                <Button
                    className="self-center"
                    onClick={async () => {
                        if (!signer||!sporeId) return
                   
                        // Build transaction
                        let { tx } = await meltSpore({
                            signer,
                            // Change this if you have a different sporeId
                            id: sporeId
                        });
                        log('Melt Spore tokenID:',sporeId)
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
