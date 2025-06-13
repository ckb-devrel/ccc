import { ccc, spore } from "@ckb-ccc/shell";
import { SporeDataView } from "@ckb-ccc/spore/advanced";

import { initializeRgbppEnv } from "../common/env.js";

import { inspect } from "util";
import { RgbppTxLogger } from "../common/logger.js";

async function createSpore({
  receiverInfo,
}: {
  receiverInfo: {
    btcAddress: string;
    rawSporeData: SporeDataView;
  };
}) {
  const {
    rgbppBtcWallet,
    rgbppUdtClient,
    utxoBasedAccountAddress,
    ckbRgbppUnlockSinger,
    ckbClient,
    ckbSigner,
  } = await initializeRgbppEnv();

  const { tx: transferClusterTx } = await spore.transferSporeCluster({
    signer: ckbSigner,
    id: receiverInfo.rawSporeData.clusterId!,
    to: rgbppUdtClient.buildPseudoRgbppLockScript(), // new cluster output
  });

  // ? API for creating multiple spores
  const { tx: ckbPartialTx, id } = await spore.createSpore({
    signer: ckbSigner,
    data: receiverInfo.rawSporeData,
    to: rgbppUdtClient.buildPseudoRgbppLockScript(),
    // cannot use cluster mode here as cluster's lock needs to be updated
    clusterMode: "skip",
    tx: transferClusterTx,
  });

  logger.add("spore id", id, true);

  console.log(inspect(ckbPartialTx.witnesses, { depth: null, colors: true }));

  const { psbt, indexedCkbPartialTx } = await rgbppBtcWallet.buildPsbt({
    ckbPartialTx,
    ckbClient,
    rgbppUdtClient,
    btcChangeAddress: utxoBasedAccountAddress,
    receiverBtcAddresses: [utxoBasedAccountAddress],
    feeRate: 28,
  });
  logger.logCkbTx("indexedCkbPartialTx", indexedCkbPartialTx);

  const btcTxId = await rgbppBtcWallet.signAndSendTx(psbt);
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

const logger = new RgbppTxLogger({ opType: "spore-creation" });

createSpore({
  receiverInfo: {
    btcAddress: "tb1qjkdqj8zk6gl7pwuw2d2jp9e6wgf26arjl8pcys",
    rawSporeData: {
      contentType: "text/plain",
      content: ccc.bytesFrom("First Spore Live", "utf8"),
      clusterId:
        "0xaa116bb68f7461a8bf42f51bdc4ae130da3546088a42b587ade53369e39e28d6",
    },
  },
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
pnpm tsx packages/rgbpp/src/examples/spore/2-spore-creation.ts
*/
