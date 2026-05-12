import { ccc } from "@ckb-ccc/core";
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

async function transferSpore(
  transfers: Array<{
    btcAddress: string;
    sporeTypeArgs: string;
  }>,
) {
  const pseudoRgbppLock = await rgbppUdtClient.buildPseudoRgbppLockScript();

  let ckbPartialTx = ccc.Transaction.from({});
  for (const { sporeTypeArgs } of transfers) {
    const { tx: _ckbPartialTx } = await spore.transferSpore({
      signer: ckbSigner,
      id: sporeTypeArgs,
      to: pseudoRgbppLock,
      tx: ckbPartialTx,
    });
    ckbPartialTx = _ckbPartialTx;
  }

  const { psbt, indexedCkbPartialTx } = await rgbppBtcWallet.buildPsbt({
    ckbPartialTx,
    ckbClient,
    rgbppUdtClient,
    btcChangeAddress: utxoBasedAccountAddress,
    receiverBtcAddresses: transfers.map((t) => t.btcAddress),
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

transferSpore([
  {
    btcAddress: "tb1q4vkt8486w7syqyvz3a4la0f3re5vvj9zw4henw",
    sporeTypeArgs:
      "0x8d814f7306d31bdfa40ddec0d3c9391c5505a7e9c0917596a8535e2a81ef3ab2",
  },
  {
    btcAddress: "tb1q4vkt8486w7syqyvz3a4la0f3re5vvj9zw4henw",
    sporeTypeArgs:
      "0x01eb873a190a200cdf3a21ee823663e3f2d5d220b0dee6033fd06a67c43cb733",
  },
])
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error(error);
    process.exit(1);
  });

/* 
pnpm tsx packages/rgbpp/src/examples/spore/rgbpp-spore-transfer-on-btc.ts
*/
