import { ClientCollectableSearchKeyFilterLike } from "../../advancedBarrel.js";
import { Cell, Transaction, TransactionLike } from "../../ckb/transaction.js";
import { FeePayer, FeeRateOptionsLike } from "./feePayer.js";

export class FeePayerGroup extends FeePayer {
  constructor(private feePayers: FeePayer[]) {
    super(feePayers[0].client);
  }

  async prepareTransaction(txLike: TransactionLike): Promise<Transaction> {
    let tx = Transaction.from(txLike);
    for (const payer of this.feePayers) {
      tx = await payer.prepareTransaction(tx);
    }
    return tx;
  }

  async completeInputs<T>(
    tx: Transaction,
    filter: ClientCollectableSearchKeyFilterLike,
    accumulator: (
      acc: T,
      v: Cell,
      i: number,
      array: Cell[],
    ) => Promise<T | undefined> | T | undefined,
    init: T,
  ): Promise<{
    addedCount: number;
    accumulated?: T;
  }> {
    let addedCount = 0;
    let accumulated: T | undefined;
    for (const payer of this.feePayers) {
      const { addedCount: payerAddedCount, accumulated: payerAccumulated } =
        await payer.completeInputs(tx, filter, accumulator, init);
      addedCount += payerAddedCount;
      accumulated = accumulated ?? payerAccumulated;
    }
    return { addedCount, accumulated };
  }

  async completeTxFee(
    txLike: TransactionLike,
    options?: FeeRateOptionsLike,
  ): Promise<Transaction> {
    let tx = Transaction.from(txLike);
    for (const payer of this.feePayers) {
      tx = await payer.completeTxFee(tx, options);
    }
    return tx;
  }
}
