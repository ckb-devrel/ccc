"use client";

import { Button } from "@/src/components/Button";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { TextInput } from "@/src/components/Input";
import { Message } from "@/src/components/Message";
import { useApp } from "@/src/context";
import { useGetExplorerLink } from "@/src/utils";
import { ccc, SignerBtc } from "@ckb-ccc/connector-react";
import {
  BtcAssetApiConfig,
  buildNetworkConfig,
  CkbRgbppUnlockSigner,
  ClientScriptProvider,
  createBrowserRgbppBtcWallet,
  getSupportedWallets,
  isMainnet,
  NetworkConfig,
  PredefinedNetwork,
  RgbppScriptName,
  RgbppUdtClient,
} from "@ckb-ccc/rgbpp";
import { Udt } from "@ckb-ccc/udt";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ProcessStep =
  | "idle"
  | "checking-cell"
  | "creating-cell"
  | "building-tx"
  | "signing-btc"
  | "waiting-btc"
  | "signing-ckb"
  | "waiting-ckb"
  | "completed";

export default function TransferRGBPPXUdt() {
  const { signer, createSender } = useApp();
  const sender = useMemo(
    () => createSender("Transfer RGB++ xUDT"),
    [createSender],
  );
  const { error, log } = sender;
  // Use ref to store error function to avoid re-running effects when it changes
  const errorRef = useRef(error);
  useEffect(() => {
    errorRef.current = error;
  }, [error]);
  const { explorerTransaction } = useGetExplorerLink();

  const [rgbppBtcTxId, setRgbppBtcTxId] = useState<string>("");
  const [rgbppCkbTxId, setRgbppCkbTxId] = useState<string>("");
  const [rgbppBalance, setRgbppBalance] = useState<{
    address: string;
    xudt: Array<{
      symbol: string;
      name: string;
      decimal: number;
      type_hash: string;
      type_script: {
        codeHash: string;
        args: string;
        hashType: string;
      };
      total_amount: string;
      available_amount: string;
      pending_amount: string;
    }>;
  } | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);
  const [selectedToken, setSelectedToken] = useState<{
    symbol: string;
    name: string;
    decimal: number;
    type_hash: string;
    type_script: {
      codeHash: string;
      args: string;
      hashType: string;
    };
    available_amount: string;
  } | null>(null);
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [receiverAddress, setReceiverAddress] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<ProcessStep>("idle");
  const [stepMessage, setStepMessage] = useState<string>("");

  const [networkConfig, setNetworkConfig] = useState<NetworkConfig | null>(
    null,
  );
  const [ckbClient, setCkbClient] = useState<ccc.Client | null>(null);
  const [rgbppUdtClient, setRgbppUdtClient] = useState<RgbppUdtClient | null>(
    null,
  );

  const getBtcExplorerLink = useCallback(
    (txId: string) => {
      const baseUrl = networkConfig?.isMainnet
        ? "https://mempool.space/tx/"
        : "https://mempool.space/testnet/tx/";
      return (
        <a
          className="text-blue-600 underline hover:text-blue-800"
          href={`${baseUrl}${txId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {txId}
        </a>
      );
    },
    [networkConfig?.isMainnet],
  );

  useEffect(() => {
    if (!signer) {
      setNetworkConfig(null);
      setCkbClient(null);
      setRgbppUdtClient(null);
      return;
    }

    let network: PredefinedNetwork;
    if (signer.client.addressPrefix === "ckb") {
      network = PredefinedNetwork.BitcoinMainnet;
    } else if (signer.client.addressPrefix === "ckt") {
      // * use Testnet3 as default
      network = PredefinedNetwork.BitcoinTestnet3;
    } else {
      errorRef.current(
        `Unsupported network prefix: ${signer.client.addressPrefix}`,
      );
      return;
    }

    const config = buildNetworkConfig(network);
    setNetworkConfig(config);

    const client = isMainnet(network)
      ? new ccc.ClientPublicMainnet()
      : new ccc.ClientPublicTestnet();
    setCkbClient(client);

    const scriptProvider = new ClientScriptProvider(client);
    const udtClient = new RgbppUdtClient(config, client, scriptProvider);
    setRgbppUdtClient(udtClient);
  }, [signer]);

  const rgbppBtcWallet = useMemo(() => {
    if (!signer || !(signer instanceof SignerBtc) || !networkConfig) {
      return null;
    }

    const config: BtcAssetApiConfig = {
      url: process.env.NEXT_PUBLIC_BTC_ASSETS_API_URL!,
      token: process.env.NEXT_PUBLIC_BTC_ASSETS_API_TOKEN,
      origin: process.env.NEXT_PUBLIC_BTC_ASSETS_API_ORIGIN,
      isMainnet: networkConfig.isMainnet,
    };

    return createBrowserRgbppBtcWallet(signer, networkConfig, config);
  }, [signer, networkConfig]);

  useEffect(() => {
    if (
      signer &&
      signer instanceof SignerBtc &&
      networkConfig &&
      !rgbppBtcWallet
    ) {
      errorRef.current(
        `Unsupported wallet type: ${signer.constructor.name}. Supported wallets: ${getSupportedWallets().join(", ")}`,
      );
    }
  }, [signer, networkConfig, rgbppBtcWallet]);

  useEffect(() => {
    if (!rgbppBtcWallet) {
      setRgbppBalance(null);
      setIsLoadingBalance(false);
      return;
    }

    setIsLoadingBalance(true);

    rgbppBtcWallet
      .getAddress()
      .then(async (address) => {
        // TODO: add method to rgbppBtcWallet (fgh)
        // Load RGB++ balance
        const apiUrl = process.env.NEXT_PUBLIC_BTC_ASSETS_API_URL!;
        const apiToken = process.env.NEXT_PUBLIC_BTC_ASSETS_API_TOKEN;
        const apiOrigin = process.env.NEXT_PUBLIC_BTC_ASSETS_API_ORIGIN;

        const headers: Record<string, string> = {};
        if (apiToken && apiOrigin) {
          headers.authorization = `Bearer ${apiToken}`;
          headers.origin = apiOrigin;
        }

        const balanceUrl = `${apiUrl}/rgbpp/v1/address/${address}/balance`;

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout

        try {
          const balanceResponse = await fetch(balanceUrl, {
            method: "GET",
            headers,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!balanceResponse.ok) {
            throw new Error(
              `Failed to fetch RGB++ balance: ${balanceResponse.status} ${balanceResponse.statusText}`,
            );
          }

          const balanceData = await balanceResponse.json();

          // Validate response structure
          if (
            !balanceData ||
            typeof balanceData !== "object" ||
            !balanceData.address
          ) {
            throw new Error("Invalid response format from RGB++ balance API");
          }

          setRgbppBalance(balanceData);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error && fetchError.name === "AbortError") {
            throw new Error(
              "Request timeout: The server took too long to respond",
            );
          }
          throw fetchError;
        }

        await new Promise((resolve) => setTimeout(resolve, 800));

        setIsLoadingBalance(false);
      })
      .catch((err) => {
        errorRef.current("Failed to load data:", String(err));
        setRgbppBalance(null);
        setIsLoadingBalance(false);
      });
  }, [rgbppBtcWallet]);

  const [ckbRgbppUnlockSigner, setCkbRgbppUnlockSigner] =
    useState<CkbRgbppUnlockSigner>();

  useEffect(() => {
    if (!ckbClient || !rgbppBtcWallet || !rgbppUdtClient) {
      setCkbRgbppUnlockSigner(undefined);
      return;
    }

    let mounted = true;
    rgbppBtcWallet.getAddress().then(async (address: string) => {
      if (mounted) {
        const scriptInfos = await rgbppUdtClient.getRgbppScriptInfos();
        setCkbRgbppUnlockSigner(
          new CkbRgbppUnlockSigner({
            ckbClient,
            rgbppBtcAddress: address,
            btcDataSource: rgbppBtcWallet,
            scriptInfos: scriptInfos as Record<RgbppScriptName, ccc.ScriptInfo>,
          }),
        );
      }
    });
    return () => {
      mounted = false;
    };
  }, [ckbClient, rgbppBtcWallet, rgbppUdtClient]);

  const signRgbppBtcTx = useCallback(async () => {
    if (
      !signer ||
      !(signer instanceof SignerBtc) ||
      !rgbppBtcWallet ||
      !ckbRgbppUnlockSigner ||
      !rgbppUdtClient ||
      !selectedToken ||
      !transferAmount ||
      !receiverAddress
    ) {
      return;
    }

    try {
      setCurrentStep("building-tx");
      setStepMessage("Building RGB++ transaction...");
      setRgbppBtcTxId("");
      setRgbppCkbTxId("");

      const btcAccount = await signer.getBtcAccount();

      // Get UDT script info from the selected token
      const udtScriptInfo = await signer.client.getKnownScript(
        ccc.KnownScript.XUdt,
      );

      // Create UDT instance
      const udtInstance = new Udt(
        udtScriptInfo.cellDeps[0].cellDep.outPoint,
        ccc.Script.from({
          codeHash: selectedToken.type_script.codeHash,
          hashType: selectedToken.type_script.hashType as ccc.HashType,
          args: selectedToken.type_script.args,
        }),
      );

      // Build pseudo RGB++ lock script
      const pseudoRgbppLock = await rgbppUdtClient.buildPseudoRgbppLockScript();

      // Parse transfer amount
      const amount = parseFloat(transferAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Invalid transfer amount");
      }
      const amountInSmallestUnit = BigInt(
        Math.floor(amount * 10 ** selectedToken.decimal),
      );

      // Create transfer transaction
      const { res: tx } = await udtInstance.transfer(signer, [
        {
          to: pseudoRgbppLock,
          amount: ccc.fixedPointFrom(amountInSmallestUnit),
        },
      ]);

      // Complete change to lock
      const txWithInputs = await udtInstance.completeChangeToLock(
        tx,
        ckbRgbppUnlockSigner,
        pseudoRgbppLock,
      );

      setCurrentStep("signing-btc");
      setStepMessage("Building and signing BTC transaction...");

      // Build PSBT
      const { psbt, indexedCkbPartialTx } = await rgbppBtcWallet.buildPsbt({
        ckbPartialTx: txWithInputs,
        ckbClient: signer.client,
        rgbppUdtClient,
        btcChangeAddress: btcAccount,
        receiverBtcAddresses: [receiverAddress],
        feeRate: 5,
      });

      const btcTxId = await rgbppBtcWallet.signAndBroadcast(psbt);
      setRgbppBtcTxId(btcTxId);

      setCurrentStep("waiting-btc");
      setStepMessage(`Waiting for BTC transaction to be confirmed...`);
      log("BTC Transaction:", getBtcExplorerLink(btcTxId));

      const ckbPartialTxInjected = await rgbppUdtClient.injectTxIdToRgbppCkbTx(
        indexedCkbPartialTx,
        btcTxId,
      );
      const rgbppSignedCkbTx =
        await ckbRgbppUnlockSigner.signTransaction(ckbPartialTxInjected);
      await rgbppSignedCkbTx.completeFeeBy(signer);

      setCurrentStep("waiting-ckb");
      setStepMessage("Waiting for CKB transaction to be confirmed...");

      const ckbFinalTxId = await signer.sendTransaction(rgbppSignedCkbTx);
      setRgbppCkbTxId(ckbFinalTxId);
      log("CKB Transaction:", explorerTransaction(ckbFinalTxId));

      await signer.client.waitTransaction(ckbFinalTxId);

      setCurrentStep("completed");
      setStepMessage("RGB++ xUDT transferred successfully!");
      setTransferAmount("");
      setReceiverAddress("");
      setSelectedToken(null);
    } catch (err) {
      setCurrentStep("idle");
      setStepMessage("");
      errorRef.current("Transaction failed:", String(err));
    }
  }, [
    signer,
    selectedToken,
    transferAmount,
    receiverAddress,
    rgbppBtcWallet,
    rgbppUdtClient,
    ckbRgbppUnlockSigner,
    log,
    explorerTransaction,
    getBtcExplorerLink,
  ]);

  if (!networkConfig || !ckbClient || !rgbppUdtClient) {
    return (
      <div className="flex w-full flex-col items-center justify-center">
        <div>Initializing network configuration...</div>
      </div>
    );
  }

  if (signer && signer instanceof SignerBtc && !rgbppBtcWallet) {
    return (
      <div className="flex w-full flex-col items-stretch">
        <Message title="Unsupported Wallet" type="error">
          This wallet is not supported for RGB++ operations.
          <br />
          <strong>Supported wallets:</strong> {getSupportedWallets().join(", ")}
          <br />
          Please connect with a supported wallet to continue.
        </Message>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-stretch">
      <Message title="Hint" type="info">
        You will need to sign 2transactions.
        <br />
        <strong>
          Current Network:{" "}
          {networkConfig.isMainnet
            ? "BTC Mainnet & CKB Mainnet"
            : "BTC Testnet3 & CKB Testnet"}
        </strong>
      </Message>

      <div className="flex flex-col gap-4">
        {/* RGB++ Balance Display */}
        <div className="flex flex-col">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              RGB++ xUDT Balance
            </label>
            <Button
              variant="info"
              className="h-8 px-3 py-1 text-xs"
              disabled={isLoadingBalance}
              onClick={async () => {
                if (!rgbppBtcWallet) return;
                try {
                  setIsLoadingBalance(true);
                  const address = await rgbppBtcWallet.getAddress();

                  const apiUrl = process.env.NEXT_PUBLIC_BTC_ASSETS_API_URL!;
                  const apiToken = process.env.NEXT_PUBLIC_BTC_ASSETS_API_TOKEN;
                  const apiOrigin =
                    process.env.NEXT_PUBLIC_BTC_ASSETS_API_ORIGIN;

                  const headers: Record<string, string> = {};
                  if (apiToken && apiOrigin) {
                    headers.authorization = `Bearer ${apiToken}`;
                    headers.origin = apiOrigin;
                  }

                  const balanceUrl = `${apiUrl}/rgbpp/v1/address/${address}/balance`;

                  // Create AbortController for timeout
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout

                  try {
                    const balanceResponse = await fetch(balanceUrl, {
                      method: "GET",
                      headers,
                      signal: controller.signal,
                    });

                    clearTimeout(timeoutId);

                    if (!balanceResponse.ok) {
                      throw new Error(
                        `Failed to fetch RGB++ balance: ${balanceResponse.status} ${balanceResponse.statusText}`,
                      );
                    }

                    const balanceData = await balanceResponse.json();

                    // Validate response structure
                    if (
                      !balanceData ||
                      typeof balanceData !== "object" ||
                      !balanceData.address
                    ) {
                      throw new Error(
                        "Invalid response format from RGB++ balance API",
                      );
                    }

                    await new Promise((resolve) => setTimeout(resolve, 800));

                    setRgbppBalance(balanceData);
                  } catch (fetchError) {
                    clearTimeout(timeoutId);
                    if (
                      fetchError instanceof Error &&
                      fetchError.name === "AbortError"
                    ) {
                      throw new Error(
                        "Request timeout: The server took too long to respond",
                      );
                    }
                    throw fetchError;
                  }
                  setIsLoadingBalance(false);
                } catch (err) {
                  errorRef.current(
                    "Failed to refresh RGB++ balance:",
                    String(err),
                  );
                  setIsLoadingBalance(false);
                }
              }}
            >
              {isLoadingBalance ? "Loading..." : "Refresh"}
            </Button>
          </div>
          {isLoadingBalance ? (
            <div className="rounded-md border border-gray-300 bg-gray-50 p-4 text-center">
              <div className="flex items-center justify-center">
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent"></div>
                <p className="text-sm text-gray-600">
                  Loading RGB++ balance...
                </p>
              </div>
            </div>
          ) : rgbppBalance === null ? (
            <div className="rounded-md border border-gray-300 bg-gray-50 p-4 text-center">
              <p className="text-sm text-gray-600">
                No RGB++ balance data available
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-gray-300 bg-gray-50 p-4">
              <div className="space-y-2 text-sm">
                <div className="mb-2 flex items-center justify-between text-sm font-medium text-gray-500">
                  <span>xUDT Tokens ({rgbppBalance.xudt.length})</span>
                  <span>Amount</span>
                </div>
                {rgbppBalance.xudt.length === 0 ? (
                  <p className="text-sm text-gray-500">No xUDT tokens found</p>
                ) : (
                  <div className="max-h-[8rem] space-y-1 overflow-y-auto">
                    {rgbppBalance.xudt.map((token, index) => {
                      const availableAmount = BigInt(token.available_amount);
                      const divisor = BigInt(10 ** token.decimal);
                      const amountFormatted = (
                        Number(availableAmount) / Number(divisor)
                      ).toLocaleString(undefined, {
                        maximumFractionDigits: token.decimal,
                      });

                      const isSelected =
                        selectedToken?.type_hash === token.type_hash;

                      return (
                        <div
                          key={`${token.type_hash}-${index}`}
                          className={`flex cursor-pointer items-center justify-between rounded border px-3 py-2 text-sm transition-colors ${
                            isSelected
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                          onClick={() => {
                            setSelectedToken({
                              symbol: token.symbol,
                              name: token.name,
                              decimal: token.decimal,
                              type_hash: token.type_hash,
                              type_script: token.type_script,
                              available_amount: token.available_amount,
                            });
                            console.log("selectedToken", token.type_script);
                            setTransferAmount("");
                            setReceiverAddress("");
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {token.symbol}
                            </span>
                            <span className="text-gray-500">
                              ({token.name})
                            </span>
                            <span className="text-xs text-gray-400">
                              Decimal: {token.decimal}
                            </span>
                          </div>
                          <span className="font-medium text-green-600">
                            {amountFormatted}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Transfer Form */}
        {selectedToken && (
          <div className="flex flex-col gap-4 rounded-md border border-blue-200 bg-blue-50 p-4">
            <div>
              <div className="text-sm font-medium text-blue-900">
                Transfer: {selectedToken.symbol} ({selectedToken.name})
              </div>
              <div className="mt-1 text-xs text-gray-600">
                Available:{" "}
                {(
                  Number(BigInt(selectedToken.available_amount)) /
                  Number(BigInt(10 ** selectedToken.decimal))
                ).toLocaleString(undefined, {
                  maximumFractionDigits: selectedToken.decimal,
                })}{" "}
                {selectedToken.symbol}
              </div>
            </div>
            <div className="relative bg-white/75 p-4">
              <label className="text-sm">Amount</label>
              <input
                className="w-full border-b-2 border-solid border-gray-300 bg-transparent px-4 py-2 text-gray-700 focus:border-solid focus:outline-none"
                type="number"
                step={`${1 / 10 ** selectedToken.decimal}`}
                min="0"
                max={`${Number(BigInt(selectedToken.available_amount)) / Number(BigInt(10 ** selectedToken.decimal))}`}
                value={transferAmount}
                onInput={(e) => setTransferAmount(e.currentTarget.value)}
                placeholder="Enter amount"
              />
            </div>
            <TextInput
              label="Receiver BTC Address"
              state={[receiverAddress, setReceiverAddress]}
              placeholder="Enter Bitcoin address (e.g., tb1q...)"
            />
          </div>
        )}
      </div>

      {/* Status Display */}
      {currentStep !== "idle" && (
        <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center">
            {currentStep !== "completed" && (
              <div className="mr-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-blue-800">{stepMessage}</p>
              {currentStep === "waiting-btc" && rgbppBtcTxId && (
                <p className="mt-1 text-xs text-blue-600">
                  BTC Transaction: {getBtcExplorerLink(rgbppBtcTxId)}
                </p>
              )}
              {currentStep === "completed" && rgbppBtcTxId && rgbppCkbTxId && (
                <div className="mt-1 text-xs text-blue-600">
                  <p>BTC Transaction: {getBtcExplorerLink(rgbppBtcTxId)}</p>
                  <p>CKB Transaction: {explorerTransaction(rgbppCkbTxId)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ButtonsPanel>
        <Button
          onClick={signRgbppBtcTx}
          disabled={
            !rgbppBtcWallet ||
            (currentStep !== "idle" && currentStep !== "completed") ||
            !selectedToken ||
            !transferAmount ||
            !receiverAddress
          }
        >
          {currentStep === "idle" || currentStep === "completed"
            ? "Transfer"
            : "Processing..."}
        </Button>
      </ButtonsPanel>
    </div>
  );
}
