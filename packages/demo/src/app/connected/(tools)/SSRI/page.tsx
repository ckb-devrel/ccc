"use client";

import React, { useState, useEffect } from "react";
import { SSRIParamsInput } from "@/src/components/SSRIParamsInput";
import { Button } from "@/src/components/Button";
import { TextInput } from "@/src/components/Input";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { Dropdown } from "@/src/components/Dropdown";
import { UDTPausable, SSRIServer, UDT } from "@ckb-ccc/ssri";
import 'reflect-metadata';
import { Script } from "@ckb-ccc/connector-react";
import JsonView from '@uiw/react-json-view';
import { darkTheme } from '@uiw/react-json-view/dark';
import Image from "next/image";

interface ScriptInputProps {
  value: { codeHash: string; hashType: string; args: string };
  onChange: (value: { codeHash: string; hashType: string; args: string }) => void;
  onRemove?: () => void;
}

const ScriptInput: React.FC<ScriptInputProps> = ({ value, onChange, onRemove }) => (
  <div className="flex flex-col gap-2 w-full border p-2 rounded">
    <TextInput
      label="Code Hash"
      placeholder="Enter code hash"
      state={[
        value.codeHash,
        (codeHash) => onChange({ ...value, codeHash })
      ]}
      className="w-full"
    />
    <div className="flex flex-row items-center gap-2">
      <label className="min-w-24">Hash Type:</label>
      <Dropdown
        options={[
          { name: 'type', displayName: 'Type', iconName: 'Pill' },
          { name: 'data', displayName: 'Data', iconName: 'Pill' },
          { name: 'data1', displayName: 'Data1', iconName: 'Pill' },
          { name: 'data2', displayName: 'Data2', iconName: 'Pill' }
        ]}
        selected={value.hashType}
        onSelect={(hashType) => onChange({ ...value, hashType })}
        className="flex-grow"
      />
    </div>
    <TextInput
      label="Args"
      placeholder="Enter args"
      state={[
        value.args,
        (args) => onChange({ ...value, args })
      ]}
      className="w-full"
    />
    {onRemove && (
      <Button
        onClick={onRemove}
        className="self-start bg-red-500 text-white px-2 py-1 rounded"
      >
        Remove
      </Button>
    )}
  </div>
);

interface ScriptArrayInputProps {
  value: { codeHash: string; hashType: string; args: string }[];
  onChange: (value: { codeHash: string; hashType: string; args: string }[]) => void;
  label?: string;
}

const ScriptArrayInput: React.FC<ScriptArrayInputProps> = ({
  value = [],
  onChange,
  label = "Scripts"
}) => {
  const addScript = () => {
    onChange([...value, { codeHash: '', hashType: 'type', args: '' }]);
  };

  const removeScript = (index: number) => {
    const newScripts = [...value];
    newScripts.splice(index, 1);
    onChange(newScripts);
  };

  const updateScript = (index: number, script: { codeHash: string; hashType: string; args: string }) => {
    const newScripts = [...value];
    newScripts[index] = script;
    onChange(newScripts);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="font-semibold">{label}</label>
      {value.map((script, index) => (
        <ScriptInput
          key={index}
          value={script}
          onChange={(updatedScript) => updateScript(index, updatedScript)}
          onRemove={() => removeScript(index)}
        />
      ))}
      <Button
        onClick={addScript}
        className="self-start bg-green-500 text-white px-2 py-1 rounded"
      >
        Add Script
      </Button>
    </div>
  );
};

