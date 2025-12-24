import { ccc } from "@ckb-ccc/core";
import { Udt } from "@ckb-ccc/udt";

import { UtxoSeal } from "../../types/rgbpp/index.js";

import "../common/load-env.js";

import { initializeRgbppEnv } from "../common/env.js";

import { RgbppTxLogger } from "../common/logger.js";

const { rgbppBtcWallet, rgbppUdtClient, ckbClient, ckbSigner } =
  await initializeRgbppEnv();

async function ckbUdtToBtc({
  utxoSeal,
  udtScriptInfo,
  amount,
}: {
  utxoSeal?: UtxoSeal;
  udtScriptInfo: ccc.ScriptInfo;

  amount: bigint;
}) {
  if (!utxoSeal) {
    utxoSeal = await rgbppBtcWallet.prepareUtxoSeal({ feeRate: 28 });
  }

  const udtInstance = new Udt(
    udtScriptInfo.cellDeps[0].cellDep.outPoint,
    ccc.Script.from({
      codeHash: udtScriptInfo.codeHash,
      hashType: udtScriptInfo.hashType,
      args: "",
    }),
  );

  const rgbppLock = await rgbppUdtClient.buildRgbppLockScript(utxoSeal);

  const { res: tx } = await udtInstance.transfer(ckbSigner, [
    {
      to: rgbppLock,
      amount: ccc.fixedPointFrom(amount),
    },
  ]);

  const txWithInputs = await udtInstance.completeBy(tx, ckbSigner);
  await txWithInputs.completeFeeBy(ckbSigner);
  const signedTx = await ckbSigner.signTransaction(txWithInputs);
  const txHash = await ckbSigner.client.sendTransaction(signedTx);
  await ckbSigner.client.waitTransaction(txHash);
  logger.add("ckbTxId", txHash, true);
}

const logger = new RgbppTxLogger({ opType: "udt-transfer-ckb-to-btc" });

ckbUdtToBtc({
  // utxoSeal: {
  //   txId: "499559be0d125f1387c11844919961fcdbd37c44bdaacab987754fb25d367c8f",
  //   index: 0,
  // },

  udtScriptInfo: await ckbClient.getKnownScript(ccc.KnownScript.XUdt),

  // udtScriptInfo: testnetSudtInfo,

  amount: ccc.fixedPointFrom(11),
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
pnpm tsx packages/rgbpp/src/examples/udt/5-udt-ckb-to-btc.ts
*/
