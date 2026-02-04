import { ccc } from "@ckb-ccc/core";
import { Udt } from "@ckb-ccc/udt";

import "../common/load-env.js";

import { RgbppBtcReceiver } from "../../types/rgbpp/index.js";

import { initializeRgbppEnv } from "../common/env.js";

import { RgbppTxLogger } from "../common/logger.js";

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
    // feeRate: 5,
  });
  logger.logCkbTx("indexedCkbPartialTx", indexedCkbPartialTx);

  const btcTxId = await rgbppBtcWallet.signAndBroadcast(psbt);
  logger.add("btcTxId", btcTxId, true);

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
  logger.add("ckbTxId", txHash, true);
}

const logger = new RgbppTxLogger({ opType: "udt-transfer-on-btc" });

transferUdt({
  udtScriptArgs:
    "0x88017813e410f63a21074a54f3a025cfa8319201b43588b50d869c1a2843b76f",
  receivers: [
    {
      address: "tb1qyyhdxmhc059rksfh9jjlkqgvs4w6mdl0z3zqj3",
      amount: ccc.fixedPointFrom(1),
    },
    {
      address: "tb1qe8xc5ay5sdh0r58v0xfxrtss47kxveyzncs5ja",
      amount: ccc.fixedPointFrom(2),
    },
    {
      address: "tb1qe8xc5ay5sdh0r58v0xfxrtss47kxveyzncs5ja",
      amount: ccc.fixedPointFrom(3),
    },
    {
      address: "tb1qe8xc5ay5sdh0r58v0xfxrtss47kxveyzncs5ja",
      amount: ccc.fixedPointFrom(4),
    },
    {
      address: "tb1qyyhdxmhc059rksfh9jjlkqgvs4w6mdl0z3zqj3",
      amount: ccc.fixedPointFrom(5),
    },
  ],
})
  .then(() => {
    logger.saveOnSuccess();
    process.exit(0);
  })
  .catch((e) => {
    const error = e instanceof Error ? e : new Error(String(e));
    console.log(error.message);
    logger.saveOnError(error);
    process.exit(1);
  });

/* 
pnpm tsx packages/rgbpp/src/examples/udt/2-udt-transfer-on-btc.ts
*/
