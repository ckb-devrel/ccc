import { Address } from "../../address/index.js";
import { Cell, Transaction, TransactionLike } from "../../ckb/index.js";
import { Client } from "../../client/client.js";
import { ClientCollectableSearchKeyFilterLike } from "../../client/clientTypes.advanced.js";
import { Num, NumLike, numFrom } from "../../num/index.js";

export interface FeeRateOptionsLike {
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
    options?: FeeRateOptionsLike,
  ): Promise<void>;

  /**
   * Gets an array of Address objects associated with the signer.
   *
   * @returns A promise that resolves to an array of Address objects.
   */
  async getAddressObjs(): Promise<Address[]> {
    throw new Error("FeePayer.getAddressObjs not implemented");
  }

  /**
   * Gets the recommended Address object for the signer.
   *
   * @param _preference - Optional preference parameter.
   * @returns A promise that resolves to the recommended Address object.
   */
  async getRecommendedAddressObj(_preference?: unknown): Promise<Address> {
    return (await this.getAddressObjs())[0];
  }

  /**
   * Gets the recommended address for the signer as a string.
   *
   * @param preference - Optional preference parameter.
   * @returns A promise that resolves to the recommended address as a string.
   */
  async getRecommendedAddress(preference?: unknown): Promise<string> {
    return (await this.getRecommendedAddressObj(preference)).toString();
  }

  async completeInputs<T>(
    tx: Transaction,
    client: Client,
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
    const collectedCells = [];

    let acc: T = init;
    let fulfilled = false;
    for (const address of await this.getAddressObjs()) {
      for await (const cell of client.findCells({
        script: address.script,
        scriptType: "lock",
        filter,
        scriptSearchMode: "exact",
        withData: true,
      })) {
        if (
          tx.inputs.some(({ previousOutput }) =>
            previousOutput.eq(cell.outPoint),
          )
        ) {
          continue;
        }
        const i = collectedCells.push(cell);
        const next = await Promise.resolve(
          accumulator(acc, cell, i - 1, collectedCells),
        );
        if (next === undefined) {
          fulfilled = true;
          break;
        }
        acc = next;
      }
      if (fulfilled) {
        break;
      }
    }

    collectedCells.forEach((cell) => tx.addInput(cell));
    if (fulfilled) {
      return {
        addedCount: collectedCells.length,
      };
    }

    return {
      addedCount: collectedCells.length,
      accumulated: acc,
    };
  }

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
    options?: FeeRateOptionsLike,
  ): Promise<Num> {
    return options?.feeRate
      ? numFrom(options.feeRate)
      : await client.getFeeRate(
          options?.options?.feeRateBlockRange,
          options?.options,
        );
  }
}
