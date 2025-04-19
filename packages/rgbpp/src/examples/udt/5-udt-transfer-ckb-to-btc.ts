import { ccc } from "@ckb-ccc/shell";

import { ScriptInfo, UtxoSeal } from "../../types/rgbpp/index.js";

import { ckbClient, ckbSigner, initializeRgbppEnv } from "../common/env.js";

import { RgbppTxLogger } from "../common/logger.js";

async function ckbUdtToBtc({
  utxoSeal,
  udtScriptInfo,
  amount,
}: {
  utxoSeal?: UtxoSeal;
  udtScriptInfo: ScriptInfo;

  amount: bigint;
}) {
  const { rgbppBtcWallet, rgbppUdtClient } = initializeRgbppEnv();

  if (!utxoSeal) {
    utxoSeal = await rgbppBtcWallet.prepareUtxoSeal(28);
  }

  const udt = new ccc.udt.Udt(
    udtScriptInfo.cellDep.outPoint,
    udtScriptInfo.script,
  );

  let { res: tx } = await udt.transfer(ckbSigner as unknown as ccc.Signer, [
    {
      to: rgbppUdtClient.buildRgbppLockScript(utxoSeal),
      amount: ccc.fixedPointFrom(amount),
    },
  ]);

  const txWithInputs = await udt.completeBy(tx, ckbSigner);
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

  udtScriptInfo: {
    name: ccc.KnownScript.XUdt,
    script: await ccc.Script.fromKnownScript(
      ckbClient,
      ccc.KnownScript.XUdt,
      "0x868c505051f06bb41646bd1b442dbed8035d91abd9ac7acc4bda3bab267e6ac7",
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

  amount: ccc.fixedPointFrom(11),
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
pnpm tsx packages/rgbpp/src/examples/udt/5-udt-ckb-to-btc.ts
*/
