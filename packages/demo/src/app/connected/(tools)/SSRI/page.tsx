"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/src/components/Button";
import { TextInput } from "@/src/components/Input";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { Dropdown } from "@/src/components/Dropdown";
import {
  ScriptAmountArrayInput,
  ScriptAmountInput,
  ScriptAmountType,
  ScriptType,
} from "@/src/components/ScriptAmountInput";
import { ssri } from "@ckb-ccc/ssri";
import { ccc } from "@ckb-ccc/connector-react";
import JsonView from "@uiw/react-json-view";
import { darkTheme } from "@uiw/react-json-view/dark";
import Image from "next/image";
import { HexArrayInput, HexInput } from "@/src/components/HexArrayInput";
import { Icon } from "@/src/components/Icon";

type ParamValue =
  | ccc.ScriptLike
  | ccc.CellLike
  | ccc.TransactionLike
  | ccc.HexLike
  | ccc.HexLike[]
  | string
  | string[]
  | number
  | number[]
  | boolean
  | boolean[]
  | ScriptAmountType
  | ScriptAmountType[]
  | undefined;

type MethodParamType =
  | "contextScript"
  | "contextCell"
  | "contextTransaction"
  | "hex"
  | "hexArray"
  | "string"
  | "stringArray"
  | "number"
  | "numberArray"
  | "boolean"
  | "booleanArray"
  | "script"
  | "scriptArray"
  | "byte32"
  | "byte32Array"
  | "tx";

interface MethodParam {
  name: string;
  type?: MethodParamType;
}

