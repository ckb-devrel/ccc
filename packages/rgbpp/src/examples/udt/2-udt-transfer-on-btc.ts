import { ccc } from "@ckb-ccc/shell";

import { RgbppBtcReceiver, ScriptInfo } from "../../types/rgbpp/index.js";

import { ckbClient, ckbSigner, initializeRgbppEnv } from "../common/env.js";

import { RgbppTxLogger } from "../common/logger.js";

async function transferUdt({
  udtScriptInfo,
  receivers,
}: {
  udtScriptInfo: ScriptInfo;
  receivers: RgbppBtcReceiver[];
}) {
  const {
    rgbppBtcWallet,
    rgbppUdtClient,
    utxoBasedAccountAddress,
    ckbRgbppUnlockSinger,
  } = initializeRgbppEnv();

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
  udtScriptInfo: {
    name: ccc.KnownScript.XUdt,
    script: await ccc.Script.fromKnownScript(
      ckbClient,
      ccc.KnownScript.XUdt,
      "0x29e04d8c0c246cc1b0027d7aa8a31f56f740134a56d056bb5efdbb00d3c78a44",
    ),
    cellDep: (await ckbClient.getKnownScript(ccc.KnownScript.XUdt)).cellDeps[0]
      .cellDep,
  },

  // udtScriptInfo: {
  //   ...testnetSudtInfo,
  //   script: await ccc.Script.from({
  //     ...testnetSudtInfo.script,
  //     args: "0x07bccc105cdd747019a843d8bd0b5424efc33beb20b4f0db0f925e97f30c465f",
  //   }),
  // },

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
