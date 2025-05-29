"use client";

import React, { useCallback, useEffect, useState } from "react";
import { TextInput } from "@/src/components/Input";
import { Button } from "@/src/components/Button";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { ccc } from "@ckb-ccc/connector-react";
import { Message } from "@/src/components/Message";


import { initializeRgbppEnv, issuanceAmount, udtToken, UtxoSeal } from "@ckb-ccc/rgbpp";

export default function IssueRGBPPXUdt() {
  const { signer, createSender } = useApp();
  const { log, warn } = createSender("Issue RGB++ xUDT");
  const [rgbppBtcTxId, setRgbppBtcTxId] = useState<string>("");
  const [rgbppCkbTxId, setRgbppCkbTxId] = useState<string>("");
  const [utxoSealTxId, setUtxoSealTxId] = useState<string>("");
  const [utxoSealIndex, setUtxoSealIndex] = useState<string>("");

  useEffect(() => {
    if (!signer) {
      return;
    }
  }, [signer]);

  const {
    rgbppBtcWallet,
    rgbppUdtClient,
    utxoBasedAccountAddress,
    ckbRgbppUnlockSinger,
  } = initializeRgbppEnv();
  const signRgbppBtcTx = useCallback(async () => {
    if (!signer) {
      return;
    }

    const utxoSeal: UtxoSeal = {
      txId: utxoSealTxId,
      index: parseInt(utxoSealIndex),
    }
    console.log("utxoSeal", utxoSeal);
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
          cellDep: (await signer.client.getKnownScript(ccc.KnownScript.XUdt)).cellDeps[0]
            .cellDep,
        },
    });
    console.log(
      "Unique ID of issued udt token",
      ckbPartialTx.outputs[0].type!.args,
    );

    const { psbt, indexedCkbPartialTx } = await rgbppBtcWallet.buildPsbt({
      ckbPartialTx,
      ckbClient: signer.client,
      rgbppUdtClient,
      btcChangeAddress: utxoBasedAccountAddress,
      receiverBtcAddresses: [utxoBasedAccountAddress],
      feeRate: 28,
    });

    const psbtHex = psbt.toHex();

    //*  668467 is the ASCII decimal representation of "BTC" (66, 84, 67)
    const pseudoCkbTx = ccc.Transaction.from({
      version: 668467,
      outputsData: [psbtHex],
    });

    const signedTx = await signer.signTransaction(pseudoCkbTx);
    const btcTxId = await signer.sendTransaction(signedTx);
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
  }, [signer, utxoSealTxId, utxoSealIndex]);

  useEffect(() => {
    if (!rgbppBtcTxId) {
      return;
    }
  }, [rgbppBtcTxId]);

  return (
    <div className="flex w-full flex-col items-stretch">
      <Message title="Hint" type="info">
        You will need to sign 2 to 4 transactions.
        <br />
        Learn more on{" "}
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

      {rgbppBtcTxId && !rgbppCkbTxId && <div>Waiting for RGB++ BTC Transaction {rgbppBtcTxId} to be confirmed...</div>}

      {
        rgbppBtcTxId && rgbppCkbTxId && (
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
