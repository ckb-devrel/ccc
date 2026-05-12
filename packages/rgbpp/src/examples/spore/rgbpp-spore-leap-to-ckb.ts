import { spore } from "@ckb-ccc/spore";

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

async function btcSporeToCkb({
  ckbAddress,
  sporeTypeArgs,
}: {
  ckbAddress: string;
  sporeTypeArgs: string;
}) {
  const { tx: ckbPartialTx } = await spore.transferSpore({
    signer: ckbSigner,
    id: sporeTypeArgs,
    to: await rgbppUdtClient.buildBtcTimeLockScript(ckbAddress),
  });

  const { psbt, indexedCkbPartialTx } = await rgbppBtcWallet.buildPsbt({
    ckbPartialTx,
    ckbClient,
    rgbppUdtClient,
    btcChangeAddress: utxoBasedAccountAddress,
    receiverBtcAddresses: [],
  });

  const btcTxId = await rgbppBtcWallet.signAndBroadcast(psbt);
  console.log("btcTxId:", btcTxId);

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
  console.log("ckbTxId:", txHash);
}

btcSporeToCkb({
  ckbAddress:
    "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqfpu7pwavwf3yang8khrsklumayj6nyxhqpmh7fq",
  sporeTypeArgs:
    "0x8ce8307ac273c6e5548bd1a5dbf6596aab5dd5e75259a092b5461d3dba1c34bf",
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
pnpm tsx packages/rgbpp/src/examples/spore/rgbpp-spore-leap-to-ckb.ts
*/
