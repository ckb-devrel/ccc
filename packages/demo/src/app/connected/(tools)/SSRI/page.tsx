"use client";

import "reflect-metadata";
import React, { useState, useEffect } from "react";
import { Button } from "@/src/components/Button";
import { TextInput } from "@/src/components/Input";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { Dropdown } from "@/src/components/Dropdown";
import {
  ScriptAmountArrayInput,
  ScriptAmountType,
} from "@/src/components/ScriptAmountInput";
import { ssri } from "@ckb-ccc/ssri";
import { ccc } from "@ckb-ccc/connector-react";
import JsonView from "@uiw/react-json-view";
import { darkTheme } from "@uiw/react-json-view/dark";
import Image from "next/image";
import { HexArrayInput } from "@/src/components/HexArrayInput";

type ParamValue =
  | string
  | ScriptAmountType[]
  | ccc.ScriptLike
  | ccc.CellLike
  | ccc.TransactionLike
  | boolean
  | undefined
  | ccc.HexLike[];

type MethodParamType =
  | "contextScript"
  | "contextCell"
  | "contextTransaction"
  | "scriptAmountArray"
  | "scriptArray"
  | "tx"
  | "signer"
  | "hexArray"
  | "hex"
  | "stringArray";

interface MethodParam {
  name: string;
  type?: MethodParamType;
}

type ScriptContext = {
  codeHash: string;
  hashType: string;
  args: string;
};

const SSRI_BUILT_IN_METHODS = ["getMethods", "hasMethods", "version"];
const MODE_OPTIONS = [
  {
    name: "builtin",
    displayName: "Built-in SSRI method",
    iconName: "Hash" as const,
  },
  {
    name: "custom",
    displayName: "Custom trait and method",
    iconName: "Hash" as const,
  },
];

type IconName = "Hash" | "Code";

const PARAM_TYPE_OPTIONS: {
  name: string;
  displayName: string;
  iconName: IconName;
}[] = [
  { name: "contextScript", displayName: "Context Script", iconName: "Code" },
  { name: "contextCell", displayName: "Context Cell", iconName: "Code" },
  {
    name: "contextTransaction",
    displayName: "Context Transaction",
    iconName: "Code",
  },
  {
    name: "scriptAmountArray",
    displayName: "Script Amount Array",
    iconName: "Code",
  },
  { name: "scriptArray", displayName: "Script Array", iconName: "Code" },
  { name: "tx", displayName: "Transaction", iconName: "Code" },
  { name: "signer", displayName: "Signer", iconName: "Code" },
  // { name: "hexArray", displayName: "Hex Array", iconName: "Code" },
  { name: "hex", displayName: "Generic Data (HexLike)", iconName: "Code" },
  {
    name: "stringArray",
    displayName: "String Array (comma-separated)",
    iconName: "Code",
  },
];