const METHODS_OPTIONS = [
  "SSRI.version",
  "SSRI.getMethods",
  "SSRI.hasMethods",
  "Customized",
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
  { name: "hex", displayName: "Generic Data (HexLike)", iconName: "Code" },
  {
    name: "hexArray",
    displayName: "Generic Data Array (HexLike)",
    iconName: "Code",
  },
  { name: "string", displayName: "String", iconName: "Code" },
  { name: "stringArray", displayName: "String Array", iconName: "Code" },
  { name: "number", displayName: "Number", iconName: "Code" },
  { name: "numberArray", displayName: "Number Array", iconName: "Code" },
  {
    name: "script",
    displayName: "Script",
    iconName: "Code",
  },
  { name: "scriptArray", displayName: "Script Array", iconName: "Code" },
  { name: "byte32", displayName: "Byte32", iconName: "Code" },
  { name: "byte32Array", displayName: "Byte32 Array", iconName: "Code" },
  { name: "tx", displayName: "Transaction", iconName: "Code" },
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
  const [methodResult, setMethodResult] = useState<any>(undefined);
  const [SSRICallDetails, setSSRICallDetails] = useState<any>(null);
  const [iconDataURL, setIconDataURL] = useState<string>("");
  const [ssriContractTypeIDArgs, setSsriContractTypeIDArgs] = useState<string>(
    "0x8fd55df879dc6176c95f3c420631f990ada2d4ece978c9512c39616dead2ed56",
  );
  const [showSSRICallDetails, setShowSSRICallDetails] =
    useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [methodToCall, setMethodToCall] = useState<string>("SSRI.version");
  const [rawMethodPath, setRawMethodPath] = useState<string>("SSRI.version");
  const [selectedParamType, setSelectedParamType] =
    useState<MethodParamType>("contextScript");
  const [methodPathInput, setMethodPathInput] = useState<string>("");
  const [transactionResult, setTransactionResult] = useState<
    ccc.Transaction | undefined
  >(undefined);

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
        name: `Parameter${methodParams.length}`,
        type: selectedParamType,
      },
    ]);
    setParamValues((prev) => ({
      ...prev,
      [`Parameter${methodParams.length}`]: undefined,
    }));
  };

  const deleteMethodParam = (index: number) => {
    setMethodParams(methodParams.filter((_, i) => i !== index));
    setParamValues((prev) => {
      const newValues = { ...prev };
      delete newValues[`Parameter${index}`];
      return newValues;
    });
  };

  const getOutPointFromTypeIDArgs = useCallback(async () => {
    if (!signer) return;
    const scriptCell = await signer.client.findSingletonCellByType({
      codeHash:
        "0x00000000000000000000000000000000000000000000000000545950455f4944",
      hashType: "type",
      args: ssriContractTypeIDArgs,
    });
    if (!scriptCell) {
      throw new Error("PUDT script cell not found");
    }
    const targetOutPoint = scriptCell.outPoint;
    setContractOutPointTx(targetOutPoint.txHash);
    setContractOutPointIndex(targetOutPoint.index.toString());
  }, [signer, ssriContractTypeIDArgs]);

  useEffect(() => {
    getOutPointFromTypeIDArgs();
  }, [ssriContractTypeIDArgs, signer, getOutPointFromTypeIDArgs]);

  const makeSSRICall = async () => {
    if (!signer) return;

    setIsLoading(true);
    setMethodResult(undefined);
    setIconDataURL("");

    const testSSRIExecutor = new ssri.ExecutorJsonRpc(SSRIExecutorURL);

    let contract: ssri.Trait | undefined;
    try {
      const targetOutPoint = {
        txHash: contractOutPointTx,
        index: parseInt(contractOutPointIndex),
      };
      const scriptCell = await signer.client.getCell(targetOutPoint);

      if (!scriptCell) {
        throw new Error("Script cell not found");
      }

      if (!scriptCell.cellOutput.type?.hash()) {
        throw new Error("Script cell type hash not found");
      }
      contract = new ssri.Trait(scriptCell.outPoint, testSSRIExecutor);

      if (!contract) {
        throw new Error("Contract not initialized");
      }

      let context:
        | ssri.ContextScript
        | ssri.ContextCell
        | ssri.ContextTransaction
        | undefined;

      const args = methodParams.map((paramType, index) => {
        let value = paramValues[`Parameter${index}`];
        return value;
      });

      methodParams.forEach((paramType, index) => {
        const value = paramValues[`Parameter${index}`];
        if (paramType.type === "contextScript") {
          context = { script: value as ccc.ScriptLike } as ssri.ContextScript;
        } else if (paramType.type === "contextCell") {
          context = { cell: value as ccc.CellLike } as ssri.ContextCell;
        } else if (paramType.type === "contextTransaction") {
          context = {
            tx: value as ccc.TransactionLike,
          } as ssri.ContextTransaction;
        }
      });

      setSSRICallDetails({
        trait: rawMethodPath.split(".")[0],
        method: rawMethodPath.split(".")[1],
        args: args,
        contractOutPoint: {
          txHash: contractOutPointTx,
          index: parseInt(contractOutPointIndex),
        },
        ssriContext: context,
      });

      log(
        "Calling",
        rawMethodPath,
        "on contract at",
        String(contractOutPointTx),
        "index",
        String(contractOutPointIndex),
      );
      let result;
      if (rawMethodPath.split(".")[0] === "SSRI") {
        // Type-safe way to call built-in methods
        switch (rawMethodPath) {
          case "SSRI.getMethods":
            result = await contract.getMethods(
              args[0] as number,
              args[1] as number,
            );
            break;
          case "SSRI.hasMethods":
            result = await contract.hasMethods(
              (args[0] as string[]) ?? [],
              (args[1] as ccc.HexLike[]) ?? [],
            );
            break;
          case "SSRI.version":
            result = await contract.version();
            break;
        }
      } else {
        let argsHex = methodParams
          .map((param, index) => {
            const arg = args[index];

            switch (param.type) {
              case "contextScript":
              case "contextCell":
              case "contextTransaction":
                return undefined;
              case "hex":
                if (!arg) return "0x";
                return arg as ccc.HexLike;
              case "hexArray":
                if (!arg) return "0x";
                return ccc.mol.BytesVec.encode(arg as ccc.HexLike[]);
              case "string":
                return ccc.bytesFrom(
                  (arg as string).trimStart().trimEnd(),
                  "utf8",
                );
              case "stringArray":
                return ccc.mol.BytesVec.encode(
                  (arg as string[]).map((str) =>
                    ccc.bytesFrom(str.trimStart().trimEnd(), "utf8"),
                  ),
                );
              case "number":
                return ccc.numLeToBytes(arg as number);
              case "numberArray":
                return ccc.mol.Uint128Vec.encode(arg as number[]);
              case "script":
                if (!arg) return "0x";
                return ccc.Script.encode(arg as ccc.ScriptLike);
              case "scriptArray":
                if (!arg) return "0x";
                return ccc.ScriptVec.encode(
                  (arg as ScriptAmountType[]).map(
                    (scriptAmount) => scriptAmount.script,
                  ),
                );
              case "tx":
                if (!arg) return "0x";
                return ccc.Transaction.encode(arg as ccc.TransactionLike);
              case "byte32":
                if (!arg) return "0x";
                return ccc.mol.Byte32.encode(arg as ccc.HexLike);
              case "byte32Array":
                if (!arg) return "0x";
                return ccc.mol.Byte32Vec.encode(arg as ccc.HexLike[]);
              default:
                throw new Error(`Unsupported parameter type: ${param.type}`);
            }
          })
          .filter((arg) => arg !== undefined);

        result = await contract
          .assertExecutor()
          .runScript(contract.code, rawMethodPath, argsHex, context);
      }
      if (result) {
        try {
          const transaction = ccc.Transaction.fromBytes(
            result.res as ccc.HexLike,
          );
          setTransactionResult(transaction);
        } catch (e) {}
        if (
          rawMethodPath.split(".")[0] === "UDT" &&
          rawMethodPath.split(".")[1] === "icon"
        ) {
          const dataURL = ccc.bytesTo(result.res as string, "utf8");
          setMethodResult(result);
          setIconDataURL(dataURL);
        } else {
          setMethodResult(result);
        }
      }
    } catch (e) {
      let errorMessage =
        e instanceof Error
          ? e.message
          : typeof e === "object"
            ? "Check your SSRI server"
            : String(e) || "Unknown error";
      if (String(errorMessage).length < 3) {
        errorMessage =
          "Check your SSRI server or URL. Run `docker run -p 9090:9090 hanssen0/ckb-ssri-server` to start a local SSRI server.";
      }
      setMethodResult(`Error: ${errorMessage}`);
      error(`Error: ${errorMessage}`);
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
                SSRI.version
              </code>{" "}
              method.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-semibold text-white">
              3
            </span>
            <div className="flex-1 text-gray-800 dark:text-gray-100">
              All Done! You called an SSRI method! Try playing with other
              methods while reading{" "}
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
        <div className="flex flex-row items-center gap-2">
          <TextInput
            label="Script Cell Type ID Args (Optional)"
            placeholder="Type ID Args of the script cell"
            state={[ssriContractTypeIDArgs, setSsriContractTypeIDArgs]}
            className="flex-1"
          />
          <Button
            onClick={() => getOutPointFromTypeIDArgs()}
            className="shrink-0"
          >
            Search
          </Button>
        </div>
        <TextInput
          label="Script Cell OutPoint"
          placeholder="Tx hash:index (e.g. 0x123...abc:0)"
          state={[
            `${contractOutPointTx}:${contractOutPointIndex}`,
            (value: string) => {
              const [tx, index] = value.split(":");
              setContractOutPointTx(tx || "");
              setContractOutPointIndex(index || "0");
            },
          ]}
        />
        <div className="flex flex-row items-center gap-4">
          <label className="min-w-32 shrink-0">Method to Call:</label>
          <Dropdown
            options={METHODS_OPTIONS.map((method) => ({
              name: method,
              displayName: method,
              iconName: "Code",
            }))}
            selected={methodToCall}
            onSelect={(value) => {
              if (value !== "Customized") {
                setMethodToCall(value);
                setRawMethodPath(value);
                if (value === "SSRI.getMethods") {
                  setMethodParams([
                    { name: "offset", type: "number" },
                    { name: "limit", type: "number" },
                  ]);
                  setParamValues({
                    Parameter0: 0,
                    Parameter1: 0,
                  });
                } else if (value === "SSRI.hasMethods") {
                  setMethodParams([
                    { name: "methodNames", type: "stringArray" },
                    { name: "extraMethodPaths", type: "hexArray" },
                  ]);
                  setParamValues({
                    Parameter0: [],
                    Parameter1: [],
                  });
                } else {
                  setMethodParams([]);
                  setParamValues({});
                }
              } else {
                setMethodToCall(value);
                setRawMethodPath("");
              }
            }}
            className="flex-1"
          />
          <>
            <TextInput
              label="Method Path"
              placeholder="Enter trait.method (e.g. UDT.name)"
              state={[
                rawMethodPath,
                (value: string) => {
                  setMethodToCall("Customized");
                  setRawMethodPath(value);
                  setParamValues({});
                  setMethodParams([]);
                },
              ]}
              className="flex-1"
            />
          </>
        </div>
      </>

      {methodToCall === "Customized" && (
        <div className="flex w-full flex-row items-center gap-2">
          <label className="min-w-32 shrink-0">Add Parameter:</label>
          <Dropdown
            options={PARAM_TYPE_OPTIONS}
            selected={selectedParamType}
            onSelect={(value) => setSelectedParamType(value as MethodParamType)}
            className="flex-grow"
          />
          <Button onClick={addMethodParam} className="shrink-0">
            <Icon name="Plus" />
          </Button>
        </div>
      )}

      {methodParams.map((param, index) => (
        <div key={index} className="flex w-full flex-row items-center gap-2">
          <div className="flex-grow">
            {param.type === "hex" ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="font-bold">
                    Parameter {index}: (Generic Data)
                  </label>
                </div>
                <TextInput
                  label={`Hex Data`}
                  placeholder="Enter hex value (0x-prefixed)"
                  state={[
                    (paramValues[`Parameter${index}`] || "") as string,
                    (value: string) => {
                      if (!value.startsWith("0x")) value = "0x" + value;
                      setParamValues((prev) => ({
                        ...prev,
                        [`Parameter${index}`]: value,
                      }));
                    },
                  ]}
                />
              </div>
            ) : param.type === "scriptArray" ? (
              <ScriptAmountArrayInput
                label={`Parameter ${index} (${param.type})`}
                value={
                  (paramValues[`Parameter${index}`] as ScriptAmountType[]) ?? []
                }
                onChange={(scriptAmounts) =>
                  setParamValues((prev) => ({
                    ...prev,
                    [`Parameter${index}`]: scriptAmounts,
                  }))
                }
                showAmount={false}
              />
            ) : param.type === "hexArray" ? (
              <HexArrayInput
                label={`Parameter ${index} (${param.type})`}
                value={(paramValues[`Parameter${index}`] as string[]) ?? []}
                onChange={(hexValues) =>
                  setParamValues((prev) => ({
                    ...prev,
                    [`Parameter${index}`]: hexValues,
                  }))
                }
              />
            ) : param.type == "contextScript" || param.type == "script" ? (
              <div>
                <div className="flex items-center gap-2">
                  <label className="font-bold">
                    Parameter {index}: (
                    {
                      PARAM_TYPE_OPTIONS.find(
                        (option) => option.name === param.type,
                      )?.displayName
                    }
                    )
                  </label>
                </div>
                <ScriptAmountInput
                  showAmount={false}
                  key={index}
                  value={{
                    script: paramValues[`Parameter${index}`] as ScriptType,
                    amount: undefined,
                  }}
                  onChange={(updatedScriptAmount) =>
                    setParamValues((prev) => ({
                      ...prev,
                      [`Parameter${index}`]: {
                        codeHash: updatedScriptAmount.script?.codeHash ?? "",
                        hashType:
                          updatedScriptAmount.script?.hashType ?? "type",
                        args: updatedScriptAmount.script?.args ?? "",
                      },
                    }))
                  }
                />
              </div>
            ) : param.type == "contextCell" ? (
              <details open>
                <summary className="cursor-pointer font-bold">
                  Parameter {index}: (
                  {
                    PARAM_TYPE_OPTIONS.find(
                      (option) => option.name === param.type,
                    )?.displayName
                  }
                  )
                </summary>
                <div className="flex flex-col gap-2 pl-4 pt-2">
                  <TextInput
                    label="Capacity"
                    placeholder="Enter capacity"
                    state={[
                      (
                        paramValues[`Parameter${index}`] as ccc.CellLike
                      )?.cellOutput?.capacity?.toString() || "",
                      (value) =>
                        setParamValues((prev) => ({
                          ...prev,
                          [`Parameter${index}`]: {
                            outPoint: {
                              txHash: "0x",
                              index: 0,
                            },
                            cellOutput: {
                              capacity: value,
                              lock: {
                                codeHash:
                                  (prev[`Parameter${index}`] as ccc.CellLike)
                                    ?.cellOutput?.lock?.codeHash ?? "",
                                hashType:
                                  (prev[`Parameter${index}`] as ccc.CellLike)
                                    ?.cellOutput?.lock?.hashType ?? "type",
                                args:
                                  (prev[`Parameter${index}`] as ccc.CellLike)
                                    ?.cellOutput?.lock?.args ?? "",
                              },
                              type: {
                                codeHash:
                                  (prev[`Parameter${index}`] as ccc.CellLike)
                                    ?.cellOutput?.type?.codeHash ?? "",
                                hashType:
                                  (prev[`Parameter${index}`] as ccc.CellLike)
                                    ?.cellOutput?.type?.hashType ?? "type",
                                args:
                                  (prev[`Parameter${index}`] as ccc.CellLike)
                                    ?.cellOutput?.type?.args ?? "",
                              },
                            },
                            outputData:
                              (prev[`Parameter${index}`] as ccc.CellLike)
                                ?.outputData || "",
                          } as ccc.CellLike,
                        })),
                    ]}
                  />
                  <TextInput
                    label="Data"
                    placeholder="Enter cell data in Hex"
                    state={[
                      (
                        paramValues[`Parameter${index}`] as ccc.CellLike
                      )?.outputData?.toString() || "",
                      (value) =>
                        setParamValues((prev) => ({
                          ...prev,
                          [`Parameter${index}`]: {
                            outPoint: {
                              txHash: "0x",
                              index: 0,
                            },
                            cellOutput: {
                              capacity:
                                (
                                  prev[`Parameter${index}`] as ccc.CellLike
                                )?.cellOutput?.capacity?.toString() || "",
                              lock: {
                                codeHash:
                                  (prev[`Parameter${index}`] as ccc.CellLike)
                                    ?.cellOutput?.lock?.codeHash ?? "",
                                hashType:
                                  (prev[`Parameter${index}`] as ccc.CellLike)
                                    ?.cellOutput?.lock?.hashType ?? "type",
                                args:
                                  (prev[`Parameter${index}`] as ccc.CellLike)
                                    ?.cellOutput?.lock?.args ?? "",
                              },
                              type: {
                                codeHash:
                                  (prev[`Parameter${index}`] as ccc.CellLike)
                                    ?.cellOutput?.type?.codeHash ?? "",
                                hashType:
                                  (prev[`Parameter${index}`] as ccc.CellLike)
                                    ?.cellOutput?.type?.hashType ?? "type",
                                args:
                                  (prev[`Parameter${index}`] as ccc.CellLike)
                                    ?.cellOutput?.type?.args ?? "",
                              },
                            },
                            outputData: value,
                          } as ccc.CellLike,
                        })),
                    ]}
                  />
                  <label className="min-w-24">Lock:</label>
                  <ScriptAmountInput
                    showAmount={false}
                    value={{
                      script: paramValues[`Parameter${index}`] as ScriptType,
                      amount: undefined,
                    }}
                    onChange={(updatedScriptAmount) =>
                      setParamValues((prev) => ({
                        ...prev,
                        [`Parameter${index}`]: {
                          outPoint: {
                            txHash: "0x",
                            index: 0,
                          },
                          cellOutput: {
                            capacity:
                              (
                                prev[`Parameter${index}`] as ccc.CellLike
                              )?.cellOutput?.capacity?.toString() || "",
                            lock: {
                              codeHash:
                                updatedScriptAmount.script?.codeHash ?? "",
                              hashType:
                                updatedScriptAmount.script?.hashType ?? "type",
                              args: updatedScriptAmount.script?.args ?? "",
                            },
                            type: {
                              codeHash:
                                (prev[`Parameter${index}`] as ccc.CellLike)
                                  ?.cellOutput?.type?.codeHash ?? "",
                              hashType:
                                (prev[`Parameter${index}`] as ccc.CellLike)
                                  ?.cellOutput?.type?.hashType ?? "type",
                              args:
                                (prev[`Parameter${index}`] as ccc.CellLike)
                                  ?.cellOutput?.type?.args ?? "",
                            },
                          },
                          outputData:
                            (prev[`Parameter${index}`] as ccc.CellLike)
                              ?.outputData || "",
                        } as ccc.CellLike,
                      }))
                    }
                  />
                  <div className="flex items-center gap-2">
                    <label className="min-w-24">Type:</label>
                    <label>
                      <input
                        type="checkbox"
                        checked={
                          !(
                            paramValues[`Parameter${index}NotUsingNoneType`] ??
                            false
                          )
                        }
                        onChange={(e) =>
                          setParamValues((prev) => ({
                            ...prev,
                            [`Parameter${index}NotUsingNoneType`]:
                              !e.target.checked,
                            ...(!e.target.checked && {
                              [`Parameter${index}`]: undefined,
                            }),
                          }))
                        }
                      />
                      Use None
                    </label>
                  </div>

                  {(paramValues[`Parameter${index}NotUsingNoneType`] ??
                    false) && (
                    <ScriptAmountInput
                      showAmount={false}
                      value={{
                        script: paramValues[`Parameter${index}`] as ScriptType,
                        amount: undefined,
                      }}
                      onChange={(updatedScriptAmount) =>
                        setParamValues((prev) => ({
                          ...prev,
                          [`Parameter${index}`]: {
                            outPoint: {
                              txHash: "0x",
                              index: 0,
                            },
                            cellOutput: {
                              capacity:
                                (
                                  prev[`Parameter${index}`] as ccc.CellLike
                                )?.cellOutput?.capacity?.toString() || "",
                              type: {
                                codeHash:
                                  updatedScriptAmount.script?.codeHash ?? "",
                                hashType:
                                  updatedScriptAmount.script?.hashType ??
                                  "type",
                                args: updatedScriptAmount.script?.args ?? "",
                              },
                              lock: {
                                codeHash:
                                  (prev[`Parameter${index}`] as ccc.CellLike)
                                    ?.cellOutput?.lock?.codeHash ?? "",
                                hashType:
                                  (prev[`Parameter${index}`] as ccc.CellLike)
                                    ?.cellOutput?.lock?.hashType ?? "type",
                                args:
                                  (prev[`Parameter${index}`] as ccc.CellLike)
                                    ?.cellOutput?.lock?.args ?? "",
                              },
                            },
                            outputData:
                              (prev[`Parameter${index}`] as ccc.CellLike)
                                ?.outputData || "",
                          } as ccc.CellLike,
                        }))
                      }
                    />
                  )}
                </div>
              </details>
            ) : param.type == "contextTransaction" ? (
              <details open>
                <summary className="cursor-pointer font-bold">
                  Parameter {index}: (
                  {
                    PARAM_TYPE_OPTIONS.find(
                      (option) => option.name === param.type,
                    )?.displayName
                  }
                  )
                </summary>
                <div className="flex flex-col gap-2 pl-4 pt-2">
                  <TextInput
                    label="Transaction Data (Hex)"
                    placeholder="Enter transaction data in hex format"
                    state={[
                      (
                        paramValues[`Parameter${index}`] as ccc.TransactionLike
                      )?.toString() || "0x",
                      (value) => {
                        if (!value.startsWith("0x")) value = "0x" + value;
                        setParamValues((prev) => ({
                          ...prev,
                          [`Parameter${index}`]: value,
                        }));
                      },
                    ]}
                  />
                </div>
              </details>
            ) : param.type == "tx" ? (
              <div>
                <div className="flex items-center gap-2">
                  <label className="font-bold">
                    Parameter {index}:{" "}
                    {
                      PARAM_TYPE_OPTIONS.find(
                        (option) => option.name === param.type,
                      )?.displayName
                    }
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={
                        !(
                          paramValues[`Parameter${index}NotUsingDefault`] ??
                          false
                        )
                      }
                      onChange={(e) =>
                        setParamValues((prev) => ({
                          ...prev,
                          [`Parameter${index}NotUsingDefault`]:
                            !e.target.checked,
                          ...(!e.target.checked && {
                            [`Parameter${index}`]: undefined,
                          }),
                        }))
                      }
                      className="rounded border-gray-300"
                    />
                    Leave Blank
                  </label>
                </div>
                {paramValues[`Parameter${index}NotUsingDefault`] && (
                  <div className="flex flex-col gap-2 pl-4 pt-2">
                    <TextInput
                      label="Transaction Data (Hex)"
                      placeholder="Enter transaction data in hex format"
                      state={[
                        (
                          paramValues[
                            `Parameter${index}`
                          ] as ccc.TransactionLike
                        )?.toString() || "0x",
                        (value) => {
                          if (!value.startsWith("0x")) value = "0x" + value;
                          setParamValues((prev) => ({
                            ...prev,
                            [`Parameter${index}`]: value,
                          }));
                        },
                      ]}
                    />
                  </div>
                )}
              </div>
            ) : param.type === "stringArray" ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="font-bold">
                    Parameter {index}: (String Array)
                  </label>
                </div>
                <TextInput
                  label={`String Array`}
                  placeholder="Enter comma-separated string values. Will trim start and end of each string."
                  state={[
                    (paramValues[`Parameter${index}`] || "") as string,
                    (value: string) =>
                      setParamValues((prev) => ({
                        ...prev,
                        [`Parameter${index}`]: value.split(","),
                      })),
                  ]}
                />
              </div>
            ) : param.type === "number" ? (
              <div>
                <div className="flex items-center gap-2">
                  <label className="font-bold">
                    Parameter {index}: (
                    {
                      PARAM_TYPE_OPTIONS.find(
                        (option) => option.name === param.type,
                      )?.displayName
                    }
                    )
                  </label>
                </div>
                <TextInput
                  label={`Number`}
                  placeholder={`Enter number value`}
                  state={[
                    (paramValues[`Parameter${index}`] || 0) as string,
                    (value: string) => {
                      const num = Number(value);
                      if (!isNaN(num)) {
                        setParamValues((prev) => ({
                          ...prev,
                          [`Parameter${index}`]: num,
                        }));
                      }
                    },
                  ]}
                />
              </div>
            ) : param.type === "numberArray" ? (
              <div>
                <div className="flex items-center gap-2">
                  <label className="font-bold">
                    Parameter {index}: (
                    {
                      PARAM_TYPE_OPTIONS.find(
                        (option) => option.name === param.type,
                      )?.displayName
                    }
                    )
                  </label>
                </div>
                <TextInput
                  label={`Number Array`}
                  placeholder={`Enter comma-separated number values`}
                  state={[
                    (paramValues[`Parameter${index}`] || "") as string,
                    (value: string) =>
                      setParamValues((prev) => ({
                        ...prev,
                        [`Parameter${index}`]: value
                          .split(",")
                          .map(Number)
                          .filter((num) => !isNaN(num)),
                      })),
                  ]}
                />
              </div>
            ) : param.type === "byte32" ? (
              <div>
                <div className="flex items-center gap-2">
                  <label className="font-bold">
                    Parameter {index}:{" "}
                    {
                      PARAM_TYPE_OPTIONS.find(
                        (option) => option.name === param.type,
                      )?.displayName
                    }
                  </label>
                </div>
                <HexInput
                  value={(paramValues[`Parameter${index}`] as string) ?? "0x"}
                  label={`Byte32 Hex Value`}
                  placeholder={`Enter byte32 value`}
                  onChange={(value) =>
                    setParamValues((prev) => ({
                      ...prev,
                      [`Parameter${index}`]: value,
                    }))
                  }
                />
              </div>
            ) : param.type === "byte32Array" ? (
              <div>
                <div className="flex items-center gap-2">
                  <label className="font-bold">
                    Parameter {index}: (
                    {
                      PARAM_TYPE_OPTIONS.find(
                        (option) => option.name === param.type,
                      )?.displayName
                    }
                    )
                  </label>
                </div>
                <HexArrayInput
                  value={(paramValues[`Parameter${index}`] as string[]) ?? []}
                  onChange={(hexValues) =>
                    setParamValues((prev) => ({
                      ...prev,
                      [`Parameter${index}`]: hexValues,
                    }))
                  }
                  label={`Byte32 Array Hex Values`}
                />
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <label className="font-bold">
                    Parameter {index}: (
                    {
                      PARAM_TYPE_OPTIONS.find(
                        (option) => option.name === param.type,
                      )?.displayName
                    }
                    )
                  </label>
                </div>
                <TextInput
                  label={`${param.name}`}
                  placeholder={`Enter ${param.name} value`}
                  state={[
                    (paramValues[`Parameter${index}`] || "") as string,
                    (value: string) =>
                      setParamValues((prev) => ({
                        ...prev,
                        [`Parameter${index}`]: value,
                      })),
                  ]}
                />
              </div>
            )}
            {param.type === "hexArray" &&
              rawMethodPath === "SSRI.hasMethods" && (
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
                        (paramValues[`Parameter${index}`] as string[]) || [];
                      setParamValues((prev) => ({
                        ...prev,
                        [`Parameter${index}`]: [...currentValues, path],
                      }));
                    }}
                    className="shrink-0"
                  >
                    Generate & Add Path
                  </Button>
                </div>
              )}
          </div>
          {methodToCall === "Customized" && (
            <Button onClick={() => deleteMethodParam(index)}>
              <Icon name="Trash" />
            </Button>
          )}
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
      {transactionResult && (
        <div className="mt-4">
          <label className="block text-medium font-bold text-gray-700">
            Transaction Skeleton (Advanced Feature, Use only if you know what you are doing with caution and only on Testnet)
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                if (!signer) return;
                const newTransactionResult = transactionResult.clone();
                await newTransactionResult.completeInputsAtLeastOne(signer);
                setTransactionResult(newTransactionResult);
              }}
            >
              completeInputsAtLeastOne
            </Button>
            <Button
              onClick={async () => {
                if (!signer) {
                  alert("No signer found");
                  return;
                }
                const newTransactionResult = transactionResult.clone();
                let udtScript: ccc.ScriptLike | undefined;
                for (let index = 0; index < methodParams.length; index++) {
                  const param = methodParams[index];
                  if (param.type === "contextScript") {
                    udtScript = paramValues[
                      `Parameter${index}`
                    ] as ccc.ScriptLike;
                  }
                }
                if (!udtScript) {
                  alert("No UDT script found from contextScript parameter");
                  return;
                }
                await newTransactionResult.completeInputsByUdt(
                  signer,
                  udtScript,
                );
                const balanceDiff =
                  (await newTransactionResult.getInputsUdtBalance(
                    signer.client,
                    udtScript,
                  )) - newTransactionResult.getOutputsUdtBalance(udtScript);
                const { script: changeScript } =
                  await signer.getRecommendedAddressObj();
                if (balanceDiff > ccc.Zero) {
                  newTransactionResult.addOutput(
                    {
                      lock: changeScript,
                      type: udtScript,
                    },
                    ccc.numLeToBytes(balanceDiff, 16),
                  );
                }
                setTransactionResult(newTransactionResult);
              }}
            >
              completeInputsByUdt and complete UDT change
            </Button>
            <Button
              onClick={async () => {
                if (!signer) {
                  alert("No signer found");
                  return;
                }
                const newTransactionResult = transactionResult.clone();
                await newTransactionResult.completeInputsByCapacity(signer);
                setTransactionResult(newTransactionResult);
              }}
            >
              completeInputsByCapacity
            </Button>
            <Button
              onClick={async () => {
                if (!signer) {
                  alert("No signer found");
                  return;
                }
                const newTransactionResult = transactionResult.clone();
                newTransactionResult.addCellDeps({
                  outPoint: {
                    txHash: contractOutPointTx,
                    index: contractOutPointIndex,
                  },
                  depType: "code",
                });
                setTransactionResult(newTransactionResult);
              }}
            >
              Add Cell Dep
            </Button>
            <Button
              onClick={async () => {
                if (!signer) {
                  alert("No signer found");
                  return;
                }
                const newTransactionResult = transactionResult.clone();
                await newTransactionResult.completeFeeBy(signer);
                setTransactionResult(newTransactionResult);
              }}
            >
              completeFeeBy
            </Button>
            <Button
              onClick={async () => {
                if (!signer) {
                  alert("No signer found");
                  return;
                }
                const txHash = await signer.sendTransaction(transactionResult);
                log("Transaction sent with hash:", txHash);
              }}
            >
              Sign and Send Transaction
            </Button>
          </div>
          <JsonView value={transactionResult} style={darkTheme} />
        </div>
      )}
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
