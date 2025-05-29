"use client";

import React, { useCallback, useEffect, useState } from "react";
import { TextInput } from "@/src/components/Input";
import { Button } from "@/src/components/Button";
import { useGetExplorerLink } from "@/src/utils";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { Dropdown } from "@/src/components/Dropdown";
import { ccc, spore } from "@ckb-ccc/connector-react";
import { Message } from "@/src/components/Message";
import Link from "next/link";

import { initializeRgbppEnv, issuanceAmount, prepareRgbppCells, udtToken, UtxoSeal, ckbClient } from "@ckb-ccc/rgbpp";

export default function IssueRGBPPXUdt() {
  const { signer, createSender } = useApp();
  const { log, warn } = createSender("Issue RGB++ xUDT");
  const [rgbppBtcTxId, setRgbppBtcTxId] = useState<string>("");

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
  const utxoSeal: UtxoSeal = {
    txId: "6cabb6b0c75b8f3331976d7cf8e3ee7915b77e0b0b26331e0dfd3681752a7a6465cc2b7d4931d564667581db9ab46110ca447664112c28ee4d0fc7f66be812ff",
    index: 2,
  }

  const signRgbppBtcTx = useCallback(async () => {
    if (!signer) {
      return;
    }

  const rgbppIssuanceCells = await prepareRgbppCells(utxoSeal, rgbppUdtClient);

  const ckbPartialTx = await rgbppUdtClient.issuanceCkbPartialTx({
    token: udtToken,
    amount: issuanceAmount,
    rgbppLiveCells: rgbppIssuanceCells,
    udtScriptInfo: {
        name: ccc.KnownScript.XUdt,
        script: await ccc.Script.fromKnownScript(
          ckbClient,
          ccc.KnownScript.XUdt,
          "",
        ),
        cellDep: (await ckbClient.getKnownScript(ccc.KnownScript.XUdt)).cellDeps[0]
          .cellDep,
      },
  });
  console.log(
    "Unique ID of issued udt token",
    ckbPartialTx.outputs[0].type!.args,
  );

  const { psbt, indexedCkbPartialTx } = await rgbppBtcWallet.buildPsbt({
    ckbPartialTx,
    ckbClient,
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
  const txHash = await signer.sendTransaction(signedTx);
  setRgbppBtcTxId(txHash);
  }, [signer]);

  return (
    <div className="flex w-full flex-col items-stretch">

      {rgbppBtcTxId && <div>Waiting for RGB++ BTC Transaction {rgbppBtcTxId} to be confirmed...</div>}
      
      <ButtonsPanel>
        <Button onClick={signRgbppBtcTx}>Sign RGB++ BTC Transaction</Button>
      </ButtonsPanel>
    </div>
  );
}
