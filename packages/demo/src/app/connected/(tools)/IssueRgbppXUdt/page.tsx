"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TextInput } from "@/src/components/Input";
import { Button } from "@/src/components/Button";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { ccc, SignerBtc } from "@ckb-ccc/connector-react";
import { Message } from "@/src/components/Message";

import { Psbt, Transaction } from "bitcoinjs-lib";

import {
  buildNetworkConfig,
  PredefinedNetwork,
  RgbppUdtClient,
  isMainnet,
  RgbppBtcWallet,
  BtcAssetApiConfig,
  NetworkConfig,
  CkbRgbppUnlockSinger,
  issuanceAmount,
  udtToken,
  UtxoSeal,
} from "@ckb-ccc/rgbpp";

class UnisatRgbppWallet extends RgbppBtcWallet {
  constructor(
    private signer: SignerBtc,
    networkConfig: NetworkConfig,
    btcAssetApiConfig: BtcAssetApiConfig,
  ) {
    super(networkConfig, btcAssetApiConfig);
  }

  async getAddress(): Promise<string> {
    return this.signer.getBtcAccount();
  }

  async signTx(psbt: Psbt): Promise<Transaction> {
    const signedPsbtHex = await this.signer.signPsbt(psbt.toHex());
    const signedPsbt = Psbt.fromHex(signedPsbtHex);
    return signedPsbt.extractTransaction(true);
  }

  async sendTx(tx: Transaction): Promise<string> {
    return this.signer.pushTx(tx.toHex());
  }
}

export default function IssueRGBPPXUdt() {
  const { signer, createSender } = useApp();
  // const { log, warn } = createSender("Issue RGB++ xUDT");
  const [rgbppBtcTxId, setRgbppBtcTxId] = useState<string>("");
  const [rgbppCkbTxId, setRgbppCkbTxId] = useState<string>("");
  const [utxoSealTxId, setUtxoSealTxId] = useState<string>("");
  const [utxoSealIndex, setUtxoSealIndex] = useState<string>("");

  const ckbClient = useMemo(
    () =>
      isMainnet(
        process.env.NEXT_PUBLIC_UTXO_BASED_CHAIN_NAME as PredefinedNetwork,
      )
        ? new ccc.ClientPublicMainnet()
        : new ccc.ClientPublicTestnet(),
    [],
  );
  const networkConfig = useMemo(
    () =>
      buildNetworkConfig(
        process.env.NEXT_PUBLIC_UTXO_BASED_CHAIN_NAME as PredefinedNetwork,
      ),
    [],
  );
  const rgbppUdtClient = useMemo(
    () => new RgbppUdtClient(networkConfig, ckbClient),
    [networkConfig, ckbClient],
  );
  const rgbppBtcWallet = useMemo(() => {
    if (!signer || !(signer instanceof SignerBtc)) {
      return null;
    }
    return new UnisatRgbppWallet(signer, networkConfig, {
      url: process.env.NEXT_PUBLIC_BTC_ASSETS_API_URL!,
      token: process.env.NEXT_PUBLIC_BTC_ASSETS_API_TOKEN!,
      origin: process.env.NEXT_PUBLIC_BTC_ASSETS_API_ORIGIN!,
    });
  }, [signer, networkConfig]);
  const [ckbRgbppUnlockSinger, setCkbRgbppUnlockSinger] =
    useState<CkbRgbppUnlockSinger>();

  useEffect(() => {
    let mounted = true;
    rgbppBtcWallet?.getAddress().then((address) => {
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
      !ckbRgbppUnlockSinger
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
      feeRate: 28,
    });

    const signedPsbtHex = await signer.signPsbt(psbt.toHex());
    const btcTxId = await signer.pushPsbt(signedPsbtHex);

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

  return (
    <div className="flex w-full flex-col items-stretch">
      <Message title="Hint" type="info">
        You will need to sign 2 to 4 transactions.
        <br />
      </Message>

      <TextInput
        label="BTC UTXO Seal Tx ID (optional)"
        placeholder=""
        state={[utxoSealTxId, setUtxoSealTxId]}
      />
      <TextInput
        label="BTC UTXO Seal Index (optional)"
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
        <Button onClick={signRgbppBtcTx}>Issue RGB++ xUDT</Button>
      </ButtonsPanel>
    </div>
  );
}
