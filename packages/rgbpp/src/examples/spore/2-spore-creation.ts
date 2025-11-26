import { ccc } from "@ckb-ccc/core";
import { spore } from "@ckb-ccc/spore";
import { SporeDataView } from "@ckb-ccc/spore/advanced";

import "../common/load-env.js";

import { initializeRgbppEnv } from "../common/env.js";

import { inspect } from "util";
import { RgbppTxLogger } from "../common/logger.js";

async function createSpore({
  receiverInfo,
}: {
  receiverInfo: {
    btcAddress: string;
    rawSporeData: SporeDataView;
  }[];
}) {
  const {
    rgbppBtcWallet,
    rgbppUdtClient,
    utxoBasedAccountAddress,
    CkbRgbppUnlockSigner,
    ckbClient,
    ckbSigner,
  } = await initializeRgbppEnv();

  const { tx: transferClusterTx } = await spore.transferSporeCluster({
    signer: ckbSigner,
    id: receiverInfo[0].rawSporeData.clusterId!,
    to: rgbppUdtClient.buildPseudoRgbppLockScript(), // new cluster output
  });

  let ckbPartialTx: ccc.Transaction = transferClusterTx;
  for (const receiver of receiverInfo) {
    const { tx: _ckbPartialTx, id } = await spore.createSpore({
      signer: ckbSigner,
      data: receiver.rawSporeData,
      to: rgbppUdtClient.buildPseudoRgbppLockScript(),
      // cannot use cluster mode here as cluster's lock needs to be updated
      clusterMode: "skip",
      tx: ckbPartialTx,
    });

    console.log("spore id", id);
    ckbPartialTx = _ckbPartialTx;
  }

  console.log(inspect(ckbPartialTx, { depth: null, colors: true }));

  const { psbt, indexedCkbPartialTx } = await rgbppBtcWallet.buildPsbt({
    ckbPartialTx,
    ckbClient,
    rgbppUdtClient,
    btcChangeAddress: utxoBasedAccountAddress,
    receiverBtcAddresses: [utxoBasedAccountAddress],
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
    await CkbRgbppUnlockSigner.signTransaction(ckbPartialTxInjected);

  await rgbppSignedCkbTx.completeFeeBy(ckbSigner);

  const ckbFinalTx = await ckbSigner.signTransaction(rgbppSignedCkbTx);
  const txHash = await ckbSigner.client.sendTransaction(ckbFinalTx);
  await CkbRgbppUnlockSigner.client.waitTransaction(txHash);
  logger.add("ckbTxId", txHash, true);
}

const logger = new RgbppTxLogger({ opType: "spore-creation" });

createSpore({
  receiverInfo: [
    {
      btcAddress: "tb1qjkdqj8zk6gl7pwuw2d2jp9e6wgf26arjl8pcys",
      rawSporeData: {
        contentType: "text/plain",
        content: ccc.bytesFrom("First Spore Live", "utf8"),
        clusterId:
          "0x82993b95c82bd0734836a90912bbc46c1ddee4a7a7529eb889393647362105dc",
      },
    },
    {
      btcAddress: "tb1qjkdqj8zk6gl7pwuw2d2jp9e6wgf26arjl8pcys",
      rawSporeData: {
        contentType: "text/plain",
        content: ccc.bytesFrom("Second Spore Live", "utf8"),
        clusterId:
          "0x82993b95c82bd0734836a90912bbc46c1ddee4a7a7529eb889393647362105dc",
      },
    },
    {
      btcAddress: "tb1qjkdqj8zk6gl7pwuw2d2jp9e6wgf26arjl8pcys",
      rawSporeData: {
        contentType: "text/plain",
        content: ccc.bytesFrom("Third Spore Live", "utf8"),
        clusterId:
          "0x82993b95c82bd0734836a90912bbc46c1ddee4a7a7529eb889393647362105dc",
      },
    },
    {
      btcAddress: "tb1qjkdqj8zk6gl7pwuw2d2jp9e6wgf26arjl8pcys",
      rawSporeData: {
        contentType: "text/plain",
        content: ccc.bytesFrom("Fourth Spore Live", "utf8"),
        clusterId:
          "0x82993b95c82bd0734836a90912bbc46c1ddee4a7a7529eb889393647362105dc",
      },
    },
    {
      btcAddress: "tb1qjkdqj8zk6gl7pwuw2d2jp9e6wgf26arjl8pcys",
      rawSporeData: {
        contentType: "text/plain",
        content: ccc.bytesFrom("Fifth Spore Live", "utf8"),
        clusterId:
          "0x82993b95c82bd0734836a90912bbc46c1ddee4a7a7529eb889393647362105dc",
      },
    },
    {
      btcAddress: "tb1qjkdqj8zk6gl7pwuw2d2jp9e6wgf26arjl8pcys",
      rawSporeData: {
        contentType: "text/plain",
        content: ccc.bytesFrom("Sixth Spore Live", "utf8"),
        clusterId:
          "0x82993b95c82bd0734836a90912bbc46c1ddee4a7a7529eb889393647362105dc",
      },
    },
    {
      btcAddress: "tb1qjkdqj8zk6gl7pwuw2d2jp9e6wgf26arjl8pcys",
      rawSporeData: {
        contentType: "text/plain",
        content: ccc.bytesFrom("Seventh Spore Live", "utf8"),
        clusterId:
          "0x82993b95c82bd0734836a90912bbc46c1ddee4a7a7529eb889393647362105dc",
      },
    },
    {
      btcAddress: "tb1qjkdqj8zk6gl7pwuw2d2jp9e6wgf26arjl8pcys",
      rawSporeData: {
        contentType: "text/plain",
        content: ccc.bytesFrom("Eighth Spore Live", "utf8"),
        clusterId:
          "0x82993b95c82bd0734836a90912bbc46c1ddee4a7a7529eb889393647362105dc",
      },
    },
  ],
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

https://testnet.explorer.nervos.org/transaction/0x2b7aa75f9d5358d5ff16f93fca7691a5db1f4e24919def0e8474de4106fb65cb

spore id 0x8d814f7306d31bdfa40ddec0d3c9391c5505a7e9c0917596a8535e2a81ef3ab2
spore id 0x01eb873a190a200cdf3a21ee823663e3f2d5d220b0dee6033fd06a67c43cb733
spore id 0x9dcefeaa8018174caa4666a0efcd2e07db4d19ea698f4849ad2daf5ff973cec1
spore id 0x32921942cbebbdf2608e4155527c27d28b7f270bedf28cb0102ee54c73851942
spore id 0x10eff45b53a790d7d90ce079f1ca8ef0043db9bd778f4fdac7b83ffabb2525dc
spore id 0xb36e75044a8beee916255b3391e3d3373188cecafde56842f18804930934b73a
spore id 0xb17a0db52e5e3ede6ee41e79ed68a883d827efa27737a5e11f8f0ac710f23567
spore id 0x498951a02762ae2655a1a822cd0ec5e475b3d5686730d10f59da719ace75d2af
*/
