"use client";

import { Button } from "@/src/components/Button";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { Dropdown } from "@/src/components/Dropdown";
import { TextInput } from "@/src/components/Input";
import { Message } from "@/src/components/Message";
import { useApp } from "@/src/context";
import { useGetExplorerLink } from "@/src/utils";
import { ccc, spore } from "@ckb-ccc/connector-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export default function MintSpore() {
  const { signer, createSender } = useApp();
  const { log, warn } = createSender("Mint Spore");
  const { explorerTransaction } = useGetExplorerLink();
  const [contentType, setContentType] = useState<string>("dob/1");
  const [content, setContent] = useState<string>(
    '{ "dna": "0123456789abcdef" }',
  );
  const [clusterId, setClusterId] = useState<string>("");
  const [clusterList, setClusterList] = useState([
    {
      id: "",
      name: "Mint Without Cluster",
    },
  ]);

  const mintSpore = useCallback(async () => {
    if (!signer) return;

    const cont = (() => {
      const trimmed = content.trim();
      if (!(trimmed.startsWith("{") || trimmed.endsWith("}"))) {
        return content;
      }
      try {
        const compressed = JSON.stringify(JSON.parse(content));
        log("JSON object content was compressed");
        return compressed;
      } catch (_err) {
        warn("Failed to parse content as JSON object, leaving it unchanged");
        return content;
      }
    })();

    // Build transaction
    const { tx, id } = await spore.createSpore({
      signer,
      data: {
        contentType,
        content: ccc.bytesFrom(cont, "utf8"),
        clusterId: clusterId === "" ? undefined : clusterId,
      },
      clusterMode: clusterId === "" ? "skip" : "clusterCell",
    });
    await tx.completeFeeBy(signer);

    const txHash = await signer.sendTransaction(tx);
    log("Transaction sent:", explorerTransaction(txHash), "Spore ID:", id);
    await signer.client.waitTransaction(txHash);
    log("Transaction committed:", explorerTransaction(txHash));
  }, [signer, log, warn, clusterId, content, contentType, explorerTransaction]);

  useEffect(() => {
    if (!signer) {
      return;
    }

    (async () => {
      const list = [
        {
          id: "",
          name: "Mint Without Cluster",
        },
      ];

      for await (const {
        cluster,
        clusterData,
      } of spore.findSporeClustersBySigner({
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
    })();
  }, [signer]);

  return (
    <div className="flex w-full flex-col items-stretch">
      <Message title="Hint" type="info">
        Learn more on{" "}
        <Link
          className="underline"
          href="https://docs.spore.pro/"
          target="_blank"
        >
          the Spore Protocol Docs
        </Link>
        .
      </Message>

      <TextInput
        label="Content Type"
        placeholder="Spore Content Type"
        state={[contentType, setContentType]}
      />
      <TextInput
        label="Content"
        placeholder="Spore Content"
        state={[content, setContent]}
      />

      <label className="mt-4 text-sm">Select a Cluster (optional)</label>
      <Dropdown
        className="mt-2"
        options={clusterList.map((cluster) => ({
          name: cluster.id,
          displayName: cluster.name,
          iconName: "Wheat",
        }))}
        selected={clusterId}
        onSelect={setClusterId}
      />
      <ButtonsPanel>
        <Button onClick={mintSpore}>Mint Spore</Button>
      </ButtonsPanel>
    </div>
  );
}
