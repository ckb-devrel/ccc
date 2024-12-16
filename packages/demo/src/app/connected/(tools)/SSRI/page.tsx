"use client";

import React, { useState, useEffect, useMemo } from "react";
import { SSRIParamsInput } from "@/src/components/SSRIParamsInput";
import { Button } from "@/src/components/Button";
import { TextInput } from "@/src/components/Input";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { Dropdown } from "@/src/components/Dropdown";
import { UDTPausable, SSRIServer, UDT } from "@ckb-ccc/ssri";
import 'reflect-metadata';

export default function SSRI() {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("SSRI");

  const [SSRIServerURL, setSSRIServerURL] = useState<string>("");
  const [contractOutPointTx, setContractOutPointTx] = useState<string>("");
  const [contractOutPointIndex, setContractOutPointIndex] = useState<string>("0");
  const [activeTrait, setActiveTrait] = useState<"UDT" | "UDTPausable">("UDT");
  const [methodList, setMethodList] = useState<string[]>([]);
  const [activeMethod, setActiveMethod] = useState<string>("");
  const [methodParams, setMethodParams] = useState<any[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [ssriParams, setSSRIParams] = useState<any>({});

  useEffect(() => {
    if (activeTrait === "UDT") {
      console.log("UDT methods:", Object.getOwnPropertyNames(UDT.prototype));
      setMethodList(Object.getOwnPropertyNames(UDT.prototype).filter(name =>
        name !== 'constructor' &&
        typeof (UDT.prototype as any)[name] === 'function'
      ));
    } else {
      console.log("UDTPausable methods:", Object.getOwnPropertyNames(UDTPausable.prototype));
      setMethodList(Object.getOwnPropertyNames(UDTPausable.prototype).filter(name =>
        name !== 'constructor' &&
        typeof (UDTPausable.prototype as any)[name] === 'function'
      ));
    }
  }, [activeTrait]);

  useEffect(() => {
    if (activeMethod) {
      const params = getMethodParameters(activeTrait, activeMethod);
      setMethodParams(params);
      setParamValues({});
    }
  }, [activeMethod, activeTrait]);

  const makeSSRICall = async () => {
    if (!signer) return;

    const testSSRIServer = new SSRIServer(signer.client, SSRIServerURL);
    const testOutPoint = {
      txHash: contractOutPointTx,
      index: parseInt(contractOutPointIndex)
    };

    const contract = activeTrait === "UDT"
      ? new UDT(testSSRIServer, testOutPoint)
      : new UDTPausable(testSSRIServer, testOutPoint);

    try {
      const args = methodParams.map((_, index) => paramValues[`param${index}`]);
      console.log("Calling method", activeMethod, "with args", args);

      console.log("Contract:", contract);

      console.log("Try to call name:", await contract.name());

    } catch (e) {
      if (e instanceof Error) {
        error(`Error: ${e.message}`);
      } else {
        error(`Unexpected error: ${e}`);
      }
    }
  };

  return (
    <div className="flex w-full flex-col items-stretch gap-4">
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
        options={[
          { name: "UDT", displayName: "UDT", iconName: "Pill" },
          { name: "UDTPausable", displayName: "UDTPausable", iconName: "Pill" }
        ]}
        selected={activeTrait}
        onSelect={(item) => setActiveTrait(item as "UDT" | "UDTPausable")}
      />

      <Dropdown
        options={methodList.map((method) => ({
          name: method,
          displayName: method,
          iconName: "Pill",
        }))}
        selected={activeMethod || (methodList.length > 0 ? methodList[0] : "")}
        onSelect={setActiveMethod}
      />

      {methodParams.map((paramType, index) => (
        <TextInput
          key={`${activeMethod}-param-${index}`}
          label={`Parameter ${index + 1} (${paramType.name})`}
          placeholder={`Enter ${paramType.name} value`}
          state={[
            paramValues[`param${index}`] || '',
            (value) => setParamValues(prev => ({ ...prev, [`param${index}`]: value }))
          ]}
        />
      ))}

      <SSRIParamsInput 
        params={ssriParams}
        onChange={setSSRIParams}
      />

      <ButtonsPanel>
        <Button onClick={makeSSRICall}>
          Execute Method
        </Button>
      </ButtonsPanel>
    </div>
  );
}


const getMethodParameters = (trait: 'UDT' | 'UDTPausable', methodName: string) => {
  const TraitClass = trait === 'UDT' ? UDT : UDTPausable;
  const method = (TraitClass.prototype as any)[methodName];
  if (!method) {
    return [];
  }

  const params = Reflect.getMetadata('design:paramtypes', TraitClass.prototype, methodName);

  if (!params) {
    // Try getting parameter information from function definition
    const funcStr = method.toString();
    const paramMatch = funcStr.match(/\((.*?)\)/);
    if (paramMatch) {
      const paramNames: string[] = paramMatch[1].split(',').map((p: string) => p.trim()).filter((p: string) => p);
      if (paramNames.at(-1) === 'params') {
        return paramNames.slice(0, -1).map((name: string) => ({ name }));
      }
      return paramNames.map((name: any) => ({ name }));
    }
  }

  return params || [];
};