import { ccc } from "@ckb-ccc/shell";

import { RgbppBtcReceiver, ScriptInfo } from "../../types/rgbpp/index.js";

import { initializeRgbppEnv } from "../common/env.js";

import { testnetSudtInfo } from "../common/assets.js";
import { RgbppTxLogger } from "../common/logger.js";

const {
  rgbppBtcWallet,
  rgbppUdtClient,
  utxoBasedAccountAddress,
  ckbRgbppUnlockSinger,
  ckbClient,
  ckbSigner,
} = await initializeRgbppEnv();

async function transferUdt({
  udtScriptInfo,
  receivers,
}: {
  udtScriptInfo: ScriptInfo;
  receivers: RgbppBtcReceiver[];
}) {
  const udt = new ccc.udt.Udt(
    udtScriptInfo.cellDep.outPoint,
    udtScriptInfo.script,
  );

  let { res: tx } = await udt.transfer(
    ckbSigner as unknown as ccc.Signer,
    receivers.map((receiver) => ({
      to: rgbppUdtClient.buildPseudoRgbppLockScript(),
      amount: ccc.fixedPointFrom(receiver.amount),
    })),
  );

  let txWithInputs: ccc.Transaction;

  // * collect udt inputs using ccc
  txWithInputs = await udt.completeChangeToLock(
    tx,
    ckbRgbppUnlockSinger,
    rgbppUdtClient.buildPseudoRgbppLockScript(),
  );

  const { psbt, indexedCkbPartialTx } = await rgbppBtcWallet.buildPsbt({
    ckbPartialTx: txWithInputs,
    ckbClient,
    rgbppUdtClient,
    btcChangeAddress: utxoBasedAccountAddress,
    receiverBtcAddresses: receivers.map((receiver) => receiver.address),
    feeRate: 28,
  });
  logger.logCkbTx("indexedCkbPartialTx", indexedCkbPartialTx);

  const btcTxId = await rgbppBtcWallet.signAndSendTx(psbt);
  logger.add("btcTxId", btcTxId, true);

  const ckbPartialTxInjected = await rgbppUdtClient.injectTxIdToRgbppCkbTx(
    indexedCkbPartialTx,
    btcTxId,
  );

  const rgbppSignedCkbTx =
    await ckbRgbppUnlockSinger.signTransaction(ckbPartialTxInjected);
  await rgbppSignedCkbTx.completeFeeBy(ckbSigner);
  const ckbFinalTx = await ckbSigner.signTransaction(rgbppSignedCkbTx);
  const txHash = await ckbSigner.client.sendTransaction(ckbFinalTx);
  await ckbRgbppUnlockSinger.client.waitTransaction(txHash);
  logger.add("ckbTxId", txHash, true);
}

const logger = new RgbppTxLogger({ opType: "udt-transfer-on-btc" });

transferUdt({
  // udtScriptInfo: {
  //   name: ccc.KnownScript.XUdt,
  //   script: await ccc.Script.fromKnownScript(
  //     ckbClient,
  //     ccc.KnownScript.XUdt,
  //     "0x1f460e3c8c280ac828ec58cfe3b4ee55dfa1241420229222f24a330b37d3a15f",
  //   ),
  //   cellDep: (await ckbClient.getKnownScript(ccc.KnownScript.XUdt)).cellDeps[0]
  //     .cellDep,
  // },

  udtScriptInfo: {
    ...testnetSudtInfo,
    script: await ccc.Script.from({
      ...testnetSudtInfo.script,
      args: "0x8418c9699aa47ef02f45f021a6d1d44e4dfa503cf2fc1b002ff3c39e9f158080",
    }),
  },

  receivers: [
    {
      address: "tb1qe8xc5ay5sdh0r58v0xfxrtss47kxveyzncs5ja",
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
    console.log(e.message);
    logger.saveOnError(e);
    process.exit(1);
  });

/* 
pnpm tsx packages/rgbpp/src/examples/udt/2-udt-transfer-on-btc.ts
*/