export default function SSRI() {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("SSRI");

  const [SSRIExecutorURL, setSSRIExecutorURL] = useState<string>(
    "http://localhost:9090",
  );
  const [contractOutPointTx, setContractOutPointTx] = useState<string>("");
  const [contractOutPointIndex, setContractOutPointIndex] =
    useState<string>("0");
  const [methodParams, setMethodParams] = useState<MethodParam[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, ParamValue>>(
    {},
  );
  const [ssriContext, setSSRIContext] = useState<any>({});
  const [methodResult, setMethodResult] = useState<any>(undefined);
  const [SSRICallDetails, setSSRICallDetails] = useState<any>(null);
  const [iconDataURL, setIconDataURL] = useState<string>("");
  const [ssriInstantiationType, setSsriInstantiationType] = useState<
    "outpoint" | "typeid"
  >("typeid");
  const [ssriContractTypeIDArgs, setSsriContractTypeIDArgs] = useState<string>(
    "0x8fd55df879dc6176c95f3c420631f990ada2d4ece978c9512c39616dead2ed56",
  );
  const [showSSRICallDetails, setShowSSRICallDetails] =
    useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [traitName, setTraitName] = useState<string>("");
  const [methodName, setMethodName] = useState<string>("getMethods");
  const [isBuiltIn, setIsBuiltIn] = useState(true);
  const [selectedParamType, setSelectedParamType] =
    useState<MethodParamType>("contextScript");
  const [methodPathInput, setMethodPathInput] = useState<string>("");

  const addMethodParam = () => {
    const contextTypes = ["contextScript", "contextCell", "contextTransaction"];
    const hasContextParam = methodParams.some(
      (param) => param.type && contextTypes.includes(param.type),
    );

    if (contextTypes.includes(selectedParamType) && hasContextParam) {
      error(
        "Invalid Parameter: You can only have one context parameter (Script, Cell, or Transaction)",
      );
      return;
    }

    setMethodParams([
      ...methodParams,
      {
        name: `param${methodParams.length}`,
        type: selectedParamType,
      },
    ]);
  };

  const deleteMethodParam = (index: number) => {
    setMethodParams(methodParams.filter((_, i) => i !== index));
  };

  const makeSSRICall = async () => {
    if (!signer) return;

    setIsLoading(true);
    setMethodResult(undefined);
    setIconDataURL("");

    const testSSRIExecutor = new ssri.ExecutorJsonRpc(SSRIExecutorURL);

    let contract: ssri.Trait | undefined;
    try {
      let testOutPoint;
      let scriptCell;
      if (ssriInstantiationType === "outpoint") {
        testOutPoint = {
          txHash: contractOutPointTx,
          index: parseInt(contractOutPointIndex),
        };
        scriptCell = await signer.client.getCell(testOutPoint);
      } else {
        scriptCell = await signer.client.findSingletonCellByType({
          // TypeID Code Hash. Don't change
          codeHash:
            "0x00000000000000000000000000000000000000000000000000545950455f4944",
          hashType: "type",
          // TypeID args. Change it to the args of the Type ID script of your UDT
          args: ssriContractTypeIDArgs,
        });
        if (!scriptCell) {
          throw new Error("PUDT script cell not found");
        }
        testOutPoint = scriptCell.outPoint;
      }
      if (!scriptCell) {
        throw new Error("Script cell not found");
      }

      if (!scriptCell.cellOutput.type?.hash()) {
        throw new Error("Script cell type hash not found");
      }
      contract = new ssri.Trait(scriptCell.outPoint, testSSRIExecutor);

      // Check contract is defined before using
      if (!contract) {
        throw new Error("Contract not initialized");
      }

      // Initialize context object
      let context = {};

      // Prepare arguments, separating context params from regular args
      const args = methodParams
        .filter(
          (paramType) =>
            !["contextScript", "contextCell", "contextTransaction"].includes(
              paramType.type || "",
            ),
        )
        .map((paramType, index) => {
          let value = paramValues[`param${index}`];

          if (paramType.type === "signer") {
            return signer;
          }
          if (paramType.type === "scriptAmountArray") {
            value = paramValues[`param${index}`] as ScriptAmountType[];
            return value.map((scriptAmount) => ({
              to: scriptAmount.script,
              amount: scriptAmount.amount,
            }));
          }
          // ... rest of existing param type handling ...
          return value;
        });

      // Handle context parameters separately
      methodParams.forEach((paramType, index) => {
        const value = paramValues[`param${index}`];
        if (paramType.type === "contextScript") {
          context = { script: value as ccc.ScriptLike };
        } else if (paramType.type === "contextCell") {
          context = { cell: value as ccc.CellLike };
        } else if (paramType.type === "contextTransaction") {
          context = { transaction: value as ccc.TransactionLike };
        }
      });

      setSSRIContext(context);
      setSSRICallDetails({
        trait: traitName,
        method: methodName,
        args: args,
        contractOutPoint: {
          txHash: contractOutPointTx,
          index: parseInt(contractOutPointIndex),
        },
        ssriContext: context,
      });

      log(
        "Calling method",
        methodName,
        "on contract",
        traitName,
        "at",
        String(contractOutPointTx),
        "index",
        String(contractOutPointIndex),
      );
      let result;
      if (isBuiltIn) {
        // Type-safe way to call built-in methods
        switch (methodName) {
          case "getMethods":
            result = await contract.getMethods();
            break;
          case "hasMethods":
            result = await contract.hasMethods(
              (args[0] as string[]) ?? [],
              (args[1] as ccc.HexLike[]) ?? [],
            );
            break;
          case "version":
            result = await contract.version();
            break;
        }
      } else {
        let argsHex = methodParams.map((param, index) => {
          const arg = args[index];

          switch (param.type) {
            case "contextScript":
            case "contextCell":
            case "contextTransaction":
              // Context params are handled separately in context object
              return "0x";

            case "scriptAmountArray":
            case "scriptArray":
              // These are already properly formatted in the args preparation above
              return ccc.hexFrom(JSON.stringify(arg));

            case "tx":
              // Transaction data should already be in hex format
              return (arg as string) || "0x";

            case "signer":
              // Signer is handled specially in args preparation
              return "0x";

            case "hex":
              // Single hex value, should already be 0x-prefixed
              return arg as string;

            case "stringArray":
              // Array of strings
              return ccc.hexFrom(JSON.stringify(arg));

            default:
              throw new Error(`Unsupported parameter type: ${param.type}`);
          }
        });
        result = await contract
          .assertExecutor()
          .runScript(contract.code, `${traitName}.${methodName}`, argsHex);
      }
      if (result) {
        if (traitName === "UDT" && methodName === "icon") {
          const dataURL = ccc.bytesTo(result.res as string, "utf8");
          setMethodResult(result);
          setIconDataURL(dataURL);
        } else {
          setMethodResult(result);
        }
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-stretch gap-4">
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-4 text-2xl font-bold text-gray-800 dark:text-white">
          How to Use:
        </h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-semibold text-white">
              1
            </span>
            <div className="flex-1 text-gray-800 dark:text-gray-100">
              <code className="rounded bg-blue-50 px-2 py-1 font-mono text-sm text-blue-900 dark:bg-blue-900 dark:text-blue-100">
                docker run -p 9090:9090 hanssen0/ckb-ssri-server
              </code>
              <span className="ml-2">to start a local SSRI server.</span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-semibold text-white">
              2
            </span>
            <div className="flex-1 text-gray-800 dark:text-gray-100">
              The default parameters are prepared to just work. Just click{" "}
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                Execute Method
              </span>{" "}
              button at the bottom to call the{" "}
              <code className="rounded bg-blue-50 px-2 py-1 font-mono text-sm text-blue-900 dark:bg-blue-900 dark:text-blue-100">
                SSRI.get_methods
              </code>{" "}
              method.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-semibold text-white">
              3
            </span>
            <div className="flex-1 text-gray-800 dark:text-gray-100">
              All Done! You called an SSRI method! Try playing with other methods
              while reading{" "}
              <a
                href="https://talk.nervos.org/t/en-cn-script-sourced-rich-information-script/8256"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 underline hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                [EN/CN] Script-Sourced Rich Information - 来源于 Script 的富信息
              </a>{" "}
              to know how to adjust parameters to your need.
            </div>
          </div>
        </div>
      </div>
      <>
        <TextInput
          label="SSRI Executor URL"
          placeholder="URL of the SSRI executor"
          state={[SSRIExecutorURL, setSSRIExecutorURL]}
        />
        <div className="flex w-full flex-row items-center gap-2">
          <label className="min-w-32 shrink-0">
            SSRI Trait Instantiation Type:
          </label>
          <Dropdown
            options={[
              { name: "outpoint", displayName: "OutPoint", iconName: "Hash" },
              { name: "typeid", displayName: "Type ID", iconName: "Hash" },
            ]}
            selected={ssriInstantiationType}
            onSelect={(value) =>
              setSsriInstantiationType(value as "outpoint" | "typeid")
            }
            className="flex-grow"
          />
        </div>

        {ssriInstantiationType === "outpoint" ? (
          <>
            <TextInput
              label="Script Cell OutPoint Tx"
              placeholder="Tx hash of the Script cell outpoint"
              state={[contractOutPointTx, setContractOutPointTx]}
            />
            <TextInput
              label="Script Cell OutPoint Index"
              placeholder="Index of the script cell outpoint"
              state={[contractOutPointIndex, setContractOutPointIndex]}
            />
          </>
        ) : (
          <>
            <TextInput
              label="Script Cell Type ID Args"
              placeholder="Type ID Args of the script cell"
              state={[ssriContractTypeIDArgs, setSsriContractTypeIDArgs]}
            />
          </>
        )}

        <div className="flex flex-row items-center gap-4">
          <label className="min-w-32 shrink-0">Method to Call:</label>
          <Dropdown
            options={MODE_OPTIONS}
            selected={isBuiltIn ? "builtin" : "custom"}
            onSelect={(value) => {
              setIsBuiltIn(value === "builtin");
              if (value === "builtin") {
                setTraitName("SSRI");
                setMethodName(SSRI_BUILT_IN_METHODS[0]);
                if (methodName === "hasMethods") {
                  setMethodParams([
                    { name: "methodNames", type: "stringArray" },
                    { name: "extraMethodPaths", type: "hexArray" },
                  ]);
                }
              } else {
                setTraitName("");
                setMethodName("");
              }
            }}
            className="w-1/4"
          />

          {isBuiltIn ? (
            <Dropdown
              options={SSRI_BUILT_IN_METHODS.map((method) => ({
                name: method,
                displayName: method,
                iconName: "Code",
              }))}
              selected={methodName}
              onSelect={(value) => {
                setMethodName(value);
                if (value === "hasMethods") {
                  setMethodParams([
                    { name: "methodNames", type: "stringArray" },
                    { name: "extraMethodPaths", type: "hexArray" },
                  ]);
                } else {
                  setMethodParams([]); // Clear params for other methods
                }
              }}
              className="flex-1"
            />
          ) : (
            <>
              <TextInput
                label="SSRI Trait Name"
                placeholder="Enter the trait name"
                state={[traitName, setTraitName]}
                className="w-1/4"
              />
              <TextInput
                label="Method Name"
                placeholder="Enter the method name"
                state={[methodName, setMethodName]}
                className="flex-1"
              />
            </>
          )}
        </div>
      </>

      <div className="flex w-full flex-row items-center gap-2">
        <label className="min-w-32 shrink-0">Add Parameter:</label>
        <Dropdown
          options={PARAM_TYPE_OPTIONS}
          selected={selectedParamType}
          onSelect={(value) => setSelectedParamType(value as MethodParamType)}
          className="flex-grow"
        />
        <Button onClick={addMethodParam} className="shrink-0">
          Add Parameter
        </Button>
      </div>

      {methodParams.map((param, index) => (
        <div key={index} className="flex w-full flex-row items-center gap-2">
          <div className="flex-grow">
            {param.type === "hex" ? (
              <TextInput
                label={`Parameter ${index + 1} (${param.name})`}
                placeholder="Enter hex value (0x-prefixed)"
                state={[
                  (paramValues[`param${index}`] || "") as string,
                  (value: string) => {
                    if (!value.startsWith("0x")) value = "0x" + value;
                    setParamValues((prev) => ({
                      ...prev,
                      [`param${index}`]: value,
                    }));
                  },
                ]}
              />
            ) : param.type === "scriptAmountArray" ||
              param.type === "scriptArray" ? (
              <ScriptAmountArrayInput
                label={`Parameter ${index + 1} (${param.name})`}
                value={
                  Array.isArray(paramValues[`param${index}`])
                    ? (paramValues[`param${index}`] as ScriptAmountType[])
                    : typeof paramValues[`param${index}`] === "string"
                      ? JSON.parse(paramValues[`param${index}`] as string)
                      : []
                }
                onChange={(scriptAmounts) =>
                  setParamValues((prev) => ({
                    ...prev,
                    [`param${index}`]: scriptAmounts,
                  }))
                }
                showAmount={param.type === "scriptAmountArray"}
              />
            ) : param.type === "hexArray" ? (
              <HexArrayInput
                label={`Parameter ${index + 1} (${param.name})`}
                value={
                  Array.isArray(paramValues[`param${index}`])
                    ? (paramValues[`param${index}`] as string[])
                    : typeof paramValues[`param${index}`] === "string"
                      ? JSON.parse(paramValues[`param${index}`] as string)
                      : []
                }
                onChange={(hexValues) =>
                  setParamValues((prev) => ({
                    ...prev,
                    [`param${index}`]: hexValues,
                  }))
                }
              />
            ) : param.type == "signer" ? (
              <div>
                <div className="flex items-center gap-2">
                  <label className="font-bold">
                    Parameter {index + 1} ({param.name}): {param.type}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={
                        !(paramValues[`param${index}NotUsingDefault`] ?? false)
                      }
                      onChange={(e) =>
                        setParamValues((prev) => ({
                          ...prev,
                          [`param${index}NotUsingDefault`]: !e.target.checked,
                          ...(!e.target.checked && {
                            [`param${index}`]: undefined,
                          }),
                        }))
                      }
                      className="rounded border-gray-300"
                    />
                    Use Default
                  </label>
                </div>
              </div>
            ) : param.type == "contextScript" ? (
              <div>
                <div className="flex items-center gap-2">
                  <label className="font-bold">
                    Parameter {index + 1} ({param.name}): {param.type}
                  </label>
                </div>
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
                            ...((prev[`param${index}`] as ccc.ScriptLike) ||
                              {}),
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
                        {
                          name: "data1",
                          displayName: "Data1",
                          iconName: "Hash",
                        },
                        {
                          name: "data2",
                          displayName: "Data2",
                          iconName: "Hash",
                        },
                      ]}
                      selected={
                        ((paramValues[`param${index}`] as ccc.ScriptLike)
                          ?.hashType as string) || "type"
                      }
                      onSelect={(value) =>
                        setParamValues((prev) => ({
                          ...prev,
                          [`param${index}`]: {
                            ...((prev[`param${index}`] as ccc.ScriptLike) ||
                              {}),
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
                            ...((prev[`param${index}`] as ccc.ScriptLike) ||
                              {}),
                            args: value,
                          },
                        })),
                    ]}
                  />
                </div>
              </div>
            ) : param.type == "contextCell" ? (
              <details open>
                <summary className="cursor-pointer font-bold">
                  Parameter {index + 1} ({param.name})
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
            ) : param.type == "tx" ? (
              <div>
                <div className="flex items-center gap-2">
                  <label className="font-bold">
                    (Optional)Parameter {index + 1} ({param.name}): {param.type}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={
                        !(paramValues[`param${index}NotUsingDefault`] ?? false)
                      }
                      onChange={(e) =>
                        setParamValues((prev) => ({
                          ...prev,
                          [`param${index}NotUsingDefault`]: !e.target.checked,
                          ...(!e.target.checked && {
                            [`param${index}`]: undefined,
                          }),
                        }))
                      }
                      className="rounded border-gray-300"
                    />
                    Leave Blank
                  </label>
                </div>
                {paramValues[`param${index}NotUsingDefault`] && (
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
                  </div>
                )}
              </div>
            ) : param.type === "stringArray" ? (
              <TextInput
                label={`Parameter ${index + 1} (${param.name})`}
                placeholder="Enter comma-separated values"
                state={[
                  (paramValues[`param${index}`] || "") as string,
                  (value: string) =>
                    setParamValues((prev) => ({
                      ...prev,
                      [`param${index}`]: value.split(",").map((s) => s.trim()),
                    })),
                ]}
              />
            ) : (
              <TextInput
                label={`Parameter ${index + 1} (${param.name})`}
                placeholder={`Enter ${param.name} value`}
                state={[
                  (paramValues[`param${index}`] || "") as string,
                  (value: string) =>
                    setParamValues((prev) => ({
                      ...prev,
                      [`param${index}`]: value,
                    })),
                ]}
              />
            )}
            {param.type === "hexArray" && methodName === "hasMethods" && (
              <div className="mt-2 flex flex-row items-center gap-2">
                <TextInput
                  label="Method Path Generator"
                  placeholder="Enter method name to generate path"
                  state={[
                    methodPathInput || "",
                    (value: string) => setMethodPathInput(value),
                  ]}
                  className="flex-grow"
                />
                <Button
                  onClick={() => {
                    const path = ssri.getMethodPath(methodPathInput);
                    const currentValues =
                      (paramValues[`param${index}`] as string[]) || [];
                    setParamValues((prev) => ({
                      ...prev,
                      [`param${index}`]: [...currentValues, path],
                    }));
                  }}
                  className="shrink-0"
                >
                  Generate & Add Path
                </Button>
              </div>
            )}
          </div>
          <Button
            variant="danger"
            onClick={() => deleteMethodParam(index)}
            className="shrink-0"
          >
            Delete
          </Button>
        </div>
      ))}

      <>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="showSSRICallDetails"
            checked={showSSRICallDetails}
            onChange={(e) => setShowSSRICallDetails(e.target.checked)}
            className="rounded border-gray-300"
          />
          <label
            htmlFor="showSSRICallDetails"
            className="text-sm font-medium text-gray-700"
          >
            (Advanced) Show SSRI Call Details
          </label>
        </div>

        {showSSRICallDetails && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              SSRI Call Details
            </label>
            {SSRICallDetails && (
              <div className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                <JsonView value={SSRICallDetails} style={darkTheme} />
              </div>
            )}
          </div>
        )}
      </>

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">
          Method Result
        </label>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-900 border-t-transparent"></div>
          </div>
        ) : (
          methodResult && (
            <div className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
              <JsonView value={{ result: methodResult }} style={darkTheme} />
            </div>
          )
        )}
      </div>
      {!isLoading && iconDataURL && (
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
          />
        </div>
      )}
      <ButtonsPanel>
        <Button onClick={makeSSRICall}>Execute Method</Button>
      </ButtonsPanel>
    </div>
  );
}

