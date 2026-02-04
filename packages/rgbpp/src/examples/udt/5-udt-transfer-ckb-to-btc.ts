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
  udtScriptArgs,
  customUdtScriptInfo,
  amount,
}: {
  utxoSeal?: UtxoSeal;
  udtScriptArgs: ccc.Hex;
  customUdtScriptInfo?: ccc.ScriptInfo;
  amount: bigint;
}) {
  if (!utxoSeal) {
    utxoSeal = await rgbppBtcWallet.prepareUtxoSeal();
  }

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
  udtScriptArgs:
    "0x88017813e410f63a21074a54f3a025cfa8319201b43588b50d869c1a2843b76f",
  amount: ccc.fixedPointFrom(1),
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
pnpm tsx packages/rgbpp/src/examples/udt/5-udt-transfer-ckb-to-btc.ts
*/
