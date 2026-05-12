import { ccc } from "@ckb-ccc/core";
import { Udt } from "@ckb-ccc/udt";

import "../env/load-env.js";

import { initializeRgbppEnv } from "../env/env.js";

const {
  rgbppBtcWallet,
  rgbppUdtClient,
  utxoBasedAccountAddress,
  ckbRgbppUnlockSigner,
  ckbClient,
  ckbSigner,
} = await initializeRgbppEnv();

async function btcUdtToCkb({
  udtScriptArgs,
  customUdtScriptInfo,
  receivers,
}: {
  udtScriptArgs: ccc.Hex;
  customUdtScriptInfo?: ccc.ScriptInfo;
  receivers: { address: string; amount: bigint }[];
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

  const { res: tx } = await udtInstance.transfer(
    ckbSigner,
    await Promise.all(
      receivers.map(async (receiver) => ({
        to: await rgbppUdtClient.buildBtcTimeLockScript(receiver.address),
        amount: ccc.fixedPointFrom(receiver.amount),
      })),
    ),
  );

  const pseudoRgbppLock = await rgbppUdtClient.buildPseudoRgbppLockScript();
  const txWithInputs = await udtInstance.completeChangeToLock(
    tx,
    ckbRgbppUnlockSigner,
    // merge multiple inputs to a single change output
    pseudoRgbppLock,
  );

  const { psbt, indexedCkbPartialTx } = await rgbppBtcWallet.buildPsbt({
    ckbPartialTx: txWithInputs,
    ckbClient,
    rgbppUdtClient,
    btcChangeAddress: utxoBasedAccountAddress,
    receiverBtcAddresses: [],
  });

  const btcTxId = await rgbppBtcWallet.signAndBroadcast(psbt);
  console.log("BTC tx broadcast (RGB++ UDT leap to CKB):", btcTxId);

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
  console.log("CKB tx confirmed (RGB++ UDT leap to CKB):", txHash);
}

btcUdtToCkb({
  udtScriptArgs:
    "0xe6fa637f763fd63732146015b0964fe88f16996846b3d0a164bf15c069ff008b",
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
    process.exit(0);
  })
  .catch((e) => {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error(error);
    process.exit(1);
  });

/* 
pnpm tsx packages/rgbpp/src/examples/udt/rgbpp-udt-leap-to-ckb.ts
*/