const methodParamTypeMap: Record<`${string}.${string}`, MethodParamType> = {
  "name.context": "contextScript",
  "symbol.context": "contextScript",
  "decimals.context": "contextScript",
  "totalSupply.context": "contextScript",
  "balanceOf.context": "contextScript",
  "icon.context": "contextScript",
  "transfer.signer": "signer",
  "transfer.transfers": "scriptAmountArray",
  "transfer.tx": "tx",
  "mint.signer": "signer",
  "mint.mints": "scriptAmountArray",
  "mint.tx": "tx",
  "pause.signer": "signer",
  "pause.locks": "scriptArray",
  "pause.tx": "tx",
  "pause.extraLockHashes": "hexArray",
  "unpause.signer": "signer",
  "unpause.locks": "scriptArray",
  "unpause.tx": "tx",
  "unpause.extraLockHashes": "hexArray",
  "isPaused.locks": "scriptArray",
  "isPaused.extraLockHashes": "hexArray",
  "SSRI.hasMethods.methodNames": "stringArray",
  "SSRI.hasMethods.extraMethodPaths": "hexArray",
};

const hiddenMethods = [
  "constructor",
  "completeChangeToLock",
  "completeBy",
  "assertExecutor",
  "tryRun",
  "hasMethods",
  "getMethods",
  "version",
];
