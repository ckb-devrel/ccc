"use client";

import React, { useState } from "react";
import { Button } from "@/src/components/Button";
import { TextInput } from "@/src/components/Input";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { Dropdown } from "@/src/components/Dropdown";
import { UDTPausable, SSRIServer } from "@ckb-ccc/ssri";

export default function SSRI() {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("SSRI");

  const [SSRIServerURL, setSSRIServerURL] = useState<string>("");
  const [contractOutPointTx, setContractOutPointTx] = useState<string>("");
  const [contractOutPointIndex, setContractOutPointIndex] = useState<string>("0");
  const [activeTrait, setActiveTrait] = useState<string>("UDT");
  const [activeMethod, setActiveMethod] = useState<string>("");

  const UDTMethods = Object.keys(UDTPausable.prototype).map((method) => ({
    name: method,
    displayName: method,
  }
  ));

  const makeSSRICall = async (trait: string, method: string) => {
    if (!signer) {
      return;
    }
    const testSSRIServer = new SSRIServer(
      signer.client,
      SSRIServerURL
    )

    const testOutPoint = {
      txHash: contractOutPointTx,
      index: parseInt(contractOutPointIndex)
    }

    const testUDTContract = new UDTPausable(
      testSSRIServer,
      testOutPoint
    )
  }

  return (
    <div className="flex w-full flex-col items-stretch">
      <TextInput
        label="SSRI Server URL"
        placeholder="URL of the SSRI server"
        state={[SSRIServerURL, setSSRIServerURL]}
      />
      <TextInput
        label="Contract OutPoint Tx"
        placeholder="Tx hash of the contract outpoint"
        state={[contractOutPointTx, setContractOutPointTx]}
      />
      <TextInput
        label="Contract OutPoint Index"
        placeholder="Index of the contract outpoint"
        state={[contractOutPointIndex, setContractOutPointIndex]}
      />
      <Dropdown
        options={[{
          name: "UDT",
          displayName: "UDT",
          iconName: "Pill",
        }, {
          name: "UDTPausable",
          displayName: "UDTPausable",
          iconName: "Pill",
        }]}
        selected={"UDT"}
        onSelect={(item) => {
          setActiveTrait(item);
        }}
      />
      <Dropdown
        options={UDTMethods.map((method) => ({
          name: method.name,
          displayName: method.displayName,
          iconName: "Pill",
        }
        ))}
        selected={UDTMethods[0].name}
        onSelect={(item) => {
          setActiveTrait(item);
        }}
      />
      <ButtonsPanel>
        <Button
          onClick={async () => {
            if (!SSRI) {
              return;
            }
            log("SSRIature:");
          }}
        >
          SSRI
        </Button>
        <Button
          className="ml-2"
          onClick={async () => {
            log("Valid");
          }}
        >
          Verify
        </Button>
      </ButtonsPanel>
    </div>
  );
}
