"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/src/components/Button";
import { TextInput } from "@/src/components/Input";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { Dropdown } from "@/src/components/Dropdown";
import { ssri } from "@ckb-ccc/ssri";
import { udt } from "@ckb-ccc/udt";
import { ccc } from "@ckb-ccc/connector-react";
import "reflect-metadata";
import JsonView from "@uiw/react-json-view";
import { darkTheme } from "@uiw/react-json-view/dark";
import Image from "next/image";

interface ScriptInputProps {
  value: { codeHash: string; hashType: string; args: string };
  onChange: (value: {
    codeHash: string;
    hashType: string;
    args: string;
  }) => void;
  onRemove?: () => void;
}

const ScriptInput: React.FC<ScriptInputProps> = ({
  value,
  onChange,
  onRemove,
}) => (
  <div className="flex w-full flex-col gap-2 rounded border p-2">
    <TextInput
      label="Code Hash"
      placeholder="Enter code hash"
      state={[value.codeHash, (codeHash) => onChange({ ...value, codeHash })]}
      className="w-full"
    />
    <div className="flex flex-row items-center gap-2">
      <label className="min-w-24">Hash Type:</label>
      <Dropdown
        options={[
          { name: "type", displayName: "Type", iconName: "Pill" },
          { name: "data", displayName: "Data", iconName: "Pill" },
          { name: "data1", displayName: "Data1", iconName: "Pill" },
          { name: "data2", displayName: "Data2", iconName: "Pill" },
        ]}
        selected={value.hashType}
        onSelect={(hashType) => onChange({ ...value, hashType })}
        className="flex-grow"
      />
    </div>
    <TextInput
      label="Args"
      placeholder="Enter args"
      state={[value.args, (args) => onChange({ ...value, args })]}
      className="w-full"
    />
    {onRemove && (
      <Button
        onClick={onRemove}
        className="self-start rounded bg-red-500 px-2 py-1 text-white"
      >
        Remove
      </Button>
    )}
  </div>
);

interface ScriptArrayInputProps {
  value: { codeHash: string; hashType: string; args: string }[];
  onChange: (
    value: { codeHash: string; hashType: string; args: string }[],
  ) => void;
  label?: string;
}

type ScriptType = {
  codeHash: string;
  hashType: string;
  args: string;
};

const ScriptArrayInput: React.FC<ScriptArrayInputProps> = ({
  value = [],
  onChange,
  label = "Scripts",
}) => {
  const addScript = () => {
    onChange([...value, { codeHash: "", hashType: "type", args: "" }]);
  };

  const removeScript = (index: number) => {
    const newScripts = [...value];
    newScripts.splice(index, 1);
    onChange(newScripts);
  };

  const updateScript = (
    index: number,
    script: { codeHash: string; hashType: string; args: string },
  ) => {
    const newScripts = [...value];
    newScripts[index] = script;
    onChange(newScripts);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="font-semibold">{label}</label>
      {value.map((script: ScriptType, index) => (
        <ScriptInput
          key={index}
          value={script}
          onChange={(updatedScript) => updateScript(index, updatedScript)}
          onRemove={() => removeScript(index)}
        />
      ))}
      <Button
        onClick={addScript}
        className="self-start rounded bg-green-500 px-2 py-1 text-white"
      >
        Add Script
      </Button>
    </div>
  );
};

type ParamValue =
  | string
  | ScriptType[]
  | ccc.ScriptLike
  | ccc.CellLike
  | ccc.TransactionLike;

interface MethodParam {
  name: string;
}

type ScriptContext = {
  codeHash: string;
  hashType: string;
  args: string;
};

