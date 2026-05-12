import { spore } from "@ckb-ccc/spore";

import { UtxoSeal } from "../../bitcoin/index.js";

import "../env/load-env.js";

import { initializeRgbppEnv } from "../env/env.js";

const { rgbppBtcWallet, rgbppUdtClient, ckbSigner } =
  await initializeRgbppEnv();

async function ckbSporeToBtc({
  utxoSeal,
  sporeTypeArgs,
}: {
  utxoSeal?: UtxoSeal;
  sporeTypeArgs: string;
}) {
  if (!utxoSeal) {
    const { psbt, sealOutputIndex } = await rgbppBtcWallet.buildSealPsbt();
    const txId = await rgbppBtcWallet.signAndBroadcast(psbt);
    await rgbppBtcWallet.waitForConfirmation(txId);
    utxoSeal = { txid: txId, vout: sealOutputIndex };
  }

  const rgbppLock = await rgbppUdtClient.buildRgbppLockScript(utxoSeal);

  const { tx } = await spore.transferSpore({
    signer: ckbSigner,
    id: sporeTypeArgs,
    to: rgbppLock,
  });

  await tx.completeFeeBy(ckbSigner);
  const signedTx = await ckbSigner.signTransaction(tx);
  const txHash = await ckbSigner.client.sendTransaction(signedTx);
  await ckbSigner.client.waitTransaction(txHash);
  console.log("ckbTxId:", txHash);
}

ckbSporeToBtc({
  sporeTypeArgs:
    "0xb1bf3620fa9caf55bd5e6ca05a99013cb48ba5cbf522efc34cc098da4a1cb1fe",
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
pnpm tsx packages/rgbpp/src/examples/spore/spore-leap-to-btc.ts
*/
