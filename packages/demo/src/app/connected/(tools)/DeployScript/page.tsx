"use client";

import { BigButton } from "@/src/components/BigButton";
import { Button } from "@/src/components/Button";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { TextInput } from "@/src/components/Input";
import { Message } from "@/src/components/Message";
import { useApp } from "@/src/context";
import { formatString, useGetExplorerLink } from "@/src/utils";
import { ccc } from "@ckb-ccc/connector-react";
import { Loader2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function readFileAsBytes(file: File): Promise<ccc.Bytes> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(e.target.result));
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

function ConfirmationModal({
  isOpen,
  message,
  txHash,
}: {
  isOpen: boolean;
  message: string;
  txHash?: string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-800">{message}</p>
            {txHash && (
              <p className="mt-2 text-sm break-all text-gray-600">{txHash}</p>
            )}
            <p className="mt-4 text-sm text-gray-500">
              Please wait for transaction confirmation...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function typeIdArgsToFourLines(args: string): string[] {
  const str = args || "";
  if (!str.length) return [];
  const chunkSize = Math.ceil(str.length / 4);
  return [
    str.slice(0, chunkSize),
    str.slice(chunkSize, chunkSize * 2),
    str.slice(chunkSize * 2, chunkSize * 3),
    str.slice(chunkSize * 3),
  ].filter(Boolean);
}

function TypeIdCellButton({
  cell,
  index,
  onSelect,
  isSelected,
}: {
  cell: ccc.Cell;
  index: number;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const typeIdArgs = cell.cellOutput.type?.args || "";
  const dataSize = cell.outputData ? ccc.bytesFrom(cell.outputData).length : 0;
  const fourLines = typeIdArgsToFourLines(typeIdArgs.slice(2));

  return (
    <BigButton
      key={ccc.hexFrom(cell.outPoint.toBytes())}
      size="sm"
      iconName="FileCode"
      onClick={onSelect}
      className={isSelected ? "border-purple-500 bg-purple-50" : ""}
    >
      <div className="text-md flex w-full min-w-0 flex-col">
        <span className="shrink-0 text-xs font-medium text-gray-500">
          #{index + 1}
        </span>
        <div className="mt-1 flex w-full min-w-0 flex-col font-mono text-[10px]">
          {fourLines.map((line, i) => (
            <span key={i} className="truncate">
              {line}
            </span>
          ))}
        </div>
        <span className="mt-2 shrink-0 truncate text-xs text-gray-500">
          {formatFileSize(dataSize)}
        </span>
      </div>
    </BigButton>
  );
}

export default function DeployScript() {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("Deploy Script");

  const { explorerTransaction, explorerAddress } = useGetExplorerLink();

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [typeIdArgs, setTypeIdArgs] = useState<string>("");
  const [isWaitingConfirmation, setIsWaitingConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string>("");
  const [confirmationTxHash, setConfirmationTxHash] = useState<string>("");
  const [foundCell, setFoundCell] = useState<ccc.Cell | null>(null);
  const [foundCellAddress, setFoundCellAddress] = useState<string>("");
  const [userAddress, setUserAddress] = useState<string>("");
  const [isAddressMatch, setIsAddressMatch] = useState<boolean | null>(null);
  const [isCheckingCell, setIsCheckingCell] = useState(false);
  const [cellCheckError, setCellCheckError] = useState<string>("");
  const [typeIdCells, setTypeIdCells] = useState<ccc.Cell[]>([]);
  const [isScanningCells, setIsScanningCells] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastCheckedTypeIdRef = useRef<string>("");
  const isCheckingRef = useRef<boolean>(false);
  const { client } = ccc.useCcc();

  const resetCellCheckState = useCallback((errorMessage = "") => {
    setFoundCell(null);
    setFoundCellAddress("");
    setIsAddressMatch(null);
    setCellCheckError(errorMessage);
  }, []);

  // Get user's wallet address
  useEffect(() => {
    if (!signer) {
      setUserAddress("");
      setIsAddressMatch(null);
      return;
    }

    signer
      .getRecommendedAddress()
      .then((addr) => setUserAddress(addr))
      .catch((err) => {
        console.error("Failed to get recommended address:", err);
        setUserAddress("");
        error("Failed to get wallet address");
      });
  }, [signer, error]);

  // Scan for all Type ID cells locked under the user's address
  useEffect(() => {
    if (!signer) {
      setTypeIdCells([]);
      return;
    }

    setIsScanningCells(true);
    (async () => {
      try {
        const { script: lock } = await signer.getRecommendedAddressObj();
        const typeIdScript = await ccc.Script.fromKnownScript(
          signer.client,
          ccc.KnownScript.TypeId,
          "",
        );

        const cells: ccc.Cell[] = [];
        for await (const cell of signer.client.findCells({
          script: typeIdScript,
          scriptType: "type",
          scriptSearchMode: "prefix",
          withData: true,
          filter: {
            script: lock,
          },
        })) {
          cells.push(cell);
          setTypeIdCells([...cells]);
        }
      } catch (err) {
        console.error("Error scanning Type ID cells:", err);
      } finally {
        setIsScanningCells(false);
      }
    })();
  }, [signer]);

  // Compare addresses when both are available
  useEffect(() => {
    if (userAddress && foundCellAddress) {
      setIsAddressMatch(userAddress === foundCellAddress);
    } else {
      setIsAddressMatch(null);
    }
  }, [userAddress, foundCellAddress]);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle selecting a Type ID cell from the scanned list
  const handleSelectTypeIdCell = async (cell: ccc.Cell) => {
    const cellTypeIdArgs = cell.cellOutput.type?.args || "";

    // Set the typeIdArgs
    setTypeIdArgs(cellTypeIdArgs);

    // Directly set the found cell since we already have it
    setFoundCell(cell);

    // Calculate and set the cell's lock address
    try {
      const address = ccc.Address.fromScript(
        cell.cellOutput.lock,
        client,
      ).toString();
      setFoundCellAddress(address);
      setCellCheckError("");

      // Since we scanned cells locked under user's address, address always matches
      setIsAddressMatch(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      resetCellCheckState(`Error getting cell address: ${errorMessage}`);
    }

    // Update the last checked ref to prevent redundant lookup
    const normalizedTypeIdArgs = cellTypeIdArgs.startsWith("0x")
      ? cellTypeIdArgs.slice(2)
      : cellTypeIdArgs;
    lastCheckedTypeIdRef.current = normalizedTypeIdArgs;
  };

  // Automatically check Type ID cell when typeIdArgs changes (for manual input)
  useEffect(() => {
    // Normalize Type ID args for comparison
    const normalizedTypeIdArgs = typeIdArgs.trim().startsWith("0x")
      ? typeIdArgs.trim().slice(2)
      : typeIdArgs.trim();

    // Skip if already checked this value or currently checking
    if (
      lastCheckedTypeIdRef.current === normalizedTypeIdArgs ||
      isCheckingRef.current
    ) {
      return;
    }

    // If empty, just clear state
    if (!typeIdArgs.trim()) {
      lastCheckedTypeIdRef.current = "";
      resetCellCheckState();
      return;
    }

    const checkTypeIdCell = async () => {
      // Mark as checking to prevent concurrent checks
      if (isCheckingRef.current) {
        return;
      }
      isCheckingRef.current = true;
      lastCheckedTypeIdRef.current = normalizedTypeIdArgs;

      // Validate length
      try {
        const typeIdBytes = ccc.bytesFrom(normalizedTypeIdArgs);
        if (typeIdBytes.length !== 32) {
          resetCellCheckState(
            "Type ID args must be 32 bytes (64 hex characters)",
          );
          isCheckingRef.current = false;
          return;
        }
      } catch {
        resetCellCheckState("Invalid Type ID args format");
        isCheckingRef.current = false;
        return;
      }

      setIsCheckingCell(true);
      setCellCheckError("");

      try {
        const typeIdScript = await ccc.Script.fromKnownScript(
          client,
          ccc.KnownScript.TypeId,
          normalizedTypeIdArgs,
        );

        const cell = await client.findSingletonCellByType(typeIdScript, true);

        if (cell) {
          setFoundCell(cell);
          const address = ccc.Address.fromScript(
            cell.cellOutput.lock,
            client,
          ).toString();
          setFoundCellAddress(address);
          setCellCheckError("");
          // Address comparison will be handled by useEffect
        } else {
          resetCellCheckState("Type ID cell not found on-chain");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        resetCellCheckState(`Error checking Type ID: ${errorMessage}`);
      } finally {
        setIsCheckingCell(false);
        isCheckingRef.current = false;
      }
    };

    // Debounce the check
    const timeoutId = setTimeout(checkTypeIdCell, 500);
    return () => {
      clearTimeout(timeoutId);
    };
  });

  const handleDeploy = async () => {
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
      const fileBytes = await readFileAsBytes(file);

      log("Building transaction...");
      const { script } = await signer.getRecommendedAddressObj();

      let tx: ccc.Transaction;
      let typeIdArgsValue: string;

      if (typeIdArgs.trim() !== "") {
        // Update existing Type ID cell
        if (!foundCell) {
          error("Type ID cell not found. Please check the Type ID args.");
          return;
        }

        // Check if addresses match
        if (isAddressMatch === false) {
          error(
            "Cannot update cell: The cell's lock address does not match your wallet address. You cannot unlock this cell.",
          );
          return;
        }

        // Normalize Type ID args - remove 0x prefix if present
        const normalizedTypeIdArgs = typeIdArgs.trim().startsWith("0x")
          ? typeIdArgs.trim().slice(2)
          : typeIdArgs.trim();

        log("Updating existing Type ID cell...");

        // Create transaction to update the cell
        tx = ccc.Transaction.from({
          inputs: [
            {
              previousOutput: foundCell.outPoint,
            },
          ],
          outputs: [
            {
              ...foundCell.cellOutput,
              capacity: ccc.Zero, // Zero capacity means the cell will be replaced with a new one
            },
          ],
          outputsData: [fileBytes],
        });

        typeIdArgsValue = normalizedTypeIdArgs;
      } else {
        // Create new Type ID cell
        tx = ccc.Transaction.from({
          outputs: [
            {
              lock: script,
              type: await ccc.Script.fromKnownScript(
                signer.client,
                ccc.KnownScript.TypeId,
                "00".repeat(32),
              ),
            },
          ],
          outputsData: [fileBytes],
        });

        // Complete inputs for capacity
        await tx.completeInputsAddOne(signer);

        // Generate type_id from first input and output index
        if (!tx.outputs[0].type) {
          throw new Error("Unexpected disappeared output");
        }
        tx.outputs[0].type.args = ccc.hashTypeId(tx.inputs[0], 0);
        typeIdArgsValue = tx.outputs[0].type.args;

        log("Type ID created:", typeIdArgsValue);
      }

      // Complete fees
      await tx.completeFeeBy(signer);

      // Sign and send the transaction
      log("Sending transaction...");
      const txHash = await signer.sendTransaction(tx);
      log("Transaction sent:", explorerTransaction(txHash));

      // Show blocking confirmation modal
      setIsWaitingConfirmation(true);
      setConfirmationMessage("Waiting for transaction confirmation...");
      setConfirmationTxHash(txHash);

      await signer.client.waitTransaction(txHash);
      log("Transaction committed:", explorerTransaction(txHash));

      // Close modal after confirmation
      setIsWaitingConfirmation(false);
      setConfirmationMessage("");
      setConfirmationTxHash("");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      error("Deployment failed:", errorMessage);
      setIsWaitingConfirmation(false);
      setConfirmationMessage("");
      setConfirmationTxHash("");
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <>
      <ConfirmationModal
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
          <Message title="Scanning..." type="info">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
              <span>Scanning for Type ID cells...</span>
            </div>
          </Message>
        )}

        {typeIdCells.length > 0 && (
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Select Existing Type ID Cell (Optional)
            </label>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {typeIdCells.map((cell, index) => {
                const cellTypeIdArgs = cell.cellOutput.type?.args || "";
                const normalizedCellTypeIdArgs = cellTypeIdArgs.startsWith("0x")
                  ? cellTypeIdArgs.slice(2)
                  : cellTypeIdArgs;
                const normalizedTypeIdArgs = typeIdArgs.trim().startsWith("0x")
                  ? typeIdArgs.trim().slice(2)
                  : typeIdArgs.trim();
                const isSelected =
                  normalizedCellTypeIdArgs === normalizedTypeIdArgs &&
                  normalizedTypeIdArgs !== "";

                return (
                  <TypeIdCellButton
                    key={ccc.hexFrom(cell.outPoint.toBytes())}
                    cell={cell}
                    index={index}
                    onSelect={() => {
                      handleSelectTypeIdCell(cell);
                    }}
                    isSelected={isSelected}
                  />
                );
              })}
            </div>
            {typeIdArgs && (
              <Button
                variant="info"
                className="mt-2"
                onClick={() => {
                  setTypeIdArgs("");
                  setFoundCell(null);
                  setFoundCellAddress("");
                  setIsAddressMatch(null);
                  setCellCheckError("");
                }}
              >
                Clear Selection
              </Button>
            )}
          </div>
        )}

        <TextInput
          label="Type ID Args (Optional - Manual Input)"
          placeholder="Leave empty to create new, or enter existing Type ID args (64 hex chars) to update"
          state={[typeIdArgs, setTypeIdArgs]}
        />

        {isCheckingCell && (
          <Message title="Checking..." type="info">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
              <span>Searching for Type ID cell on-chain...</span>
            </div>
          </Message>
        )}

        {foundCell && !isCheckingCell && (
          <>
            <Message title="Cell Found" type="success">
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-medium">Transaction:</span>{" "}
                  {explorerTransaction(foundCell.outPoint.txHash)}
                </p>
                <p>
                  <span className="font-medium">Index:</span>{" "}
                  {foundCell.outPoint.index}
                </p>
                <p>
                  <span className="font-medium">Capacity:</span>{" "}
                  {ccc.fixedPointToString(foundCell.cellOutput.capacity)} CKB
                </p>
                <p>
                  <span className="font-medium">Lock Address:</span>{" "}
                  {explorerAddress(
                    foundCellAddress,
                    formatString(foundCellAddress, 8, 6),
                  )}
                </p>
                {foundCell.outputData && (
                  <p>
                    <span className="font-medium">Data Size:</span>{" "}
                    {formatFileSize(ccc.bytesFrom(foundCell.outputData).length)}
                  </p>
                )}
              </div>
            </Message>
            {isAddressMatch === false && (
              <Message title="Address Mismatch Warning" type="error">
                <div className="space-y-1 text-sm">
                  <p>
                    The cell&apos;s lock address does not match your wallet
                    address. You will not be able to unlock this cell to update
                    it.
                  </p>
                  <p className="mt-2">
                    <span className="font-medium">Cell Lock:</span>{" "}
                    {explorerAddress(
                      foundCellAddress,
                      formatString(foundCellAddress, 8, 6),
                    )}
                  </p>
                  <p>
                    <span className="font-medium">Your Address:</span>{" "}
                    {userAddress
                      ? explorerAddress(
                          userAddress,
                          formatString(userAddress, 8, 6),
                        )
                      : "Not connected"}
                  </p>
                  <p className="mt-2 font-semibold">
                    Deployment will fail because you cannot unlock this cell.
                  </p>
                </div>
              </Message>
            )}
            {isAddressMatch === true && (
              <Message title="Address Match" type="success">
                <div className="text-sm">
                  The cell&apos;s lock address matches your wallet address. You
                  can update this cell.
                </div>
              </Message>
            )}
          </>
        )}

        {cellCheckError && !isCheckingCell && (
          <Message title="Error" type="error">
            {cellCheckError}
          </Message>
        )}

        <div
          className={`relative my-4 rounded-lg border-2 border-dashed p-8 transition-colors ${
            isDragging
              ? "border-purple-500 bg-purple-50"
              : "border-gray-300 bg-white/75"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileInputChange}
          />

          {!file ? (
            <div className="flex flex-col items-center justify-center gap-4">
              <Upload className="h-12 w-12 text-gray-400" />
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-700">
                  Drag and drop a file here, or click to select
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  Select a file from your computer
                </p>
              </div>
              <Button
                variant="info"
                onClick={() => fileInputRef.current?.click()}
              >
                Select File
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <Upload className="h-5 w-5 text-purple-500" />
                    <p className="text-lg font-semibold text-gray-800">
                      {file.name}
                    </p>
                  </div>
                  <div className="ml-7 space-y-1 text-sm text-gray-600">
                    <p>
                      <span className="font-medium">Size:</span>{" "}
                      {formatFileSize(file.size)}
                    </p>
                    <p>
                      <span className="font-medium">Type:</span>{" "}
                      {file.type || "Unknown"}
                    </p>
                    <p>
                      <span className="font-medium">Modified:</span>{" "}
                      {formatDate(new Date(file.lastModified))}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClearFile}
                  className="ml-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Clear file"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <Button
                variant="info"
                onClick={() => fileInputRef.current?.click()}
                className="self-start"
              >
                Change File
              </Button>
            </div>
          )}
        </div>

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
