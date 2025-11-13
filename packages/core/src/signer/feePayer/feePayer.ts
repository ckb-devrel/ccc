import { Transaction, TransactionLike } from "../../ckb/index.js";
import { Client } from "../../client/client.js";
import { Num, NumLike, numFrom } from "../../num/index.js";

export interface FeeRateOptions {
  feeRate?: NumLike;
  options?: {
    feeRateBlockRange?: NumLike;
    maxFeeRate?: NumLike;
  };
}

export abstract class FeePayer {
  constructor() {}

  abstract completeTxFee(
    tx: Transaction,
    client: Client,
    options?: FeeRateOptions,
  ): Promise<void>;

  /**
   * Prepares a transaction before signing.
   * This method can be overridden by subclasses to perform any necessary steps,
   * such as adding cell dependencies or witnesses, before the transaction is signed.
   * The default implementation converts the {@link TransactionLike} object to a {@link Transaction} object
   * without modification.
   *
   * @remarks
   * Note that this default implementation does not add any cell dependencies or dummy witnesses.
   * This may lead to an underestimation of transaction size and fees if used with methods
   * like `Transaction.completeFee`. Subclasses for signers that are intended to sign
   * transactions should override this method to perform necessary preparations.
   *
   * @param tx - The transaction to prepare.
   * @returns A promise that resolves to the prepared {@link Transaction} object.
   */
  async prepareTransaction(tx: TransactionLike): Promise<Transaction> {
    return Transaction.from(tx);
  }

  static async getFeeRate(
    client: Client,
    options?: FeeRateOptions,
  ): Promise<Num> {
    return options?.feeRate
      ? numFrom(options.feeRate)
      : await client.getFeeRate(
          options?.options?.feeRateBlockRange,
          options?.options,
        );
  }
}
