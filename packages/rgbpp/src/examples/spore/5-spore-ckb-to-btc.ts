import { spore } from "@ckb-ccc/shell";

import { UtxoSeal } from "../../types/rgbpp/index.js";

import { initializeRgbppEnv } from "../common/env.js";

import { RgbppTxLogger } from "../common/logger.js";

async function ckbSporeToBtc({
  utxoSeal,
  sporeTypeArgs,
}: {
  utxoSeal?: UtxoSeal;
  sporeTypeArgs: string;
}) {
  const { rgbppBtcWallet, rgbppUdtClient, ckbSigner } =
    await initializeRgbppEnv();

  if (!utxoSeal) {
    utxoSeal = await rgbppBtcWallet.prepareUtxoSeal({ feeRate: 28 });
  }

  const { tx } = await spore.transferSpore({
    signer: ckbSigner,
    id: sporeTypeArgs,
    to: rgbppUdtClient.buildRgbppLockScript(utxoSeal),
  });

  await tx.completeFeeBy(ckbSigner);
  const signedTx = await ckbSigner.signTransaction(tx);
  const txHash = await ckbSigner.client.sendTransaction(signedTx);
  await ckbSigner.client.waitTransaction(txHash);
  logger.add("ckbTxId", txHash, true);
}

const logger = new RgbppTxLogger({ opType: "spore-ckb-to-btc" });

ckbSporeToBtc({
  sporeTypeArgs:
    "0xb1bf3620fa9caf55bd5e6ca05a99013cb48ba5cbf522efc34cc098da4a1cb1fe",
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
pnpm tsx packages/rgbpp/src/examples/spore/5-spore-ckb-to-btc.ts
*/
