import { ccc } from "@ckb-ccc/core";
import { spore } from "@ckb-ccc/spore";

import { UtxoSeal } from "../../types/rgbpp/index.js";

import "../common/load-env.js";

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

const logger = new RgbppTxLogger({ opType: "cluster-creation" });

createSporeCluster({
  txId: "56dea2d2cf703e8f30dee51115419b5af54545878af39873de50ddbb1ec5596e",
  index: 2,
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

cluster id: 0x82993b95c82bd0734836a90912bbc46c1ddee4a7a7529eb889393647362105dc
btcTxId: b78ba51aca245436cc94df592adcfd763e835f1916e63a56e0856558f3b3f475
ckbTxId: 0xc7cf9f775e3fa3d49ed8e18ce5f97048177e6766558d677d07912eed9dc453d8
*/
