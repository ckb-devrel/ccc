import { ccc } from "@ckb-ccc/core";
import { Udt } from "@ckb-ccc/udt";

import { UtxoSeal } from "../../bitcoin/index.js";

import "../env/load-env.js";

import { initializeRgbppEnv } from "../env/env.js";

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
  console.log("CKB tx confirmed (UDT leap to BTC):", txHash);
}

ckbUdtToBtc({
  udtScriptArgs:
    "0xe6fa637f763fd63732146015b0964fe88f16996846b3d0a164bf15c069ff008b",
  amount: ccc.fixedPointFrom(1000),
})
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error(error);
    process.exit(1);
  });

/* 
pnpm tsx packages/rgbpp/src/examples/udt/udt-leap-to-btc.ts
*/
