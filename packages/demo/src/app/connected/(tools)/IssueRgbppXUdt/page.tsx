"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TextInput } from "@/src/components/Input";
import { Button } from "@/src/components/Button";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { ccc, SignerBtc } from "@ckb-ccc/connector-react";
import { Message } from "@/src/components/Message";

import {
  buildNetworkConfig,
  PredefinedNetwork,
  RgbppUdtClient,
  isMainnet,
  BtcAssetApiConfig,
  NetworkConfig,
  CkbRgbppUnlockSinger,
  issuanceAmount,
  udtToken,
  UtxoSeal,
  createBrowserRgbppBtcWallet,
  getSupportedWallets,
} from "@ckb-ccc/rgbpp";

export default function IssueRGBPPXUdt() {
  const { signer, createSender } = useApp();
  const sender = useMemo(
    () => createSender("Issue RGB++ xUDT"),
    [createSender],
  );
  const { error } = sender;
  const [rgbppBtcTxId, setRgbppBtcTxId] = useState<string>("");
  const [rgbppCkbTxId, setRgbppCkbTxId] = useState<string>("");
  const [utxoSealTxId, setUtxoSealTxId] = useState<string>("");
  const [utxoSealIndex, setUtxoSealIndex] = useState<string>("");

  const [networkConfig, setNetworkConfig] = useState<NetworkConfig | null>(
    null,
  );
  const [ckbClient, setCkbClient] = useState<ccc.Client | null>(null);
  const [rgbppUdtClient, setRgbppUdtClient] = useState<RgbppUdtClient | null>(
    null,
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
  }, [signer, error]);

  const rgbppBtcWallet = useMemo(() => {
    if (!signer || !(signer instanceof SignerBtc) || !networkConfig) {
      return null;
    }

    const config: BtcAssetApiConfig = {
      url: process.env.NEXT_PUBLIC_BTC_ASSETS_API_URL!,
      token: process.env.NEXT_PUBLIC_BTC_ASSETS_API_TOKEN!,
      origin: process.env.NEXT_PUBLIC_BTC_ASSETS_API_ORIGIN!,
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
  }, [signer, networkConfig, rgbppBtcWallet, error]);

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
      !rgbppUdtClient
    ) {
      return;
    }
    setRgbppBtcTxId("");
    setRgbppCkbTxId("");

    const btcAccount = await signer.getBtcAccount();

    const utxoSeal: UtxoSeal = {
      txId: utxoSealTxId,
      index: parseInt(utxoSealIndex),
    };
    const rgbppLockScript = rgbppUdtClient.buildRgbppLockScript(utxoSeal);

    const rgbppCellsGen = await signer.client.findCellsByLock(rgbppLockScript);
    const rgbppIssuanceCells: ccc.Cell[] = [];
    for await (const cell of rgbppCellsGen) {
      rgbppIssuanceCells.push(cell);
    }

    if (rgbppIssuanceCells.length !== 0) {
      console.log("Using existing RGB++ cell");
    } else {
      console.log("RGB++ cell not found, creating a new one");
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

    const ckbPartialTx = await rgbppUdtClient.issuanceCkbPartialTx({
      token: udtToken,
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
    console.log(
      "Unique ID of issued udt token",
      ckbPartialTx.outputs[0].type!.args,
    );

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

    const ckbPartialTxInjected = await rgbppUdtClient.injectTxIdToRgbppCkbTx(
      indexedCkbPartialTx,
      btcTxId,
    );
    const rgbppSignedCkbTx =
      await ckbRgbppUnlockSinger.signTransaction(ckbPartialTxInjected);
    await rgbppSignedCkbTx.completeFeeBy(signer);
    const ckbFinalTxId = await signer.sendTransaction(rgbppSignedCkbTx);
    await signer.client.waitTransaction(ckbFinalTxId);
    setRgbppCkbTxId(ckbFinalTxId);
    setUtxoSealTxId("");
    setUtxoSealIndex("");
  }, [
    signer,
    utxoSealTxId,
    utxoSealIndex,
    rgbppBtcWallet,
    rgbppUdtClient,
    ckbRgbppUnlockSinger,
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
        You will need to sign 2 to 4 transactions.
        <br />
        <strong>
          Current Network:{" "}
          {networkConfig.isMainnet
            ? "BTC Mainnet & CKB Mainnet"
            : "BTC Testnet3 & CKB Testnet"}
        </strong>
      </Message>

      <TextInput
        label="BTC UTXO Seal Tx ID (optional, required for now)"
        placeholder=""
        state={[utxoSealTxId, setUtxoSealTxId]}
      />
      <TextInput
        label="BTC UTXO Seal Index (optional, required for now)"
        placeholder=""
        state={[utxoSealIndex, setUtxoSealIndex]}
      />

      {rgbppBtcTxId && !rgbppCkbTxId && (
        <div>
          Waiting for RGB++ BTC Transaction {rgbppBtcTxId} to be confirmed...
        </div>
      )}

      {rgbppBtcTxId && rgbppCkbTxId && (
        <div>
          RGB++ xUDT is issued successfully.
          <br />
          RGB++ BTC Transaction: {rgbppBtcTxId}
          <br />
          RGB++ CKB Transaction: {rgbppCkbTxId}
        </div>
      )}

      <ButtonsPanel>
        <Button onClick={signRgbppBtcTx} disabled={!rgbppBtcWallet}>
          Issue RGB++ xUDT
        </Button>
      </ButtonsPanel>
    </div>
  );
}
