"use client";

import { FileUploadArea } from "@/src/app/utils/(tools)/FileUpload/page";
import { TxConfirm } from "@/src/app/utils/(tools)/TxConfirm/page";
import { Button } from "@/src/components/Button";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { TextInput } from "@/src/components/Input";
import { Message } from "@/src/components/Message";
import { useApp } from "@/src/context";
import { useGetExplorerLink } from "@/src/utils";
import { ccc } from "@ckb-ccc/connector-react";
import { ReactNode, useCallback, useState } from "react";
import {
  CellFoundSection,
  ClearSelectionButton,
  LoadingMessage,
  TypeIdCellButton,
} from "./DeployScriptComponents";
import { runDeploy } from "./deployLogic";
import { useDeployScript } from "./useDeployScript";

export default function DeployScript() {
  const { createSender } = useApp();
  const { log, error } = createSender("Deploy Script");
  const { explorerTransaction } = useGetExplorerLink();

  const [file, setFile] = useState<File | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isWaitingConfirmation, setIsWaitingConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [confirmationTxHash, setConfirmationTxHash] = useState("");

  const {
    signer,
    userAddress,
    typeIdArgs,
    setTypeIdArgs,
    typeIdCells,
    isScanningCells,
    foundCell,
    foundCellAddress,
    isAddressMatch,
    isCheckingCell,
    cellCheckError,
    handleSelectTypeIdCell,
    clearSelection,
    normalizeTypeIdArgs,
  } = useDeployScript();

  const handleDeploy = useCallback(async () => {
    if (!signer) {
      error("Please connect a wallet first");
      return;
    }
    if (!file) {
      error("Please select a file to deploy");
      return;
    }

    setIsDeploying(true);
    try {
      log("Reading file...");
      const txHash = await runDeploy(
        signer,
        file,
        typeIdArgs,
        foundCell,
        isAddressMatch,
        (msg, ...args) => log(msg, ...(args as ReactNode[])),
        (msg, ...args) => error(msg, ...(args as ReactNode[])),
      );

      if (!txHash) {
        setIsDeploying(false);
        return;
      }

      setIsWaitingConfirmation(true);
      setConfirmationMessage("Waiting for transaction confirmation...");
      setConfirmationTxHash(txHash);

      log("Transaction sent:", explorerTransaction(txHash));
      await signer.client.waitTransaction(txHash);
      log("Transaction committed:", explorerTransaction(txHash));

      setIsWaitingConfirmation(false);
      setConfirmationMessage("");
      setConfirmationTxHash("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      error("Deployment failed:", msg);
      setIsWaitingConfirmation(false);
      setConfirmationMessage("");
      setConfirmationTxHash("");
    } finally {
      setIsDeploying(false);
    }
  }, [
    signer,
    file,
    typeIdArgs,
    foundCell,
    isAddressMatch,
    log,
    error,
    explorerTransaction,
  ]);

  const normalizedInput = normalizeTypeIdArgs(typeIdArgs);

  return (
    <>
      <TxConfirm
        isOpen={isWaitingConfirmation}
        message={confirmationMessage}
        txHash={confirmationTxHash}
      />
      <div className="flex w-full flex-col items-stretch">
        <Message title="Hint" type="info">
          Upload a file to deploy it as a CKB cell with Type ID trait. The file
          will be stored on-chain and can be referenced by its Type ID. Select
          an existing Type ID cell below to update it, or leave empty to create
          a new cell.
        </Message>

        {isScanningCells && (
          <LoadingMessage title="Scanning...">
            Scanning for Type ID cells...
          </LoadingMessage>
        )}

        {typeIdCells.length > 0 && (
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Select Existing Type ID Cell (Optional)
            </label>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {typeIdCells.map((cell, index) => {
                const cellNorm = normalizeTypeIdArgs(
                  cell.cellOutput.type?.args || "",
                );
                const isSelected =
                  cellNorm === normalizedInput && normalizedInput !== "";

                return (
                  <TypeIdCellButton
                    key={ccc.hexFrom(cell.outPoint.toBytes())}
                    cell={cell}
                    index={index}
                    onSelect={() => handleSelectTypeIdCell(cell)}
                    isSelected={isSelected}
                  />
                );
              })}
            </div>
            {typeIdArgs && <ClearSelectionButton onClick={clearSelection} />}
          </div>
        )}

        <TextInput
          label="Type ID Args (Optional - Manual Input)"
          placeholder="Leave empty to create new, or enter existing Type ID args (64 hex chars) to update"
          state={[typeIdArgs, setTypeIdArgs]}
        />

        {isCheckingCell && (
          <LoadingMessage title="Checking...">
            Searching for Type ID cell on-chain...
          </LoadingMessage>
        )}

        {foundCell && !isCheckingCell && (
          <CellFoundSection
            foundCell={foundCell}
            foundCellAddress={foundCellAddress}
            isAddressMatch={isAddressMatch}
            userAddress={userAddress}
          />
        )}

        {cellCheckError && !isCheckingCell && (
          <Message title="Error" type="error">
            {cellCheckError}
          </Message>
        )}

        <FileUploadArea file={file} onFileChange={setFile} />

        <ButtonsPanel>
          <Button
            className="self-center"
            onClick={handleDeploy}
            disabled={!file || isDeploying}
          >
            {isDeploying ? "Deploying..." : "Deploy"}
          </Button>
        </ButtonsPanel>
      </div>
    </>
  );
}