export default function SSRI() {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("SSRI");

  const [SSRIServerURL, setSSRIServerURL] = useState<string>(
    "http://localhost:9090",
  );
  const [contractOutPointTx, setContractOutPointTx] = useState<string>(
    "0x4e2e832e0b1e7b5994681b621b00c1e65f577ee4b440ef95fa07db9bb3d50269",
  );
  const [contractOutPointIndex, setContractOutPointIndex] =
    useState<string>("0");
  const [activeTrait, setActiveTrait] = useState<"UDT" | "UDTPausable">("UDT");
  const [methodList, setMethodList] = useState<string[]>([]);
  const [activeMethod, setActiveMethod] = useState<string>("name");
  const [methodParams, setMethodParams] = useState<MethodParam[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, ParamValue>>(
    {},
  );
  const [ssriContext, setSSRIContext] = useState<any>({});
  const [methodResult, setMethodResult] = useState<any>(undefined);
  const [ssriPayload, setSSRIPayload] = useState<any>(null);
  const [iconDataURL, setIconDataURL] = useState<string>("");
  const [udtType, setUdtType] = useState<"ssri" | "xudt">("xudt");
  const [xudtArgs, setXudtArgs] = useState<string>("");
  const [availableTraits, setAvailableTraits] = useState<
    ("UDT" | "UDTPausable")[]
  >([]);
  const [ssriContractTypeArgs, setSsriContractTypeArgs] = useState<string>(
    "0xb5202efa0f2d250af66f0f571e4b8be8b272572663707a052907f8760112fe35",
  );

  useEffect(() => {
    if (udtType === "ssri") {
      setAvailableTraits(["UDT", "UDTPausable"]);
    } else if (udtType === "xudt") {
      setAvailableTraits(["UDT"]);
    }
  }, [udtType]);

  useEffect(() => {
    if (activeTrait === "UDT") {
      const methods = Object.getOwnPropertyNames(udt.UDT.prototype).filter(
        (name) =>
          name !== "constructor" &&
          typeof (udt.UDT.prototype as any)[name] === "function",
      );
      setMethodList(methods);
      if (!methods.includes(activeMethod)) {
        setActiveMethod(methods[0] || "");
      }
    } else if (activeTrait === "UDTPausable") {
      const methods = Object.getOwnPropertyNames(
        udt.UDTPausable.prototype,
      ).filter(
        (name) =>
          name !== "constructor" &&
          typeof (udt.UDTPausable.prototype as any)[name] === "function",
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
    const testSSRIServer = new ssri.Server(SSRIServerURL);

    let contract;
    try {
      if (udtType === "ssri") {
        const testOutPoint = {
          txHash: contractOutPointTx,
          index: parseInt(contractOutPointIndex),
        };

        const cellDep = ccc.CellDep.from({
          outPoint: testOutPoint,
          depType: "code",
        });

        const type = ccc.Script.from({
          codeHash: cellDep.hash(),
          hashType: "type",
          args: ssriContractTypeArgs,
        });

        // Check UDT methods
        if (activeTrait === "UDT") {
          contract = new udt.UDT(type, cellDep, testSSRIServer);
        } else if (activeTrait === "UDTPausable") {
          contract = new udt.UDTPausable(type, cellDep, testSSRIServer);
        }
      } else if (udtType === "xudt") {
        // xUDT instantiation (always UDT trait)
        const script = await ccc.Script.fromKnownScript(
          signer.client,
          ccc.KnownScript.XUdt,
          xudtArgs,
        );

        const scriptInfo = await signer.client.getKnownScript(
          ccc.KnownScript.XUdt,
        );

        contract = new udt.UDT(
          script,
          scriptInfo.cellDeps[0].cellDep,
          testSSRIServer,
        );
      }

      // Prepare arguments based on the number of parameters the method expects
      const args = methodParams.map((paramType, index) => {
        const value = paramValues[`param${index}`];
        // If the parameter is a Script array, map to the correct format
        const isArray = paramType.name?.toLowerCase().includes("array");
        if (isArray) {
          // Ensure value is parsed from JSON string
          const parsedArray =
            typeof value === "string"
              ? JSON.parse(value)
              : Array.isArray(value)
                ? value
                : [];

          return parsedArray;
        }
        const isHashes = paramType.name?.toLowerCase().includes("hashes");
        if (isHashes) {
          // Ensure value is parsed from JSON string
          const parsedArray =
            typeof value === "string"
              ? JSON.parse(value)
              : Array.isArray(value)
                ? value
                : [];

          return parsedArray;
        }
        const isTransaction = paramType.name
          ?.toLowerCase()
          .includes("tx") || paramType.name?.toLowerCase().includes("transaction");
        if (isTransaction && value) {
          const hexData = value as string;
          if (hexData && !hexData.startsWith("0x")) {
            throw new Error("Transaction data must be 0x-prefixed hex string");
          }
          return ccc.Transaction.fromBytes(ccc.bytesFrom(hexData));
        }
        return value;
      });

      const ssriContextWithSigner = { ...ssriContext, signer: signer };

      setSSRIPayload({
        trait: activeTrait,
        method: activeMethod,
        args: args,
        contractOutPoint: {
          txHash: contractOutPointTx,
          index: parseInt(contractOutPointIndex),
        },
        ssriContext: ssriContextWithSigner,
      });

      log(
        "Calling method",
        String(activeMethod),
        "with args",
        String(args),
        "on contract",
        String(activeTrait),
        "at",
        String(contractOutPointTx),
        "index",
        String(contractOutPointIndex),
      );

      let result;
      if (methodParams.length === 0) {
        // Method takes no parameters except optional ssriParams
        result = await (contract as any)[activeMethod]();
      } else {
        // Method takes parameters plus optional ssriParams
        result = await (contract as any)[activeMethod](...args);
      }
      // Convert result to a string representation for React rendering

      // Store the full payload for JSON view
      // Special handling for icon method
      if (
        activeTrait === "UDT" &&
        activeMethod === "icon" &&
        result instanceof Uint8Array
      ) {
        const dataURL = result.toString();
        setMethodResult(result);
        setIconDataURL(dataURL);
      } else {
        setMethodResult(result);
      }
    } catch (e) {
      const errorMessage =
        e instanceof Error
          ? e.message
          : typeof e === "object"
            ? JSON.stringify(e)
            : String(e);

      setMethodResult(`Error: ${errorMessage}`);
      // error(`Error: ${errorMessage}`);
    }
  };

  return (
    <div className="flex w-full flex-col items-stretch gap-4">
      <div className="flex w-full flex-row items-center gap-2">
        <label className="min-w-32 shrink-0">UDT Type:</label>
        <Dropdown
          options={[
            {
              name: "ssri",
              displayName: "SSRI-Compliant UDT",
              iconName: "Coins",
            },
            {
              name: "xudt",
              displayName: "xUDT (Legacy Support with ckb-udt-indexer)",
              iconName: "Coins",
            },
          ]}
          selected={udtType}
          onSelect={(value) => setUdtType(value as "ssri" | "xudt")}
          className="flex-grow"
        />
      </div>

      {udtType === "ssri" ? (
        <>
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
          <TextInput
            label="Type Args"
            placeholder="Enter type script args"
            state={[ssriContractTypeArgs, setSsriContractTypeArgs]}
          />
        </>
      ) : (
        <TextInput
          label="xUDT Args"
          placeholder="Enter xUDT args"
          state={[xudtArgs, setXudtArgs]}
        />
      )}

      <div className="flex w-full flex-row items-center gap-2">
        <label className="min-w-32 shrink-0">Traits:</label>
        <Dropdown
          options={availableTraits.map((trait) => ({
            name: trait,
            displayName: trait,
            iconName: "Pill",
          }))}
          selected={activeTrait}
          onSelect={(item) => setActiveTrait(item as "UDT" | "UDTPausable")}
          className="flex-grow"
        />
      </div>

      <div className="flex w-full flex-row items-center gap-2">
        <label className="min-w-32 shrink-0">Method to Call:</label>
        <Dropdown
          options={methodList.map((method) => ({
            name: method,
            displayName: method,
            iconName: "Pill",
          }))}
          selected={
            activeMethod || (methodList.length > 0 ? methodList[0] : "")
          }
          onSelect={setActiveMethod}
          className="flex-grow"
        />
      </div>

      {methodParams.map((paramType, index) => {
        const isScriptArray = paramType.name?.includes("toLockArray");
        const isScript = paramType.name?.toLowerCase().includes("script");
        const isCell = paramType.name?.toLowerCase().includes("cell");
        const isTransaction = paramType.name
          ?.toLowerCase()
          .includes("transaction");

        if (isScriptArray) {
          return (
            <ScriptArrayInput
              key={`${activeMethod}-param-${index}`}
              label={`Parameter ${index + 1} (${paramType.name})`}
              value={
                Array.isArray(paramValues[`param${index}`])
                  ? (paramValues[`param${index}`] as ScriptType[])
                  : typeof paramValues[`param${index}`] === "string"
                    ? JSON.parse(paramValues[`param${index}`] as string)
                    : []
              }
              onChange={(scripts) =>
                setParamValues((prev) => ({
                  ...prev,
                  [`param${index}`]: scripts,
                }))
              }
            />
          );
        }

        if (isScript) {
          return (
            <details key={`${activeMethod}-param-${index}`}>
              <summary className="cursor-pointer font-bold">
                Parameter {index + 1} ({paramType.name})
              </summary>
              <div className="flex flex-col gap-2 pl-4 pt-2">
                <TextInput
                  label="Code Hash"
                  placeholder="Enter code hash"
                  state={[
                    (
                      paramValues[`param${index}`] as ccc.ScriptLike
                    )?.codeHash?.toString() || "",
                    (value) =>
                      setParamValues((prev) => ({
                        ...prev,
                        [`param${index}`]: {
                          ...((prev[`param${index}`] as ccc.ScriptLike) || {}),
                          codeHash: value,
                        },
                      })),
                  ]}
                />
                <div className="flex flex-row items-center gap-2">
                  <label className="min-w-32">Hash Type:</label>
                  <Dropdown
                    options={[
                      { name: "type", displayName: "Type", iconName: "Hash" },
                      { name: "data", displayName: "Data", iconName: "Hash" },
                      { name: "data1", displayName: "Data1", iconName: "Hash" },
                      { name: "data2", displayName: "Data2", iconName: "Hash" },
                    ]}
                    selected={
                      ((paramValues[`param${index}`] as ccc.ScriptLike)
                        ?.hashType as string) || "type"
                    }
                    onSelect={(value) =>
                      setParamValues((prev) => ({
                        ...prev,
                        [`param${index}`]: {
                          ...((prev[`param${index}`] as ccc.ScriptLike) || {}),
                          hashType: value,
                        },
                      }))
                    }
                  />
                </div>
                <TextInput
                  label="Args"
                  placeholder="Enter args"
                  state={[
                    ((paramValues[`param${index}`] as ccc.ScriptLike)
                      ?.args as string) || "",
                    (value) =>
                      setParamValues((prev) => ({
                        ...prev,
                        [`param${index}`]: {
                          ...((prev[`param${index}`] as ccc.ScriptLike) || {}),
                          args: value,
                        },
                      })),
                  ]}
                />
              </div>
            </details>
          );
        }

        if (isCell) {
          return (
            <details key={`${activeMethod}-param-${index}`} open>
              <summary className="cursor-pointer font-bold">
                Parameter {index + 1} ({paramType.name})
              </summary>
              <div className="flex flex-col gap-2 pl-4 pt-2">
                <TextInput
                  label="Capacity"
                  placeholder="Enter capacity"
                  state={[
                    (
                      paramValues[`param${index}`] as ccc.CellLike
                    )?.cellOutput?.capacity?.toString() || "",
                    (value) =>
                      setParamValues((prev) => ({
                        ...prev,
                        [`param${index}`]: {
                          outPoint: {
                            txHash: "0x",
                            index: 0,
                          },
                          cellOutput: {
                            capacity: value,
                            lock: {
                              codeHash: "",
                              hashType: "type" as const,
                              args: "",
                            },
                          },
                          outputData:
                            (prev[`param${index}`] as ccc.CellLike)
                              ?.outputData || "",
                        } as ccc.CellLike,
                      })),
                  ]}
                />
                <TextInput
                  label="Data"
                  placeholder="Enter cell data"
                  state={[
                    (
                      paramValues[`param${index}`] as ccc.CellLike
                    )?.outputData?.toString() || "",
                    (value) =>
                      setParamValues((prev) => ({
                        ...prev,
                        [`param${index}`]: {
                          outPoint: {
                            txHash: "0x",
                            index: 0,
                          },
                          cellOutput: {
                            capacity:
                              (
                                prev[`param${index}`] as ccc.CellLike
                              )?.cellOutput?.capacity?.toString() || "",
                            lock: {
                              codeHash: "",
                              hashType: "type" as const,
                              args: "",
                            },
                          },
                          outputData: value,
                        } as ccc.CellLike,
                      })),
                  ]}
                />
              </div>
            </details>
          );
        }

        if (isTransaction) {
          return (
            <details key={`${activeMethod}-param-${index}`}>
              <summary className="cursor-pointer font-bold">
                Parameter {index + 1} ({paramType.name})
              </summary>
              <div className="flex flex-col gap-2 pl-4 pt-2">
                <TextInput
                  label="Transaction Data (Hex)"
                  placeholder="Enter transaction data in hex format"
                  state={[
                    (paramValues[`param${index}`] as string) || "",
                    (value) =>
                      setParamValues((prev) => ({
                        ...prev,
                        [`param${index}`]: value,
                      })),
                  ]}
                />
                <div className="text-sm text-gray-600">
                  Enter the transaction data in hex format (0x-prefixed). The
                  data will be parsed using Transaction.fromBytes.
                </div>
              </div>
            </details>
          );
        }

        return (
          <TextInput
            key={`${activeMethod}-param-${index}`}
            label={`Parameter ${index + 1} (${paramType.name})`}
            placeholder={`Enter ${paramType.name} value`}
            state={[
              (paramValues[`param${index}`] || "") as string,
              (value: string) =>
                setParamValues((prev) => ({
                  ...prev,
                  [`param${index}`]: value,
                })),
            ]}
          />
        );
      })}

      {udtType === "ssri" && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">
            SSRI Payload
          </label>
          {ssriPayload && (
            <div className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
              <JsonView value={ssriPayload} style={darkTheme} />
            </div>
          )}
        </div>
      )}

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">
          Method Result
        </label>
        {methodResult && (
          <div className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
            <JsonView value={{ result: methodResult }} style={darkTheme} />
          </div>
        )}
      </div>
      {iconDataURL && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">
            Icon Result
          </label>
          <Image
            className="h-auto max-w-full rounded border"
            src={iconDataURL}
            alt={""}
            width={"100"}
            height={"100"}
          ></Image>
        </div>
      )}
      <ButtonsPanel>
        <Button onClick={makeSSRICall}>Execute Method</Button>
      </ButtonsPanel>
    </div>
  );
}

const getMethodParameters = (
  trait: "UDT" | "UDTPausable",
  methodName: string,
): MethodParam[] => {
  const TraitClass = trait === "UDT" ? udt.UDT : udt.UDTPausable;
  const method = (TraitClass.prototype as any)[methodName];
  if (!method) {
    return [];
  }

  const params = Reflect.getMetadata(
    "design:paramtypes",
    TraitClass.prototype,
    methodName,
  );

  if (!params) {
    // Try getting parameter information from function definition
    const funcStr = method.toString();
    const paramMatch = funcStr.match(/\((.*?)\)/);
    if (paramMatch) {
      const paramNames: string[] = paramMatch[1]
        .split(",")
        .map((p: string) => p.trim())
        .filter((p: string) => p);
      if (paramNames.at(-1) === "params") {
        return paramNames.slice(0, -1).map((name: string) => ({ name }));
      }
      return paramNames.map((name: any) => ({ name }));
    }
  }

  return params || [];
};
