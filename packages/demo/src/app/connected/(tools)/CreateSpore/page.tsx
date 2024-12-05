"use client";

import React, { useState } from "react";
import { TextInput } from "@/src/components/Input";
import { Button } from "@/src/components/Button";
import { useGetExplorerLink } from "@/src/utils";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { Dropdown } from "@/src/components/Dropdown";
import { ccc } from "@ckb-ccc/connector-react";
import { createSpore } from "@ckb-ccc/spore";

export default function CreateSpore() {
    const { signer, createSender } = useApp();
    const { log } = createSender("Create Spore");
    const { explorerTransaction } = useGetExplorerLink();
    const [dnaText, SetDnaText] = useState<string>("");
    const [clusterId, setClusterId] = useState<string>("");
    const clusterList = [
        {
            id: ' 0x2e3817f0880af469c657c44fdb4b5bbedad821757df27f9e1f7030b3996ea14b',
            name: 'test'
        },
        {
            id: '',
            name: 'no Cluster'
        }
    ]
    const CreateSporeWithCluster = async () => {
        if (!signer) return

        const hasher = new ccc.HasherCkb(7);
        hasher.update(ccc.bytesFrom(dnaText, "utf8"));
        let dna = ccc.bytesFrom(hasher.digest());
        dna = ccc.bytesConcat(dna, ccc.bytesFrom(dnaText, "utf8"));
        // expect(dna.length === 20);
        const hexedDna = ccc.bytesTo(dna, "hex"); // no leading "0x"
        const content = `{"dna":"${hexedDna}"}`;

        // Build transaction
        let { tx, id } = await createSpore({
            signer,
            data: {
                contentType: "dob/1",
                content: ccc.bytesFrom(content, "utf8"),
                clusterId: clusterId
            },
            clusterMode: "clusterCell",
        });
        log("sporeId:", id);
        // Complete transaction
        await tx.completeFeeBy(signer);
        tx = await signer.signTransaction(tx);
        const txHash = await signer.sendTransaction(tx);
        log("Transaction sent:", explorerTransaction(txHash));
        await signer.client.waitTransaction(txHash);
        log("Transaction committed:", explorerTransaction(txHash));

    }
    const CreateSporeWithoutCluster = async () => {
        if (!signer) return

        // Build transaction
        let { tx, id } = await createSpore({
            signer,
            data: {
                contentType: "text/plain",
                content: ccc.bytesFrom(dnaText, "utf8"),
            },
        });
        log("sporeId:", id);

        // Complete transaction
        await tx.completeFeeBy(signer);
        tx = await signer.signTransaction(tx);
        // Send transaction
        const txHash = await signer.sendTransaction(tx);
        log("Transaction sent:", explorerTransaction(txHash));
        await signer.client.waitTransaction(txHash);
        log("Transaction committed:", explorerTransaction(txHash));
    }
    return (
        <div className="flex w-full flex-col items-stretch">
            <TextInput
                label="DNA"
                placeholder="Spore DNA"
                state={[dnaText, SetDnaText]}
            />

            <label className="text-sm">Select a Cluster (optional)</label>
            <Dropdown
                options={clusterList.map((cluster, i) => ({
                    name: cluster.id,
                    displayName: cluster.name,
                    iconName: 'Wheat'
                }))}
                selected={''}
                onSelect={(clusterId) => {
                    setClusterId(clusterId)
                    log('Use clusterId', clusterId)
                }}
            />
            <ButtonsPanel>
                <Button
                    className="self-center"
                    onClick={async () => {
                        (clusterId.length > 0) ? CreateSporeWithCluster() : CreateSporeWithoutCluster()

                    }}
                >
                    Create Spore
                </Button>
            </ButtonsPanel>
        </div>
    );
}
