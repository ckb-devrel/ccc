import { ccc } from "@ckb-ccc/core";
import { Udt } from "@ckb-ccc/udt";

import "../env/load-env.js";

import { initializeRgbppEnv } from "../env/env.js";

export interface RgbppBtcReceiver {
  address: string;
  amount: bigint;
}

const {
  rgbppBtcWallet,
  rgbppUdtClient,
  utxoBasedAccountAddress,
  ckbRgbppUnlockSigner,
  ckbClient,
  ckbSigner,
} = await initializeRgbppEnv();

async function transferUdt({
  udtScriptArgs,
  customUdtScriptInfo,
  receivers,
}: {
  udtScriptArgs: ccc.Hex;
  customUdtScriptInfo?: ccc.ScriptInfo;
  receivers: RgbppBtcReceiver[];
}) {
  const scriptInfo =
    customUdtScriptInfo ??
    (await ckbClient.getKnownScript(ccc.KnownScript.XUdt));
  const udtInstance = new Udt(
    scriptInfo.cellDeps[0].cellDep.outPoint,
    ccc.Script.from({
      codeHash: scriptInfo.codeHash,
      hashType: scriptInfo.hashType,
      args: udtScriptArgs,
    }),
  );

  const pseudoRgbppLock = await rgbppUdtClient.buildPseudoRgbppLockScript();

  const { res: tx } = await udtInstance.transfer(
    ckbSigner,
    receivers.map((receiver) => ({
      to: pseudoRgbppLock,
      amount: ccc.fixedPointFrom(receiver.amount),
    })),
  );

  // * collect udt inputs using ccc
  const txWithInputs = await udtInstance.completeChangeToLock(
    tx,
    ckbRgbppUnlockSigner,
    pseudoRgbppLock,
  );

  const { psbt, indexedCkbPartialTx } = await rgbppBtcWallet.buildPsbt({
    ckbPartialTx: txWithInputs,
    ckbClient,
    rgbppUdtClient,
    btcChangeAddress: utxoBasedAccountAddress,
    receiverBtcAddresses: receivers.map((receiver) => receiver.address),
  });

  const btcTxId = await rgbppBtcWallet.signAndBroadcast(psbt);
  console.log("BTC tx broadcast (RGB++ UDT transfer on BTC):", btcTxId);

  const ckbPartialTxInjected = await rgbppUdtClient.injectTxIdToRgbppCkbTx(
    indexedCkbPartialTx,
    btcTxId,
  );

  const rgbppSignedCkbTx =
    await ckbRgbppUnlockSigner.signTransaction(ckbPartialTxInjected);
  await rgbppSignedCkbTx.completeFeeBy(ckbSigner);
  const ckbFinalTx = await ckbSigner.signTransaction(rgbppSignedCkbTx);
  const txHash = await ckbSigner.client.sendTransaction(ckbFinalTx);
  await ckbRgbppUnlockSigner.client.waitTransaction(txHash);
  console.log("CKB tx confirmed (RGB++ UDT transfer on BTC):", txHash);
}

transferUdt({
  udtScriptArgs:
    "0xe6fa637f763fd63732146015b0964fe88f16996846b3d0a164bf15c069ff008b",
  receivers: [
    {
      address: "tb1qgsdzelnw8dvajqgl9mqrahatqe06u7dn2gkz9u",
      amount: ccc.fixedPointFrom(1),
    },
    {
      address: "tb1qgsdzelnw8dvajqgl9mqrahatqe06u7dn2gkz9u",
      amount: ccc.fixedPointFrom(2),
    },
    {
      address: "tb1qgsdzelnw8dvajqgl9mqrahatqe06u7dn2gkz9u",
      amount: ccc.fixedPointFrom(3),
    },
    {
      address: "tb1qgsdzelnw8dvajqgl9mqrahatqe06u7dn2gkz9u",
      amount: ccc.fixedPointFrom(4),
    },
    {
      address: "tb1qgsdzelnw8dvajqgl9mqrahatqe06u7dn2gkz9u",
      amount: ccc.fixedPointFrom(5),
    },
  ],
})
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    const error = e instanceof Error ? e : new Error(String(e));
    console.log(error);
    process.exit(1);
  });

/* 
pnpm tsx packages/rgbpp/src/examples/udt/rgbpp-udt-transfer-on-btc.ts
*/
