import { Transaction } from "../ckb/index.js";
import {
  ClientCollectableSearchKeyFilter,
  ClientCollectableSearchKeyFilterLike,
} from "../client/index.js";
import { Num, NumLike } from "../num/index.js";

/**
 * A filter that matches cells with no data and no type script.
 * @public
 */
export const EMPTY_CELL_FILTER = ClientCollectableSearchKeyFilter.from({
  scriptLenRange: [0, 1],
  outputDataLenRange: [0, 1],
});

/**
 * The result of collecting capacity from a fee payer.
 * @public
 */
export type FeePayerCollectCapacityResult<Context> = {
  /**
   * The transaction that completed.
   */
  tx: Transaction;

  /**
   * The total capacity collected from the fee payer's cells.
   */
  collectedCapacity: Num;

  /**
   * The context of the operation.
   */
  context: Context;
};

/**
 * Options for getting the fee rate from a fee payer.
 * @public
 */
export type FeePayerGetFeeRateOptionsLike =
  | {
      /**
       * The fee rate to use. If provided, the fee payer will not fetch the fee rate from the client.
       */
      feeRate?: NumLike;
      /**
       * The block range to use for calculating the fee rate.
       */
      feeRateBlockRange?: NumLike;
      /**
       * The maximum allowed fee rate.
       */
      maxFeeRate?: NumLike;
    }
  | undefined
  | null;

/**
 * A function that modifies a transaction to handle the change after paying the fee.
 * @param tx - The transaction to modify.
 * @param capacity - The excess capacity available for the change.
 * @returns The additional capacity needed if the excess capacity is insufficient, or 0 if the fee is paid.
 * @public
 */
export type FeePayerCompleteFeeChangeFn = (
  tx: Transaction,
  capacity: Num,
) => Promise<NumLike> | NumLike;

/**
 * The result of completing the transaction fee.
 * @public
 */
export type FeePayerCompleteFeeResult<Context> = {
  /**
   * The transaction that completed.
   */
  tx: Transaction;
  /**
   * Whether the transaction was modified to handle the change.
   */
  hasChanged: boolean;

  /**
   * The context of the operation.
   */
  context: Context;
};

/**
 * Options for completing transaction inputs.
 * @public
 */
export type FeePayerCompleteInputsOptionsLike =
  | {
      /**
       * The filter to use when searching for cells.
       */
      filter?: ClientCollectableSearchKeyFilterLike;

      /**
       * Whether to add inputs automatically to cover the fee. Defaults to true.
       */
      shouldAddInputs?: boolean;
    }
  | undefined
  | null;

/**
 * Options for completing transaction inputs.
 * @public
 */
export class FeePayerCompleteInputsOptions {
  /**
   * Creates an instance of FeePayerCompleteInputsOptions.
   * @param filter - The filter to use when searching for cells.
   * @param shouldAddInputs - Whether to add inputs automatically to cover the fee.
   */
  constructor(
    public filter: ClientCollectableSearchKeyFilter,
    public shouldAddInputs: boolean,
  ) {}

  /**
   * Creates an instance of FeePayerCompleteInputsOptions from a partial options object.
   * @param options - The partial options object.
   * @returns An instance of FeePayerCompleteInputsOptions.
   */
  static from(
    options?: FeePayerCompleteInputsOptionsLike,
  ): FeePayerCompleteInputsOptions {
    if (options instanceof FeePayerCompleteInputsOptions) {
      return options;
    }

    return new FeePayerCompleteInputsOptions(
      ClientCollectableSearchKeyFilter.from(
        options?.filter ?? EMPTY_CELL_FILTER,
      ),
      options?.shouldAddInputs ?? true,
    );
  }
}

/**
 * The context of completing transaction inputs.
 * @public
 */
export type FeePayerCompleteInputsContext = {
  /**
   * The number of inputs added.
   */
  addedCount: number;

  /**
   * The total capacity collected from the fee payer's cells.
   */
  collectedCapacity: Num;
};

/**
 * The result of completing transaction inputs.
 * @public
 */
export type FeePayerCompleteInputsResult = {
  /**
   * The transaction with added inputs.
   */
  tx: Transaction;
} & FeePayerCompleteInputsContext;
