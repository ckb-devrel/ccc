"use client";

import { Button } from "@/src/components/Button";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { TextInput } from "@/src/components/Input";
import { Message } from "@/src/components/Message";
import { Textarea } from "@/src/components/Textarea";
import { useApp } from "@/src/context";
import { useGetExplorerLink } from "@/src/utils";
import { ccc, spore } from "@ckb-ccc/connector-react";
import Link from "next/link";
import { useEffect, useState } from "react";

function generateClusterDescriptionUnderDobProtocol(
  client: ccc.Client,
): [string, string] {
  /**
   * Generation example for DOB0
   */
  const clusterDescription = "My First DOB Cluster";
  const dob0Pattern: spore.dob.PatternElementDob0[] = [
    {
      traitName: "BackgroundColor",
      dobType: "String",
      dnaOffset: 0,
      dnaLength: 1,
      patternType: "options",
      traitArgs: ["red", "blue", "green", "black", "white"],
    },
    {
      traitName: "Type",
      dobType: "Number",
      dnaOffset: 1,
      dnaLength: 1,
      patternType: "range",
      traitArgs: [10, 50],
    },
    {
      traitName: "Timestamp",
      dobType: "Number",
      dnaOffset: 2,
      dnaLength: 4,
      patternType: "rawNumber",
    },
  ];
  const dob0: spore.dob.Dob0 = {
    description: clusterDescription,
    dob: {
      ver: 0,
      decoder: spore.dob.getDecoder(client, "dob0"),
      pattern: dob0Pattern,
    },
  };

  /**
   * Generation example for DOB1
   */
  const dob1Pattern: spore.dob.PatternElementDob1[] = [
    {
      imageName: "IMAGE.0",
      svgFields: "attributes",
      traitName: "",
      patternType: "raw",
      traitArgs: "xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 200'",
    },
    {
      imageName: "IMAGE.0",
      svgFields: "elements",
      traitName: "Timestamp",
      patternType: "options",
      traitArgs: [
        [
          [0, 1000000],
          "<image width='300' height='200' href='btcfs://b2f4560f17679d3e3fca66209ac425c660d28a252ef72444c3325c6eb0364393i0' />",
        ],
        [
          ["*"],
          "<image width='300' height='200' href='btcfs://eb3910b3e32a5ed9460bd0d75168c01ba1b8f00cc0faf83e4d8b67b48ea79676i0' />",
        ],
      ],
    },
    {
      imageName: "IMAGE.0",
      svgFields: "elements",
      traitName: "BackgroundColor",
      patternType: "options",
      traitArgs: [
        ["red", "<rect width='20' height='20' x='5' y='5' fill='red' />"],
        ["blue", "<rect width='20' height='20' x='20' y='5' fill='blue' />"],
        ["green", "<rect width='20' height='20' x='5' y='20' fill='green' />"],
        [["*"], "<rect width='20' height='20' x='20' y='20' fill='pink' />"],
      ],
    },
  ];
  const dob1: spore.dob.Dob1 = {
    description: clusterDescription,
    dob: {
      ver: 1,
      decoders: [
        {
          decoder: spore.dob.getDecoder(client, "dob0"),
          pattern: dob0Pattern,
        },
        {
          decoder: spore.dob.getDecoder(client, "dob1"),
          pattern: dob1Pattern,
        },
      ],
    },
  };
  return [
    spore.dob.encodeClusterDescriptionForDob0(dob0),
    spore.dob.encodeClusterDescriptionForDob1(dob1),
  ];
}
export default function CreateSporeCluster() {
  const { signer, createSender } = useApp();
  const { client } = ccc.useCcc();
  const { log, warn } = createSender("Create Cluster");

  const { explorerTransaction } = useGetExplorerLink();

  const [name, SetName] = useState<string>("My First DOB Cluster");
  const [description, setDescription] = useState<string>("");

  useEffect(() => {
    setDescription(
      JSON.stringify(
        JSON.parse(generateClusterDescriptionUnderDobProtocol(client)[1]),
        undefined,
        2,
      ),
    );
  }, [client]);

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
        label="Name"
        placeholder="Cluster Name"
        state={[name, SetName]}
      />
      <Textarea
        label="Description"
        placeholder="Cluster Description"
        rows={10}
        state={[description, setDescription]}
      />

      <ButtonsPanel>
        <Button
          variant="info"
          onClick={() => {
            setDescription(
              JSON.stringify(
                JSON.parse(
                  generateClusterDescriptionUnderDobProtocol(client)[0],
                ),
                undefined,
                2,
              ),
            );
          }}
        >
          Generate DOB/0 Example
        </Button>
        <Button
          variant="info"
          className="ml-2"
          onClick={() => {
            setDescription(
              JSON.stringify(
                JSON.parse(
                  generateClusterDescriptionUnderDobProtocol(client)[1],
                ),
                undefined,
                2,
              ),
            );
          }}
        >
          Generate DOB/1 Example
        </Button>
        <Button
          className="ml-2"
          onClick={async () => {
            if (!signer) return;

            const desc = (() => {
              const trimmed = description.trim();
              if (!(trimmed.startsWith("{") || trimmed.endsWith("}"))) {
                return description;
              }
              try {
                const compressed = JSON.stringify(JSON.parse(description));
                log("JSON object description was compressed");
                return compressed;
              } catch (_err) {
                warn(
                  "Failed to parse description as JSON object, leaving it unchanged",
                );
                return description;
              }
            })();
            const { tx, id } = await spore.createSporeCluster({
              signer,

              data: {
                name,
                description: desc,
              },
            });
            await tx.completeFeeBy(signer);

            const txHash = await signer.sendTransaction(tx);
            log(
              "Transaction sent:",
              explorerTransaction(txHash),
              "Cluster ID:",
              id,
            );
            await signer.client.waitTransaction(txHash);
            log("Transaction committed:", explorerTransaction(txHash));
          }}
        >
          Create Cluster
        </Button>
      </ButtonsPanel>
    </div>
  );
}
