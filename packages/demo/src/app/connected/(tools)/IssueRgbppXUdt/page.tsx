"use client";

import { Button } from "@/src/components/Button";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { Dropdown } from "@/src/components/Dropdown";
import { Message } from "@/src/components/Message";
import { useApp } from "@/src/context";
import { useGetExplorerLink } from "@/src/utils";
import { ccc, SignerBtc } from "@ckb-ccc/connector-react";
import {
  BtcApiUtxo,
  BtcAssetApiConfig,
  buildNetworkConfig,
  CkbRgbppUnlockSinger,
  createBrowserRgbppBtcWallet,
  getSupportedWallets,
  isMainnet,
  NetworkConfig,
  PredefinedNetwork,
  RgbppUdtClient,
  UtxoSeal,
} from "@ckb-ccc/rgbpp";
import { useCallback, useEffect, useMemo, useState } from "react";

const issuanceAmount = BigInt(21000000);
const xudtToken = {
  name: "Just xUDT",
  symbol: "jxUDT",
  decimal: 8,
};

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

export default function IssueRGBPPXUdt() {
  const { signer, createSender } = useApp();
  const sender = useMemo(
    () => createSender("Issue RGB++ xUDT"),
    [createSender],
  );
  const { error, log } = sender;
  const { explorerTransaction } = useGetExplorerLink();

  const [rgbppBtcTxId, setRgbppBtcTxId] = useState<string>("");
  const [rgbppCkbTxId, setRgbppCkbTxId] = useState<string>("");
  const [utxos, setUtxos] = useState<BtcApiUtxo[]>([]);
  const [selectedUtxo, setSelectedUtxo] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<ProcessStep>("idle");
  const [stepMessage, setStepMessage] = useState<string>("");
  const [isLoadingUtxos, setIsLoadingUtxos] = useState<boolean>(false);

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
      error(`Unsupported network prefix: ${signer.client.addressPrefix}`);
      return;
    }

    const config = buildNetworkConfig(network);
    setNetworkConfig(config);

    const client = isMainnet(network)
      ? new ccc.ClientPublicMainnet()
      : new ccc.ClientPublicTestnet();
    setCkbClient(client);

    const udtClient = new RgbppUdtClient(config, client);
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
      error(
        `Unsupported wallet type: ${signer.constructor.name}. Supported wallets: ${getSupportedWallets().join(", ")}`,
      );
    }
  }, [signer, networkConfig, rgbppBtcWallet]);

  useEffect(() => {
    if (!rgbppBtcWallet) {
      setUtxos([]);
      setSelectedUtxo("");
      setIsLoadingUtxos(false);
      return;
    }

    setIsLoadingUtxos(true);

    rgbppBtcWallet
      .getAddress()
      .then(async (address) => {
        const utxoList = await rgbppBtcWallet.getUtxos(address, {
          only_non_rgbpp_utxos: true,
        });

        await new Promise((resolve) => setTimeout(resolve, 800));

        setUtxos(utxoList);
        if (utxoList.length > 0) {
          setSelectedUtxo(`${utxoList[0].txid}:${utxoList[0].vout}`);
        }
        setIsLoadingUtxos(false);
      })
      .catch((err) => {
        error("Failed to get UTXOs:", String(err));
        setUtxos([]);
        setSelectedUtxo("");
        setIsLoadingUtxos(false);
      });
  }, [rgbppBtcWallet]);

  const [ckbRgbppUnlockSinger, setCkbRgbppUnlockSinger] =
    useState<CkbRgbppUnlockSinger>();

  useEffect(() => {
    if (!ckbClient || !rgbppBtcWallet || !rgbppUdtClient) {
      setCkbRgbppUnlockSinger(undefined);
      return;
    }

    let mounted = true;
    rgbppBtcWallet.getAddress().then((address: string) => {
      if (mounted) {
        setCkbRgbppUnlockSinger(
          new CkbRgbppUnlockSinger(
            ckbClient,
            address,
            rgbppBtcWallet,
            rgbppBtcWallet,
            rgbppUdtClient.getRgbppScriptInfos(),
          ),
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
      !ckbRgbppUnlockSinger ||
      !rgbppUdtClient ||
      !selectedUtxo
    ) {
      return;
    }

    try {
      setCurrentStep("checking-cell");
      setStepMessage("Checking for existing RGB++ cell...");
      setRgbppBtcTxId("");
      setRgbppCkbTxId("");

      const btcAccount = await signer.getBtcAccount();

      const [txId, indexStr] = selectedUtxo.split(":");
      const utxoSeal: UtxoSeal = {
        txId,
        index: parseInt(indexStr),
      };
      const rgbppLockScript = rgbppUdtClient.buildRgbppLockScript(utxoSeal);

      const rgbppCellsGen =
        await signer.client.findCellsByLock(rgbppLockScript);
      const rgbppIssuanceCells: ccc.Cell[] = [];
      for await (const cell of rgbppCellsGen) {
        rgbppIssuanceCells.push(cell);
      }

      if (rgbppIssuanceCells.length !== 0) {
        setStepMessage("Using existing RGB++ cell");
      } else {
        setCurrentStep("creating-cell");
        setStepMessage("RGB++ cell not found, creating a new one...");

        const tx = ccc.Transaction.default();
        // If additional capacity is required when used as an input in a transaction, it can always be supplemented in `completeInputsByCapacity`.
        tx.addOutput({
          lock: rgbppLockScript,
        });

        await tx.completeInputsByCapacity(signer);
        await tx.completeFeeBy(signer);
        const ckbTxId = await signer.sendTransaction(tx);
        await signer.client.waitTransaction(ckbTxId);
        const cell = await signer.client.getCellLive({
          txHash: ckbTxId,
          index: 0,
        });
        if (!cell) {
          throw new Error("Cell not found");
        }
        rgbppIssuanceCells.push(cell);
      }

      setCurrentStep("building-tx");
      setStepMessage("Building RGB++ transaction...");

      const ckbPartialTx = await rgbppUdtClient.issuanceCkbPartialTx({
        token: xudtToken,
        amount: issuanceAmount,
        rgbppLiveCells: rgbppIssuanceCells,
        udtScriptInfo: {
          name: ccc.KnownScript.XUdt,
          script: await ccc.Script.fromKnownScript(
            signer.client,
            ccc.KnownScript.XUdt,
            "",
          ),
          cellDep: (await signer.client.getKnownScript(ccc.KnownScript.XUdt))
            .cellDeps[0].cellDep,
        },
      });

      setCurrentStep("signing-btc");
      setStepMessage("Building and signing BTC transaction...");

      // ! indexedCkbPartialTx should be cached in the server side
      const { psbt, indexedCkbPartialTx } = await rgbppBtcWallet.buildPsbt({
        ckbPartialTx,
        ckbClient: signer.client,
        rgbppUdtClient,
        btcChangeAddress: btcAccount,
        receiverBtcAddresses: [btcAccount],
        feeRate: 10,
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
        await ckbRgbppUnlockSinger.signTransaction(ckbPartialTxInjected);
      await rgbppSignedCkbTx.completeFeeBy(signer);

      setCurrentStep("waiting-ckb");
      setStepMessage("Waiting for CKB transaction to be confirmed...");

      const ckbFinalTxId = await signer.sendTransaction(rgbppSignedCkbTx);
      setRgbppCkbTxId(ckbFinalTxId);
      log("CKB Transaction:", explorerTransaction(ckbFinalTxId));

      await signer.client.waitTransaction(ckbFinalTxId);

      setCurrentStep("completed");
      setStepMessage("RGB++ xUDT issued successfully!");
      setSelectedUtxo("");
    } catch (err) {
      setCurrentStep("idle");
      setStepMessage("");
      error("Transaction failed:", String(err));
    }
  }, [
    signer,
    selectedUtxo,
    rgbppBtcWallet,
    rgbppUdtClient,
    ckbRgbppUnlockSinger,
    log,
    error,
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
        You will need to sign 2 or 3 transactions.
        <br />
        <strong>
          Current Network:{" "}
          {networkConfig.isMainnet
            ? "BTC Mainnet & CKB Mainnet"
            : "BTC Testnet3 & CKB Testnet"}
        </strong>
      </Message>

      <div className="flex flex-col">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Select UTXO
          </label>
          <Button
            variant="info"
            className="h-8 px-3 py-1 text-xs"
            disabled={isLoadingUtxos}
            onClick={async () => {
              if (!rgbppBtcWallet) return;
              try {
                setIsLoadingUtxos(true);
                const address = await rgbppBtcWallet.getAddress();
                const utxoList = await rgbppBtcWallet.getUtxos(address, {
                  only_non_rgbpp_utxos: true,
                  only_confirmed: true,
                });

                await new Promise((resolve) => setTimeout(resolve, 800));

                setUtxos(utxoList);
                if (utxoList.length > 0 && !selectedUtxo) {
                  setSelectedUtxo(`${utxoList[0].txid}:${utxoList[0].vout}`);
                }
                setIsLoadingUtxos(false);
              } catch (err) {
                error("Failed to refresh UTXOs:", String(err));
                setIsLoadingUtxos(false);
              }
            }}
          >
            {isLoadingUtxos ? "Loading..." : "Refresh"}
          </Button>
        </div>
        {isLoadingUtxos ? (
          <div className="rounded-md border border-gray-300 bg-gray-50 p-4 text-center">
            <div className="flex items-center justify-center">
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent"></div>
              <p className="text-sm text-gray-600">Loading UTXOs...</p>
            </div>
          </div>
        ) : utxos.length === 0 ? (
          <div className="rounded-md border border-gray-300 bg-gray-50 p-4 text-center">
            <p className="text-sm text-gray-600">No UTXOs available</p>
            {!networkConfig?.isMainnet && (
              <p className="mt-2 text-xs text-blue-600">
                You&apos;re on BTC Testnet3. Get test BTC from a faucet:
                <br />
                <a
                  href="https://coinfaucet.eu/en/btc-testnet/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-blue-800"
                >
                  BTC Testnet3 Faucet
                </a>
              </p>
            )}
          </div>
        ) : (
          <Dropdown
            options={utxos.map((utxo) => ({
              name: `${utxo.txid}:${utxo.vout}`,
              displayName: `${utxo.txid}:${utxo.vout} (${utxo.value} sats)`,
              iconName: "Coins",
            }))}
            selected={selectedUtxo}
            onSelect={setSelectedUtxo}
          />
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
            !selectedUtxo
          }
        >
          {currentStep === "idle" || currentStep === "completed"
            ? "Issue RGB++ xUDT"
            : "Processing..."}
        </Button>
      </ButtonsPanel>
    </div>
  );
}
