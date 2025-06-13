import { ccc, spore } from "@ckb-ccc/shell";

import { UtxoSeal } from "../../types/rgbpp/index.js";

import { clusterData } from "../common/assets.js";
import { initializeRgbppEnv } from "../common/env.js";
import { RgbppTxLogger } from "../common/logger.js";
import { prepareRgbppCells } from "../common/utils.js";

async function createSporeCluster(utxoSeal?: UtxoSeal) {
  const {
    rgbppBtcWallet,
    rgbppUdtClient,
    utxoBasedAccountAddress,
    ckbRgbppUnlockSinger,
    ckbClient,
    ckbSigner,
  } = await initializeRgbppEnv();

  if (!utxoSeal) {
    utxoSeal = await rgbppBtcWallet.prepareUtxoSeal({ feeRate: 28 });
  }

  const rgbppCells = await prepareRgbppCells(
    ckbClient,
    ckbSigner,
    utxoSeal,
    rgbppUdtClient,
  );
  const tx = ccc.Transaction.default();
  // manually add specified inputs
  rgbppCells.forEach((cell) => {
    const cellInput = ccc.CellInput.from({
      previousOutput: cell.outPoint,
    });
    cellInput.completeExtraInfos(ckbClient);

    tx.inputs.push(cellInput);
  });

  const { tx: ckbPartialTx, id } = await spore.createSporeCluster({
    signer: ckbSigner,
    data: clusterData,
    to: rgbppUdtClient.buildPseudoRgbppLockScript(),
    tx,
  });

  logger.add("cluster id", id, true);

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

const logger = new RgbppTxLogger({ opType: "cluster-creation" });

createSporeCluster({
  txId: "a8598f3b9c6b8a15529ecfd2d6c7c2897b4d4efcf88414270bce0e16b961a404",
  index: 3,
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
pnpm tsx packages/rgbpp/src/examples/spore/1-cluster-creation.ts
*/
