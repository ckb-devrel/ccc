import { ccc } from "@ckb-ccc/shell";

import { UtxoSeal } from "../../types/rgbpp/index.js";
import { RgbppUdtClient } from "../../udt/index.js";

import { ckbClient, ckbSigner } from "./env.js";

export async function prepareRgbppCells(
  utxoSeal: UtxoSeal,
  rgbppUdtClient: RgbppUdtClient,
): Promise<ccc.Cell[]> {
  const rgbppLockScript = rgbppUdtClient.buildRgbppLockScript(utxoSeal);

  const rgbppCellsGen = await ckbClient.findCellsByLock(rgbppLockScript);
  const rgbppCells: ccc.Cell[] = [];
  for await (const cell of rgbppCellsGen) {
    rgbppCells.push(cell);
  }

  if (rgbppCells.length !== 0) {
    console.log("Using existing RGB++ cell");
    return rgbppCells;
  }

  console.log("RGB++ cell not found, creating a new one");
  const tx = ccc.Transaction.default();

  // ? The capacity of the prepared cell appears to be irrelevant.
  // If additional capacity is required when used as an input in a transaction, it can always be supplemented in `completeInputsByCapacity`.
  tx.addOutput({
    lock: rgbppLockScript,
  });

  await tx.completeInputsByCapacity(ckbSigner);
  await tx.completeFeeBy(ckbSigner);
  const txHash = await ckbSigner.sendTransaction(tx);
  // TODO: combine this waitTransaction with the second one
  await ckbClient.waitTransaction(txHash);
  console.log(`RGB++ cell created, txHash: ${txHash}`);

  const cell = await ckbClient.getCellLive({
    txHash,
    index: 0,
  });
  if (!cell) {
    throw new Error("Cell not found");
  }

  return [cell];
}

export async function collectRgbppCells(
  utxoSeals: UtxoSeal[],
  typeScript: ccc.Script,
  rgbppUdtClient: RgbppUdtClient,
): Promise<ccc.Cell[]> {
  let rgbppLiveCells: ccc.Cell[] = [];

  await Promise.all(
    utxoSeals.map(async (utxoSeal) => {
      const rgbppLockScript = rgbppUdtClient.buildRgbppLockScript(utxoSeal);
      const rgbppCellsGen = await ckbClient.findCellsByLock(
        rgbppLockScript,
        typeScript,
      );
      for await (const cell of rgbppCellsGen) {
        rgbppLiveCells.push(cell);
      }
    }),
  );

  if (rgbppLiveCells.length === 0) {
    throw new Error("No rgbpp live cells found");
  }

  return rgbppLiveCells;
}

export async function collectBtcTimeLockCells(
  btcTimeLockArgs: string,
  rgbppUdtClient: RgbppUdtClient,
): Promise<ccc.Cell[]> {
  const btcTimeLockCellsGen = await ckbClient.findCellsByLock({
    ...rgbppUdtClient.btcTimeLockScriptTemplate(),
    args: btcTimeLockArgs,
  });
  const btcTimeLockCells: ccc.Cell[] = [];
  for await (const cell of btcTimeLockCellsGen) {
    btcTimeLockCells.push(cell);
  }
  return btcTimeLockCells;
}

export async function collectUdtCells(
  ckbAddress: string,
  udtTypeScript: ccc.Script,
): Promise<ccc.Cell[]> {
  const lock = (await ccc.Address.fromString(ckbAddress, ckbClient)).script;

  const udtCellsGen = await ckbClient.findCellsByLock(lock, udtTypeScript);
  const udtCells: ccc.Cell[] = [];
  for await (const cell of udtCellsGen) {
    udtCells.push(cell);
  }
  return udtCells;
}
