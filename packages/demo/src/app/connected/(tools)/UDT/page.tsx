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
import { udt } from "@ckb-ccc/udt";
import { ccc } from "@ckb-ccc/connector-react";
import JsonView from "@uiw/react-json-view";
import { darkTheme } from "@uiw/react-json-view/dark";
import Image from "next/image";
import { HexArrayInput } from "@/src/components/HexArrayInput";

type ParamValue =
  | string
  | ScriptAmountType[]
  | ccc.ScriptLike
  | ccc.ScriptLike[]
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
  | "num";

interface MethodParam {
  name: string;
  type?: MethodParamType;
}

type ScriptContext = {
  codeHash: string;
  hashType: string;
  args: string;
};

type MethodDefinition = {
  params: MethodParam[];
  trait: "UDT" | "UDTPausable" | "both";
};

export default function UDT() {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("UDT");

  const [SSRIExecutorURL, setSSRIExecutorURL] = useState<string>(
    "http://localhost:9090",
  );
  const [contractOutPointTx, setContractOutPointTx] = useState<string>("");
  const [contractOutPointIndex, setContractOutPointIndex] =
    useState<string>("0");
  const [activeTrait, setActiveTrait] = useState<"UDT" | "UDTPausable">("UDT");
  const [methodList, setMethodList] = useState<string[]>([]);
  const [activeMethod, setActiveMethod] = useState<string>("name");
  const [methodParams, setMethodParams] = useState<MethodParam[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, ParamValue>>(
    {},
  );
  const [methodResult, setMethodResult] = useState<any>(undefined);
  const [UDTCallDetails, setUDTCallDetails] = useState<any>(null);
  const [iconDataURL, setIconDataURL] = useState<string>("");
  const [udtType, setUdtType] = useState<"ssri" | "xudt">("ssri");
  const [xudtArgs, setXudtArgs] = useState<string>("");
  const [availableTraits, setAvailableTraits] = useState<
    ("UDT" | "UDTPausable")[]
  >([]);
  const [ssriUDTArgs, setSsriUDTArgs] = useState<string>(
    "0x02c93173368ec56f72ec023f63148461b80e7698eddd62cbd9dbe31a13f2b330",
  );
  const [ssriInstantiationType, setSsriInstantiationType] = useState<
    "outpoint" | "typeid"
  >("typeid");
  const [ssriContractTypeIDArgs, setSsriContractTypeIDArgs] = useState<string>(
    "0x8fd55df879dc6176c95f3c420631f990ada2d4ece978c9512c39616dead2ed56",
  );
  const [showUDTCallDetails, setShowUDTCallDetails] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (udtType === "ssri") {
      setAvailableTraits(["UDT", "UDTPausable"]);
    } else if (udtType === "xudt") {
      setAvailableTraits(["UDT"]);
    }
  }, [udtType]);

  useEffect(() => {
    if (activeTrait === "UDT") {
      // Get all methods including inherited ones by walking up the prototype chain
      const getAllMethods = (obj: any): string[] => {
        const methods = new Set<string>();
        let currentObj = obj;

        while (currentObj && currentObj !== Object.prototype) {
          Object.getOwnPropertyNames(currentObj)
            .filter(
              (name) =>
                name !== "constructor" &&
                typeof currentObj[name] === "function",
            )
            .forEach((name) => methods.add(name));

          currentObj = Object.getPrototypeOf(currentObj);
        }

        return Array.from(methods);
      };

      const methods = getAllMethods(udt.Udt.prototype).filter(
        (method) => !hiddenMethods.includes(method),
      );
      setMethodList(methods);
      if (!methods.includes(activeMethod)) {
        setActiveMethod(methods[0] || "");
      }
    } else if (activeTrait === "UDTPausable") {
      // Apply the same pattern for UDTPausable
      const getAllMethods = (obj: any): string[] => {
        const methods = new Set<string>();
        let currentObj = obj;

        while (currentObj && currentObj !== Object.prototype) {
          Object.getOwnPropertyNames(currentObj)
            .filter(
              (name) =>
                name !== "constructor" &&
                typeof currentObj[name] === "function",
            )
            .forEach((name) => methods.add(name));

          currentObj = Object.getPrototypeOf(currentObj);
        }

        return Array.from(methods);
      };

      const methods = getAllMethods(udt.UdtPausable.prototype).filter(
        (method) => !hiddenMethods.includes(method),
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

    // Set loading state and clear previous results
    setIsLoading(true);
    setMethodResult(undefined);
    setIconDataURL("");

    const testSSRIExecutor = new ssri.ExecutorJsonRpc(SSRIExecutorURL);

    let contract: udt.Udt | udt.UdtPausable | undefined;
    try {
      if (udtType === "ssri") {
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

        const type = ccc.Script.from({
          codeHash: scriptCell.cellOutput.type?.hash(),
          hashType: "type",
          args: ssriUDTArgs,
        });

        // Check UDT methods
        if (activeTrait === "UDT") {
          contract = new udt.Udt(testOutPoint, type, {
            executor: testSSRIExecutor,
          });
        } else if (activeTrait === "UDTPausable") {
          contract = new udt.UdtPausable(testOutPoint, type, {
            executor: testSSRIExecutor,
          });
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

        contract = new udt.Udt(
          scriptInfo.cellDeps[0].cellDep.outPoint,
          script,
          { executor: testSSRIExecutor },
        );
      }

      // Check contract is defined before using
      if (!contract) {
        throw new Error("Contract not initialized");
      }

      // Prepare arguments based on the number of parameters the method expects
      const args = methodParams.map((paramType, index) => {
        let value = paramValues[`param${index}`];
        if (paramType.type === "contextScript") {
          if (!paramValues[`param${index}NotUsingDefault`]) {
            value = contract?.script;
          }
          return {
            script: value as ccc.ScriptLike,
          };
        }
        if (paramType.type === "signer") {
          return signer;
        }
        if (paramType.type === "scriptAmountArray") {
          value = paramValues[`param${index}`] as ScriptAmountType[];
          const scriptAmountArray = value.map((scriptAmount) => ({
            to: scriptAmount.script,
            amount: scriptAmount.amount,
          }));
          return scriptAmountArray;
        }
        if (paramType.type === "hexArray") {
          // Ensure value is parsed from JSON string
          const parsedArray =
            typeof value === "string"
              ? JSON.parse(value)
              : Array.isArray(value)
                ? value
                : [];

          return parsedArray;
        }
        const isTransaction =
          paramType.name?.toLowerCase().includes("tx") ||
          paramType.name?.toLowerCase().includes("transaction");
        if (isTransaction && value) {
          const hexData = value as string;
          if (hexData && !hexData.startsWith("0x")) {
            throw new Error("Transaction data must be 0x-prefixed hex string");
          }
          return ccc.Transaction.fromBytes(ccc.bytesFrom(hexData));
        }
        return value;
      });

      setUDTCallDetails({
        trait: activeTrait,
        method: activeMethod,
        args: args,
        contractOutPoint: {
          txHash: contractOutPointTx,
          index: parseInt(contractOutPointIndex),
        },
      });

      log(
        "Calling method",
        String(activeMethod),
        "on contract",
        String(activeTrait),
        "at",
        String(contractOutPointTx),
        "index",
        String(contractOutPointIndex),
      );

      let result;
      if (methodParams.length === 0) {
        result = await (contract as any)[activeMethod]();
      } else {
        result = await (contract as any)[activeMethod](...args);
      }

      // Check if result contains a transaction to send
      if (result?.res instanceof ccc.Transaction) {
        log("Sending transaction...");
        let transaction = result.res;
        if (activeMethod === "transfer") {
          transaction = await contract.completeBy(result.res, signer);
        }
        await transaction.completeFeeBy(signer);
        const hash = await signer.sendTransaction(transaction);
        result.txHash = hash;
        log("Transaction sent with hash:", hash);
      }

      if (activeTrait === "UDT" && activeMethod === "icon") {
        const dataURL = result.res;
        setMethodResult(result);
        setIconDataURL(dataURL);
      } else {
        setMethodResult(result);
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
                UDT.name
              </code>{" "}
              method.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-semibold text-white">
              3
            </span>
            <div className="flex-1 text-gray-800 dark:text-gray-100">
              All Done! You called a UDT method! Try playing with other methods
              while reading{" "}
              <a
                href="https://github.com/Alive24/ccc/tree/Doc/packages/udt"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 underline hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                CCC&apos;s Support for User Defined Token (UDT)
              </a>{" "}
              to know how to adjust parameters to your need.
            </div>
          </div>
        </div>
      </div>
      <div className="flex w-full flex-row items-center gap-2">
        <label className="min-w-32 shrink-0">UDT Type:</label>
        <Dropdown
          options={[
            {
              name: "ssri",
              displayName: "SSRI-Compliant UDT",
              iconName: "Coins",
            },
            // {
            //   name: "xudt",
            //   displayName: "xUDT (Legacy Support with ckb-asset-indexer)",
            //   iconName: "Coins",
            // },
          ]}
          selected={udtType}
          onSelect={(value) => setUdtType(value as "ssri" | "xudt")}
          className="flex-grow"
        />
      </div>

      {udtType === "ssri" ? (
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

          <div>
            <div className="flex items-center gap-2">
              <label className="font-bold">UDT Type Args:</label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!paramValues.ssriUDTNotUsingDefault}
                  onChange={async (e) => {
                    setParamValues((prev) => ({
                      ...prev,
                      ssriUDTNotUsingDefault: !e.target.checked,
                    }));
                    if (e.target.checked && signer) {
                      const { script } =
                        await signer.getRecommendedAddressObj();
                      setSsriUDTArgs(script.hash());
                    } else {
                      setSsriUDTArgs("");
                    }
                  }}
                  className="rounded border-gray-300"
                />
                Use Signer as Owner
              </label>
            </div>

            {paramValues.ssriUDTNotUsingDefault && (
              <TextInput
                label=""
                placeholder="Enter UDT type script args"
                state={[ssriUDTArgs, setSsriUDTArgs]}
              />
            )}
          </div>
        </>
      ) : (
        <div>
          <div className="flex items-center gap-2">
            <label className="font-bold">xUDT Args:</label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!paramValues.xudtNotUsingDefault}
                onChange={async (e) => {
                  setParamValues((prev) => ({
                    ...prev,
                    xudtNotUsingDefault: !e.target.checked,
                  }));
                  if (e.target.checked && signer) {
                    const { script } = await signer.getRecommendedAddressObj();
                    setXudtArgs(script.hash());
                  } else {
                    setXudtArgs("");
                  }
                }}
                className="rounded border-gray-300"
              />
              Use Signer as Owner
            </label>
          </div>

          {paramValues.xudtNotUsingDefault && (
            <TextInput
              label=""
              placeholder="Enter xUDT args"
              state={[xudtArgs, setXudtArgs]}
            />
          )}
        </div>
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
        if (
          paramType.type === "scriptAmountArray" ||
          paramType.type === "scriptArray"
        ) {
          return (
            <ScriptAmountArrayInput
              key={`${activeMethod}-param-${index}`}
              label={`Parameter ${index + 1} (${paramType.name})`}
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
                  [`param${index}`]:
                    paramType.type === "scriptArray"
                      ? scriptAmounts.map((item) => item.script)
                      : scriptAmounts,
                }))
              }
              showAmount={paramType.type === "scriptAmountArray"}
            />
          );
        }

        if (paramType.type === "hexArray") {
          return (
            <HexArrayInput
              key={`${activeMethod}-param-${index}`}
              label={`Parameter ${index + 1} (${paramType.name})`}
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
          );
        }

        if (paramType.type == "signer") {
          return (
            <div key={`${activeMethod}-param-${index}`}>
              <div className="flex items-center gap-2">
                <label className="font-bold">
                  Parameter {index + 1} ({paramType.name}): {paramType.type}
                </label>
                {signer && (
                  <label className="flex items-center gap-2 text-sm font-bold">
                    Using Wallet Signer
                  </label>
                )}
                {!signer && (
                  <Button onClick={ccc.useCcc().open} className="text-cyan-500">
                    Wallet
                  </Button>
                )}
              </div>
            </div>
          );
        }

        if (paramType.type == "contextScript") {
          return (
            <div key={`${activeMethod}-param-${index}`}>
              <div className="flex items-center gap-2">
                <label className="font-bold">
                  Parameter {index + 1} ({paramType.name}): {paramType.type}
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

              {paramValues[`param${index}NotUsingDefault`] && (
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
              )}
            </div>
          );
        }

        if (paramType.type == "contextCell") {
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

        if (paramType.type == "tx") {
          return (
            <div key={`${activeMethod}-param-${index}`}>
              <div className="flex items-center gap-2">
                <label className="font-bold">
                  (Optional)Parameter {index + 1} ({paramType.name}):{" "}
                  {paramType.type}
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
        <>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showUDTCallDetails"
              checked={showUDTCallDetails}
              onChange={(e) => setShowUDTCallDetails(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label
              htmlFor="showUDTCallDetails"
              className="text-sm font-medium text-gray-700"
            >
              (Advanced) Show UDT Call Details
            </label>
          </div>

          {showUDTCallDetails && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">
                UDT Call Details
              </label>
              {UDTCallDetails && (
                <div className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                  <JsonView value={UDTCallDetails} style={darkTheme} />
                </div>
              )}
            </div>
          )}
        </>
      )}

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

const methodDefinitions: Record<string, MethodDefinition> = {
  name: {
    params: [{ name: "context", type: "contextScript" }],
    trait: "both",
  },
  symbol: {
    params: [{ name: "context", type: "contextScript" }],
    trait: "both",
  },
  decimals: {
    params: [{ name: "context", type: "contextScript" }],
    trait: "both",
  },
  icon: {
    params: [{ name: "context", type: "contextScript" }],
    trait: "both",
  },
  transfer: {
    params: [
      { name: "signer", type: "signer" },
      { name: "transfers", type: "scriptAmountArray" },
      { name: "tx", type: "tx" },
    ],
    trait: "both",
  },
  mint: {
    params: [
      { name: "signer", type: "signer" },
      { name: "mints", type: "scriptAmountArray" },
      { name: "tx", type: "tx" },
    ],
    trait: "both",
  },
  pause: {
    params: [
      { name: "signer", type: "signer" },
      { name: "locks", type: "scriptArray" },
      { name: "tx", type: "tx" },
      { name: "extraLockHashes", type: "hexArray" },
    ],
    trait: "UDTPausable",
  },
  unpause: {
    params: [
      { name: "signer", type: "signer" },
      { name: "locks", type: "scriptArray" },
      { name: "tx", type: "tx" },
      { name: "extraLockHashes", type: "hexArray" },
    ],
    trait: "UDTPausable",
  },
  isPaused: {
    params: [
      { name: "locks", type: "scriptArray" },
      { name: "extraLockHashes", type: "hexArray" },
    ],
    trait: "UDTPausable",
  },
  enumeratePaused: {
    params: [
      { name: "offset", type: "num" },
      { name: "limit", type: "num" },
    ],
    trait: "UDTPausable",
  },
};

const getMethodParameters = (
  trait: "UDT" | "UDTPausable",
  methodName: string,
): MethodParam[] => {
  const methodDef = methodDefinitions[methodName];
  if (!methodDef) return [];

  // Only return params if the method belongs to the current trait
  // or is available in both traits
  if (methodDef.trait === "both" || methodDef.trait === trait) {
    return methodDef.params;
  }

  return [];
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
