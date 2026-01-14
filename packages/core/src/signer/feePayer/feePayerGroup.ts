import { Transaction, TransactionLike } from "../../ckb/transaction.js";
import { Client } from "../../client/client.js";
import { FeePayer, FeeRateOptionsLike } from "./feePayer.js";

export class FeePayerGroup extends FeePayer {
  constructor(private feePayers: FeePayer[]) {
    super();
  }

  async prepareTransaction(txLike: TransactionLike): Promise<Transaction> {
    let tx = Transaction.from(txLike);
    for (const payer of this.feePayers) {
      tx = await payer.prepareTransaction(tx);
    }
    return tx;
  }

  async completeTxFee(
    tx: Transaction,
    client: Client,
    options?: FeeRateOptionsLike,
  ): Promise<void> {
    for (const payer of this.feePayers) {
      await payer.completeTxFee(tx, client, options);
    }
  }
}
