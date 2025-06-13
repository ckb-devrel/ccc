import { ScriptInfo, UtxoSeal } from "../../types/rgbpp/index.js";

import "../common/load-env.js";

import { ccc } from "@ckb-ccc/shell";
import { issuanceAmount, udtToken } from "../common/assets.js";
import { initializeRgbppEnv } from "../common/env.js";
import { RgbppTxLogger } from "../common/logger.js";
import { prepareRgbppCells } from "../common/utils.js";

const {
  rgbppBtcWallet,
  rgbppUdtClient,
  utxoBasedAccountAddress,
  ckbRgbppUnlockSinger,
  ckbClient,
  ckbSigner,
} = await initializeRgbppEnv();

async function issueUdt({
  udtScriptInfo,
  utxoSeal,
}: {
  udtScriptInfo: ScriptInfo;
  utxoSeal?: UtxoSeal;
}) {
  if (!utxoSeal) {
    utxoSeal = await rgbppBtcWallet.prepareUtxoSeal({ feeRate: 10 });
  }

  const rgbppIssuanceCells = await prepareRgbppCells(
    ckbClient,
    ckbSigner,
    utxoSeal,
    rgbppUdtClient,
  );

  const ckbPartialTx = await rgbppUdtClient.issuanceCkbPartialTx({
    token: udtToken,
    amount: issuanceAmount,
    rgbppLiveCells: rgbppIssuanceCells,
    udtScriptInfo,
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
  logger.logCkbTx("indexedCkbPartialTx", indexedCkbPartialTx);

  const btcTxId = await rgbppBtcWallet.signAndSendTx(psbt);
  logger.add("btcTxId", btcTxId, true);

  const ckbPartialTxInjected = await rgbppUdtClient.injectTxIdToRgbppCkbTx(
    indexedCkbPartialTx,
    btcTxId,
  );
  const rgbppSignedCkbTx =
    await ckbRgbppUnlockSinger.signTransaction(ckbPartialTxInjected);

  // > Commitment must cover all Inputs and Outputs where Type is not null;
  // https://github.com/utxostack/RGBPlusPlus-design/blob/main/docs/lockscript-design-prd-en.md#requirements-and-limitations-on-isomorphic-binding
  // https://github.com/fghdotio/rgbpp/blob/main/contracts/rgbpp-lock/src/main.rs#L197-L200
  await rgbppSignedCkbTx.completeFeeBy(ckbSigner);
  const ckbFinalTx = await ckbSigner.signTransaction(rgbppSignedCkbTx);
  const txHash = await ckbSigner.client.sendTransaction(ckbFinalTx);
  await ckbRgbppUnlockSinger.client.waitTransaction(txHash);
  logger.add("ckbTxId", txHash, true);
}

const logger = new RgbppTxLogger({ opType: "udt-issuance" });

issueUdt({
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

  // udtScriptInfo: testnetSudtInfo,

  utxoSeal: {
    txId: "7cc7de993804bf7b18e12c40d3bfd65545e2d1317f2768771405847889632765",
    index: 2,
  },
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
pnpm tsx packages/rgbpp/src/examples/udt/1-rgbpp-udt-issuance.ts
*/
