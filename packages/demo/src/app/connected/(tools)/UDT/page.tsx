"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/src/components/Button";
import { TextInput } from "@/src/components/Input";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { Dropdown } from "@/src/components/Dropdown";
import { ScriptAmountType } from "@/src/app/connected/(tools)/SSRI/components/ScriptAmountInput";
import { udt } from "@ckb-ccc/udt";
import { ccc } from "@ckb-ccc/connector-react";
import JsonView from "@uiw/react-json-view";
import { darkTheme } from "@uiw/react-json-view/dark";
import Image from "next/image";
import { MethodParam, ParamValue } from "../SSRI/types";
import { ParameterInput } from "../SSRI/components/ParameterInput";

export default function UDT() {
  const { signer, createSender, ssriExecutor } = useApp();
  const { log, error } = createSender("UDT");

  const [contractOutPointTx, setContractOutPointTx] = useState<string>("");
  const [contractOutPointIndex, setContractOutPointIndex] =
    useState<string>("0");
  const [udtContract, setUdtContract] = useState<udt.Udt | undefined>(
    undefined,
  );
  const [udtName, setUdtName] = useState<string>("");
  const [udtSymbol, setUdtSymbol] = useState<string>("");
  const [udtDecimals, setUdtDecimals] = useState<BigInt | undefined>(undefined);
  const [udtIcon, setUdtIcon] = useState<string>("");
  const [udtScriptArgs, setUdtScriptArgs] = useState<string>("");
  const [udtScriptArgsNotUsingDefault, setUdtScriptArgsNotUsingDefault] =
    useState<boolean>(false);
  const [udtContractTypeIDArgs, setUdtContractTypeIDArgs] = useState<string>(
    "0x8fd55df879dc6176c95f3c420631f990ada2d4ece978c9512c39616dead2ed56",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [transferTxHash, setTransferTxHash] = useState<string>("");

  const getOutPointFromTypeIDArgs = useCallback(async () => {
    if (!signer) return;
    const scriptCell = await signer.client.findSingletonCellByType({
      codeHash:
        "0x00000000000000000000000000000000000000000000000000545950455f4944",
      hashType: "type",
      args: udtContractTypeIDArgs,
    });
    if (!scriptCell) {
      throw new Error("PUDT script cell not found");
    }
    const targetOutPoint = scriptCell.outPoint;
    setContractOutPointTx(targetOutPoint.txHash);
    setContractOutPointIndex(targetOutPoint.index.toString());
  }, [signer, udtContractTypeIDArgs]);

  useEffect(() => {
    if (contractOutPointTx == "" && contractOutPointIndex == "0") {
      getOutPointFromTypeIDArgs();
    }
  }, [
    udtContractTypeIDArgs,
    signer,
    getOutPointFromTypeIDArgs,
    contractOutPointTx,
    contractOutPointIndex,
  ]);

  const handleTransfer = async () => {
    if (!signer) return;
    if (!ssriExecutor) return;
    if (!udtContract) return;
    await ssriExecutor.confirmStarted();
    const recipientAddressObj = await ccc.Address.fromString(
      recipientAddress,
      signer.client,
    );
    try {
      let rawAmount = BigInt(
        Number(transferAmount) * 10 ** Number(udtDecimals),
      );
      let tx = (
        await udtContract.transfer(signer, [
          { to: recipientAddressObj.script, amount: rawAmount },
        ])
      ).res;
      tx = await udtContract.completeBy(tx, signer);
      await tx.completeFeeBy(signer);
      const hash = await signer.sendTransaction(tx);
      setTransferTxHash(hash);
    } catch (e) {
      error(`Error: ${e}`);
    }
  };

  const handleMint = async () => {
    if (!signer) return;
    if (!ssriExecutor) return;
    if (!udtContract) return;
    await ssriExecutor.confirmStarted();
    const recipientAddressObj = await ccc.Address.fromString(
      recipientAddress,
      signer.client,
    );
    console.log("udtContract Script", udtContract.script);
    try {
      let rawAmount = BigInt(
        Number(transferAmount) * 10 ** Number(udtDecimals),
      );
      let tx = (
        await udtContract.mint(signer, [
          { to: recipientAddressObj.script, amount: rawAmount },
        ])
      ).res;
      await tx.completeFeeBy(signer);
      console.log("tx", tx);
      const hash = await signer.sendTransaction(tx);
      setTransferTxHash(hash);
    } catch (e) {
      error(`Error: ${e}`);
    }
  };
  const getUDTInfo = async () => {
    if (!signer) return;
    if (!ssriExecutor) return;
    await ssriExecutor.confirmStarted();

    // Set loading state and clear previous results
    setIsLoading(true);

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

      let finalScriptArgs = udtScriptArgs;
      if (!udtScriptArgsNotUsingDefault) {
        finalScriptArgs = (
          await signer.getRecommendedAddressObj()
        ).script.hash();
        setUdtScriptArgs(finalScriptArgs);
      }
      const type = ccc.Script.from({
        codeHash: scriptCell.cellOutput.type?.hash(),
        hashType: "type",
        args: finalScriptArgs,
      });

      const contract = new udt.Udt(targetOutPoint, type, {
        executor: ssriExecutor,
      });

      // Check contract is defined before using
      if (!contract) {
        throw new Error("Contract not initialized");
      }

      setUdtContract(contract);

      setUdtName((await contract.name()).res || "");
      setUdtSymbol((await contract.symbol()).res || "");
      setUdtDecimals((await contract.decimals()).res || BigInt(0));
      setUdtIcon((await contract.icon()).res || "");

      // // Check if result contains a transaction to send
      // if (result?.res instanceof ccc.Transaction) {
      //   log("Sending transaction...");
      //   let transaction = result.res;
      //   if (activeMethod === "transfer") {
      //     transaction = await contract.completeBy(result.res, signer);
      //   }
      //   await transaction.completeFeeBy(signer);
      //   const hash = await signer.sendTransaction(transaction);
      //   result.txHash = hash;
      //   log("Transaction sent with hash:", hash);
      // }
    } catch (e) {
      let errorMessage =
        e instanceof Error
          ? e.message
          : typeof e === "object"
            ? "Unexpected error. Please retry or post an issue on GitHub."
            : String(e) || "Unknown error";
      if (String(errorMessage).length < 3) {
        errorMessage =
          "Unexpected error. Please retry or post an issue on GitHub.";
      }
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
              The default parameters are prepared to just work. Just click{" "}
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                Get UDT Info
              </span>{" "}
              button at the bottom.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-semibold text-white">
              2
            </span>
            <div className="flex-1 text-gray-800 dark:text-gray-100">
              With the UDT info, you can try to transfer or mint UDT to
              recipient address.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-semibold text-white">
              3
            </span>
            <div className="flex-1 text-gray-800 dark:text-gray-100">
              All Done! Try playing with other methods while reading{" "}
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

      <div className="flex flex-row items-center gap-2">
        <TextInput
          label="Script Cell Type ID Args (Optional)"
          placeholder="Type ID Args of the script cell"
          state={[udtContractTypeIDArgs, setUdtContractTypeIDArgs]}
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
        label="Script Cell OutPoint Tx"
        placeholder="Tx hash of the Script cell outpoint"
        state={[contractOutPointTx, setContractOutPointTx]}
      />
      <TextInput
        label="Script Cell OutPoint Index"
        placeholder="Index of the script cell outpoint"
        state={[contractOutPointIndex, setContractOutPointIndex]}
      />
      <div>
        <div className="flex items-center gap-2">
          <label>UDT Script Args (Owner Lock Hash):</label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!udtScriptArgsNotUsingDefault}
              onChange={async (e) => {
                setUdtScriptArgsNotUsingDefault(!e.target.checked);
                if (e.target.checked && signer) {
                  const { script } = await signer.getRecommendedAddressObj();
                  setUdtScriptArgs(script.hash());
                } else {
                  setUdtScriptArgs("");
                }
              }}
              className="rounded border-gray-300"
            />
            Use Signer as Owner
          </label>
        </div>
        {udtScriptArgsNotUsingDefault && (
          <div className="flex flex-col gap-2 pl-4 pt-2">
            <TextInput
              label="UDT Script Args (Owner Lock Hash)"
              placeholder="Enter the owner lock hash"
              state={[udtScriptArgs, setUdtScriptArgs]}
            />
          </div>
        )}
      </div>
      {isLoading && (
        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-medium">Loading...</h3>
        </div>
      )}
      {!isLoading && udtDecimals && (
        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-medium">Token Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700">
                Name
              </label>
              <div className="mt-1 text-sm">{udtName || "Not available"}</div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700">
                Symbol
              </label>
              <div className="mt-1 text-sm">{udtSymbol || "Not available"}</div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700">
                Decimals
              </label>
              <div className="mt-1 text-sm">
                {udtDecimals?.toString() || "Not available"}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700">
                Script Args
              </label>
              <div className="mt-1 text-sm">
                {udtScriptArgs || "Not available"}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700">
                Icon
              </label>
              <div className="mt-1">
                {udtIcon ? (
                  <div className="h-8 w-8 overflow-hidden rounded">
                    <Image
                      src={udtIcon}
                      alt="Token Icon"
                      width={32}
                      height={32}
                    />
                  </div>
                ) : (
                  <div className="text-sm">Not available</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {udtDecimals && (
        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-medium">Transfer/Mint UDT</h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label
                htmlFor="recipient"
                className="block text-sm font-bold text-gray-700"
              >
                Recipient Address
              </label>
              <input
                type="text"
                id="recipient"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="Enter recipient address"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-bold text-gray-700"
              >
                Amount
              </label>
              <input
                type="number"
                id="amount"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="Enter actual amount with decimals to transfer/mint"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleTransfer}
                disabled={!recipientAddress || !transferAmount}
              >
                Transfer
              </Button>
              <Button
                onClick={handleMint}
                disabled={!recipientAddress || !transferAmount}
              >
                Mint
              </Button>
            </div>

            {transferTxHash && (
              <div className="rounded-md bg-green-50 p-4">
                <div className="flex">
                  <div className="text-sm text-green-700">
                    Transaction successful! Hash:{" "}
                    <a
                      href={`https://testnet.explorer.nervos.org/transaction/${transferTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline hover:text-blue-800"
                    >
                      {transferTxHash}
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ButtonsPanel>
        <Button onClick={getUDTInfo}>Get UDT Info</Button>
      </ButtonsPanel>
    </div>
  );
}