export default function SSRI() {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("SSRI");

  const [SSRIServerURL, setSSRIServerURL] = useState<string>("http://localhost:9090");
  const [contractOutPointTx, setContractOutPointTx] = useState<string>("0x4e2e832e0b1e7b5994681b621b00c1e65f577ee4b440ef95fa07db9bb3d50269");
  const [contractOutPointIndex, setContractOutPointIndex] = useState<string>("0");
  const [activeTrait, setActiveTrait] = useState<"UDT" | "UDTPausable">("UDT");
  const [methodList, setMethodList] = useState<string[]>([]);
  const [activeMethod, setActiveMethod] = useState<string>("name");
  const [methodParams, setMethodParams] = useState<any[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [ssriParams, setSSRIParams] = useState<any>({});
  const [methodResult, setMethodResult] = useState<any>(undefined);
  const [ssriPayload, setSSRIPayload] = useState<any>(null);
  const [iconDataURL, setIconDataURL] = useState<string>('')

  useEffect(() => {
    if (activeTrait === "UDT") {
      console.log("UDT methods:", Object.getOwnPropertyNames(UDT.prototype));
      const methods = Object.getOwnPropertyNames(UDT.prototype).filter(name =>
        name !== 'constructor' &&
        typeof (UDT.prototype as any)[name] === 'function'
      );
      setMethodList(methods);
      if (!methods.includes(activeMethod)) {
        setActiveMethod(methods[0] || "");
      }
    } else {
      console.log("UDTPausable methods:", Object.getOwnPropertyNames(UDTPausable.prototype));
      const methods = Object.getOwnPropertyNames(UDTPausable.prototype).filter(name =>
        name !== 'constructor' &&
        typeof (UDTPausable.prototype as any)[name] === 'function'
      );
      setMethodList(methods);
      if (!methods.includes(activeMethod)) {
        setActiveMethod(methods[0] || "");
      }
    }
  }, [activeMethod, activeTrait]);

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
      // Prepare arguments based on the number of parameters the method expects
      const args = methodParams.map((paramType, index) => {
        const value = paramValues[`param${index}`];
        // If the parameter is a Script array, map to the correct format
        const isArray = paramType.name?.toLowerCase().includes('array');
        if (isArray) {
          // Ensure value is parsed from JSON string
          const parsedArray = typeof value === 'string'
            ? JSON.parse(value)
            : Array.isArray(value)
              ? value
              : [];

          console.log("Parsed Array", parsedArray)
          return parsedArray;
        }
        const isHashes = paramType.name?.toLowerCase().includes('hashes');
        if (isHashes) {
          // Ensure value is parsed from JSON string
          const parsedArray = typeof value === 'string'
            ? JSON.parse(value)
            : Array.isArray(value)
              ? value
              : [];

          console.log("Parsed Hashes", parsedArray)
          return parsedArray;
        }
        console.log("Value", value)
        return value;
      });
      console.log("Args", args);

      const ssriParamsWithSigner = { ...ssriParams, signer: signer };

      setSSRIPayload({
        trait: activeTrait,
        method: activeMethod,
        args: args,
        contractOutPoint: testOutPoint,
        ssriParams: ssriParamsWithSigner,
      });

      log(
        "Calling method", String(activeMethod),
        "with args", String(args),
        "on contract", String(activeTrait),
        "at", String(contractOutPointTx),
        "index", String(contractOutPointIndex)
      );

      let result;
      if (methodParams.length === 0) {
        // Method takes no parameters except optional ssriParams
        result = await (contract as any)[activeMethod](ssriParamsWithSigner);
      } else {
        // Method takes parameters plus optional ssriParams
        result = await (contract as any)[activeMethod](...args, ssriParamsWithSigner);
      }
      // Convert result to a string representation for React rendering

      // Store the full payload for JSON view
      // Special handling for icon method                                                                                                                                                                                                                                                      
      if (activeTrait === 'UDT' && activeMethod === 'icon' && result instanceof Uint8Array) {
        const dataURL = result.toString();;
        setIconDataURL(dataURL);
      } else {
        setMethodResult(result);
      }
    } catch (e) {
      const errorMessage = e instanceof Error
        ? e.message
        : typeof e === 'object'
          ? JSON.stringify(e)
          : String(e);

      setMethodResult(`Error: ${errorMessage}`);
      // error(`Error: ${errorMessage}`);
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

      <div className="flex flex-row items-center gap-2 w-full">
        <label className="min-w-32 shrink-0">Contract Type:</label>
        <Dropdown
          options={[
            { name: "UDT", displayName: "UDT", iconName: "Pill" },
            { name: "UDTPausable", displayName: "UDTPausable", iconName: "Pill" }
          ]}
          selected={activeTrait}
          onSelect={(item) => setActiveTrait(item as "UDT" | "UDTPausable")}
          className="flex-grow"
        />
      </div>

      <div className="flex flex-row items-center gap-2 w-full">
        <label className="min-w-32 shrink-0">Method:</label>
        <Dropdown
          options={methodList.map((method) => ({
            name: method,
            displayName: method,
            iconName: "Pill",
          }))}
          selected={activeMethod || (methodList.length > 0 ? methodList[0] : "")}
          onSelect={setActiveMethod}
          className="flex-grow"
        />
      </div>

      {methodParams.map((paramType, index) => {
        const isScriptArray = paramType.name?.includes('toLockArray');

        if (isScriptArray) {
          return (
            <ScriptArrayInput
              key={`${activeMethod}-param-${index}`}
              label={`Parameter ${index + 1} (${paramType.name})`}
              value={
                Array.isArray(paramValues[`param${index}`])
                  ? paramValues[`param${index}`]
                  : paramValues[`param${index}`] && typeof paramValues[`param${index}`] === 'string'
                    ? JSON.parse(paramValues[`param${index}`])
                    : []
              }
              onChange={(scripts) => setParamValues(prev => {
                const newValues = { ...prev };
                newValues[`param${index}`] = JSON.stringify(scripts);
                return newValues;
              })}
            />
          );
        }

        return (
          <TextInput
            key={`${activeMethod}-param-${index}`}
            label={`Parameter ${index + 1} (${paramType.name})`}
            placeholder={`Enter ${paramType.name} value`}
            state={[
              paramValues[`param${index}`] || '',
              (value) => setParamValues(prev => ({ ...prev, [`param${index}`]: value }))
            ]}
          />
        );
      })}

      <SSRIParamsInput
        params={ssriParams}
        onChange={setSSRIParams}
      />

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">SSRI Payload</label>
        {ssriPayload && (
          <div className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
            <JsonView
              value={ssriPayload}
              style={darkTheme}
            />
          </div>
        )}
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">Method Result</label>
        {methodResult && (<div className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
          <JsonView
            value={{ result: methodResult }}
            style={darkTheme}
          />
        </div>)}
      </div>
      {iconDataURL && (<div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">Icon Result</label>
        <Image
          className="max-w-full h-auto border rounded" src={iconDataURL} alt={""} width={"100"} height={"100"}></Image>
      </div>)}
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
