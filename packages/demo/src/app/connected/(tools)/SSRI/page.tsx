"use client";

import { ScriptAmountType } from "@/src/app/connected/(tools)/SSRI/components/ScriptAmountInput";
import { Button } from "@/src/components/Button";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { Dropdown } from "@/src/components/Dropdown";
import { Icon } from "@/src/components/Icon";
import { TextInput } from "@/src/components/Input";
import { useApp } from "@/src/context";
import { ccc } from "@ckb-ccc/connector-react";
import { ssri } from "@ckb-ccc/ssri";
import JsonView from "@uiw/react-json-view";
import { darkTheme } from "@uiw/react-json-view/dark";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ParameterInput } from "./components/ParameterInput";
import { TransactionSkeletonPanel } from "./components/TransactionSkeletonPanel";
import {
  MethodParam,
  MethodParamType,
  PARAM_TYPE_OPTIONS,
  ParamValue,
} from "./types";

const METHODS_OPTIONS = [
  "SSRI.version",
  "SSRI.get_methods",
  "SSRI.has_methods",
  "Customized",
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [methodResult, setMethodResult] = useState<any>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      throw new Error(
        "Could not identify OutPoint from the provided TypeID Args",
      );
    }
    const targetOutPoint = scriptCell.outPoint;
    setContractOutPointTx(targetOutPoint.txHash);
    setContractOutPointIndex(targetOutPoint.index.toString());
  }, [signer, ssriContractTypeIDArgs]);

  useEffect(() => {
    if (contractOutPointTx == "" && contractOutPointIndex == "0") {
      getOutPointFromTypeIDArgs();
    }
  }, [
    ssriContractTypeIDArgs,
    signer,
    getOutPointFromTypeIDArgs,
    contractOutPointTx,
    contractOutPointIndex,
  ]);

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

      const args = methodParams.map((_paramType, index) => {
        const value = paramValues[`Parameter${index}`];
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
      const result = await callSSRI(args, context);
      if (result) {
        try {
          const transaction = ccc.Transaction.fromBytes(
            result.res as ccc.HexLike,
          );
          setTransactionResult(transaction);
        } catch (_e) {}
        setMethodResult(result);
        try {
          const dataURL = ccc.bytesTo(result.res as string, "utf8");
          if (dataURL.startsWith("http") || dataURL.startsWith("data:image")) {
            setIconDataURL(dataURL);
          }
        } catch (_e) {}
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

    async function callSSRI(
      args: ParamValue[],
      context:
        | ssri.ContextScript
        | ssri.ContextCell
        | ssri.ContextTransaction
        | undefined,
    ) {
      if (!contract) return;

      const argsHex = methodParams
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
            case "uint64":
              return ccc.numLeToBytes(arg as number, 8);
            case "uint64Array":
              return ccc.mol.Uint64Vec.encode(arg as number[]);
            case "uint128":
              return ccc.numLeToBytes(arg as number, 16);
            case "uint128Array":
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

      return await contract
        .assertExecutor()
        .runScript(contract.code, rawMethodPath, argsHex, context);
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
                if (value === "SSRI.get_methods") {
                  setMethodParams([
                    { name: "offset", type: "uint64" },
                    { name: "limit", type: "uint64" },
                  ]);
                  setParamValues({
                    Parameter0: 0,
                    Parameter1: 0,
                  });
                } else if (value === "SSRI.has_methods") {
                  setMethodParams([{ name: "methodPaths", type: "hexArray" }]);
                  setParamValues({
                    Parameter0: [],
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
            className="grow"
          />
          <Button onClick={addMethodParam} className="shrink-0">
            <Icon name="Plus" />
          </Button>
        </div>
      )}

      {methodParams.map((param, index) => (
        <ParameterInput
          key={index}
          param={param}
          index={index}
          paramValues={paramValues}
          setParamValues={setParamValues}
          methodToCall={methodToCall}
          rawMethodPath={rawMethodPath}
          methodPathInput={methodPathInput}
          setMethodPathInput={setMethodPathInput}
          onDelete={() => deleteMethodParam(index)}
        />
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
        <TransactionSkeletonPanel
          transactionResult={transactionResult}
          setTransactionResult={setTransactionResult}
          signer={signer}
          methodParams={methodParams}
          paramValues={paramValues}
          contractOutPointTx={contractOutPointTx}
          contractOutPointIndex={contractOutPointIndex}
          log={log}
        />
      )}
      {!isLoading && iconDataURL && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">
            Icon Result
          </label>
          <Image
            className="h-auto max-w-full rounded border border-gray-200"
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
