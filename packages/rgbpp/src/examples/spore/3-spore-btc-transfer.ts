import { ccc, spore } from "@ckb-ccc/shell";

import "../common/load-env.js";

import { initializeRgbppEnv } from "../common/env.js";

import { RgbppTxLogger } from "../common/logger.js";

async function transferSpore(
  transfers: Array<{
    btcAddress: string;
    sporeTypeArgs: string;
  }>,
) {
  const {
    rgbppBtcWallet,
    rgbppUdtClient,
    utxoBasedAccountAddress,
    ckbRgbppUnlockSinger,
    ckbClient,
    ckbSigner,
  } = await initializeRgbppEnv();

  let ckbPartialTx = ccc.Transaction.from({});
  for (const { sporeTypeArgs } of transfers) {
    const { tx: _ckbPartialTx } = await spore.transferSpore({
      signer: ckbSigner,
      id: sporeTypeArgs,
      to: rgbppUdtClient.buildPseudoRgbppLockScript(),
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
    feeRate: 28,
  });
  logger.logCkbTx("indexedCkbPartialTx", indexedCkbPartialTx);

  const btcTxId = await rgbppBtcWallet.signAndBroadcast(psbt);
  logger.add("btcTxId", btcTxId, true);

  const ckbPartialTxInjected = await rgbppUdtClient.injectTxIdToRgbppCkbTx(
    indexedCkbPartialTx,
    btcTxId,
  );
  const rgbppSignedCkbTx =
    await ckbRgbppUnlockSinger.signTransaction(ckbPartialTxInjected);

  await rgbppSignedCkbTx.completeFeeBy(ckbSigner);
  const ckbFinalTx = await ckbSigner.signTransaction(rgbppSignedCkbTx);
  const txHash = await ckbSigner.client.sendTransaction(ckbFinalTx);
  await ckbRgbppUnlockSinger.client.waitTransaction(txHash);
  logger.add("ckbTxId", txHash, true);
}

const logger = new RgbppTxLogger({ opType: "spore-transfer" });

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
    logger.saveOnSuccess();
    process.exit(0);
  })
  .catch((e) => {
    console.log(e.message);
    logger.saveOnError(e);
    process.exit(1);
  });

/* 
pnpm tsx packages/rgbpp/src/examples/spore/3-spore-btc-transfer.ts

https://testnet.explorer.nervos.org/transaction/0x43923c45d214bab0fbbd1b90b15197147bb4a47aaae01c1a36e81585aa84aa78
*/
