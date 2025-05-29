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
  const { explorerTransaction } = useGetExplorerLink();
  const [contentType, setContentType] = useState<string>("dob/1");
  const [content, setContent] = useState<string>(
    '{ "dna": "0123456789abcdef" }',
  );
  const [clusterId, setClusterId] = useState<string>("");
  const [clusterList, setClusterList] = useState([
    {
      id: "",
      name: "Mint Without Cluster",
    },
  ]);

  useEffect(() => {
    if (!signer) {
      return;
    }

    (async () => {
      const list = [
        {
          id: "",
          name: "Mint Without Cluster",
        },
      ];

      for await (const {
        cluster,
        clusterData,
      } of spore.findSporeClustersBySigner({
        signer,
        order: "desc",
      })) {
        if (!cluster.cellOutput.type?.args) {
          continue;
        }

        list.push({
          id: cluster.cellOutput.type.args,
          name: `${clusterData.name} (${cluster.cellOutput.type.args.slice(0, 10)})`,
        });
      }

      setClusterList(list);
    })();
  }, [signer]);

  const {
    rgbppBtcWallet,
    rgbppUdtClient,
    utxoBasedAccountAddress,
    ckbRgbppUnlockSinger,
  } = initializeRgbppEnv();
  const utxoSeal: UtxoSeal = {
    txId: "a01064157fa765ceabf5673bcbd9781ed54a66b78274480d9c63e7c94c3b093c",
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
  console.log("psbt hex demo page\n", psbtHex);

  // const signedTx_ = await rgbppBtcWallet.signTx(psbt);
  // const signedTxHex_ = signedTx_.toHex();
  // console.log("signedTxHex RGB++\n", signedTxHex_);

  const pseudoCkbTx = ccc.Transaction.from({
    version: 1010101,
    outputsData: [psbtHex],
  });

  const signedTx = await signer.signTransaction(pseudoCkbTx);
  const txHash = await signer.sendTransaction(signedTx);
  console.log("txHash uni-sat\n", txHash);

  // const txHash = await rgbppBtcWallet.sendTransaction(signedTx.outputsData[0]);
  // console.log("btc tx id:", txHash);

  }, [signer]);

  return (
    <div className="flex w-full flex-col items-stretch">
      <ButtonsPanel>
        <Button onClick={signRgbppBtcTx}>Sign RGB++ BTC Transaction</Button>
      </ButtonsPanel>
    </div>
  );
}
