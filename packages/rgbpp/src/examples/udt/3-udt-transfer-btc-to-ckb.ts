import { ccc } from "@ckb-ccc/shell";

import { ScriptInfo } from "../../types/rgbpp/index.js";

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

async function btcUdtToCkb({
  udtScriptInfo,
  receivers,
}: {
  udtScriptInfo: ScriptInfo;
  receivers: { address: string; amount: bigint }[];
}) {
  const udt = new ccc.udt.Udt(
    udtScriptInfo.cellDep.outPoint,
    udtScriptInfo.script,
  );

  let { res: tx } = await udt.transfer(
    ckbSigner as unknown as ccc.Signer,
    await Promise.all(
      receivers.map(async (receiver) => ({
        to: await rgbppUdtClient.buildBtcTimeLockScript(receiver.address),
        amount: ccc.fixedPointFrom(receiver.amount),
      })),
    ),
  );

  const txWithInputs = await udt.completeChangeToLock(
    tx,
    ckbRgbppUnlockSinger,
    // merge multiple inputs to a single change output
    rgbppUdtClient.buildPseudoRgbppLockScript(),
  );

  const { psbt, indexedCkbPartialTx } = await rgbppBtcWallet.buildPsbt({
    ckbPartialTx: txWithInputs,
    ckbClient,
    rgbppUdtClient,
    btcChangeAddress: utxoBasedAccountAddress,
    receiverBtcAddresses: [],
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

const logger = new RgbppTxLogger({ opType: "udt-transfer-btc-to-ckb" });

btcUdtToCkb({
  // udtScriptInfo: {
  //   name: ccc.KnownScript.XUdt,
  //   script: await ccc.Script.fromKnownScript(
  //     ckbClient,
  //     ccc.KnownScript.XUdt,
  //     "0x29e04d8c0c246cc1b0027d7aa8a31f56f740134a56d056bb5efdbb00d3c78a44",
  //   ),
  //   cellDep: (await ckbClient.getKnownScript(ccc.KnownScript.XUdt)).cellDeps[0]
  //     .cellDep,
  // },

  udtScriptInfo: {
    ...testnetSudtInfo,
    script: await ccc.Script.from({
      ...testnetSudtInfo.script,
      args: "0x2f72f0890769a3f0b53d6e40f63e511ec3991fea33a318c129dc5c8a1dce4a64",
    }),
  },

  receivers: [
    {
      address: await ckbSigner.getRecommendedAddress(),
      amount: ccc.fixedPointFrom(1),
    },
    {
      address: await ckbSigner.getRecommendedAddress(),
      amount: ccc.fixedPointFrom(10),
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
pnpm tsx packages/rgbpp/src/examples/udt/3-udt-transfer-btc-to-ckb.ts
*/
