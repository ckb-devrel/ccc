import {
  CellOutput,
  Script,
  ScriptLike,
  Transaction,
  TransactionLike,
} from "../ckb/index.js";
import { Client } from "../client/index.js";
import { fixedPointFrom, Zero } from "../fixedPoint/index.js";
import { Num, numFrom, NumLike } from "../num/index.js";
import { ErrorFeePayerInsufficientCapacity } from "./errors.js";
import {
  FeePayerCollectCapacityResult,
  FeePayerCompleteFeeChangeFn,
  FeePayerCompleteFeeResult,
  FeePayerGetFeeRateOptionsLike,
} from "./types.js";

/**
 * An abstract class representing a fee payer.
 * This class provides methods to complete transaction inputs and fees.
 *
 * @typeParam CollectCapacityOptions - The options for collecting capacity.
 * @typeParam CollectCapacityContext - The context for collecting capacity.
 * @typeParam CompleteFeeOptions - The options for completing the fee.
 * @public
 */
export abstract class FeePayer<
  CollectCapacityOptions = undefined,
  CollectCapacityContext = undefined,
  CompleteFeeOptions extends FeePayerGetFeeRateOptionsLike &
    CollectCapacityOptions = FeePayerGetFeeRateOptionsLike &
    CollectCapacityOptions,
> {
  /**
   * Creates an instance of FeePayer.
   * @param client_ - The client used to interact with the CKB network.
   */
  constructor(protected client_: Client) {}

  /**
   * Gets the client associated with this fee payer.
   */
  get client(): Client {
    return this.client_;
  }

  /**
   * Collects capacity for the transaction.
   *
   * @param txLike - The transaction to collect capacity for.
   * @param capacityTweak - Optional additional capacity needed.
   * @param options - Optional configuration for collecting capacity.
   * @param context - Optional context for collecting capacity.
   * @returns A promise that resolves to the result of collecting capacity, including the total capacity collected from added inputs.
   *
   * @remarks
   * This method should attempt to collect sufficient capacity to meet the requirement (outputs capacity plus `capacityTweak`).
   * If the requirement cannot be fully met, it should still add as many inputs as possible to minimize the deficit and MUST NOT throw an error.
   * This behavior enables multiple fee payers to collaborate in providing the necessary capacity.
   */
  abstract collectCapacity(
    txLike: TransactionLike,
    capacityTweak?: NumLike,
    options?: CollectCapacityOptions,
    context?: CollectCapacityContext,
  ): Promise<FeePayerCollectCapacityResult<CollectCapacityContext>>;

  /**
   * Completes the transaction fee by adding a change output to a recommended address.
   *
   * @param txLike - The transaction to complete the fee for.
   * @param options - Optional configuration for completing the fee.
   * @returns A promise that resolves to the transaction with the fee paid, whether it was modified, and the operation context.
   */
  abstract completeFee(
    txLike: TransactionLike,
    options?: CompleteFeeOptions,
  ): Promise<FeePayerCompleteFeeResult<CollectCapacityContext>>;

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

  /**
   * Gets the fee rate for the transaction.
   *
   * @param options - Optional configuration for getting the fee rate.
   * @returns A promise that resolves to the fee rate.
   */
  async getFeeRate(options?: FeePayerGetFeeRateOptionsLike): Promise<Num> {
    return options?.feeRate
      ? numFrom(options.feeRate)
      : await this.client_.getFeeRate(options?.feeRateBlockRange, options);
  }

  /**
   * Completes the transaction fee by applying a custom change function.
   *
   * @param txLike - The transaction to complete the fee for.
   * @param change - A function that modifies the transaction to handle the change.
   * @param optionsLike - Optional configuration for completing the fee.
   * @returns A promise that resolves to the transaction with the fee paid, whether it was modified, and the operation context.
   */
  async completeFeeChangeTo(
    txLike: TransactionLike,
    change: FeePayerCompleteFeeChangeFn,
    options?: CompleteFeeOptions,
  ): Promise<FeePayerCompleteFeeResult<CollectCapacityContext>> {
    let tx = Transaction.from(txLike);

    // Get fee rate at first
    const feeRate = await this.getFeeRate(options);

    // Complete all inputs extra infos for cache
    await tx.getInputsCapacity(this.client);

    let leastFee = Zero;
    let leastExtraCapacity = Zero;
    let collectCapacityContext = undefined as CollectCapacityContext; // It's fine because it's assigned below

    // ===
    // Usually, for the worst situation, three iterations are needed
    // 1. First attempt to complete the transaction.
    // 2. Not enough capacity for the change cell.
    // 3. Fee increased by the change cell.
    // ===
    while (true) {
      try {
        const res = await this.collectCapacity(
          tx,
          leastFee + leastExtraCapacity,
          options,
          collectCapacityContext,
        );
        tx = res.tx;
        collectCapacityContext = res.context; // Now collectCapacityContext is assigned
      } catch (err) {
        if (
          err instanceof ErrorFeePayerInsufficientCapacity &&
          leastExtraCapacity !== Zero
        ) {
          throw new ErrorFeePayerInsufficientCapacity(err.amount, {
            isForChange: true,
          });
        }

        throw err;
      }

      const fee = await tx.getFee(this.client);
      if (fee < leastFee + leastExtraCapacity) {
        // Not enough capacity are collected previously
        throw new ErrorFeePayerInsufficientCapacity(
          leastFee + leastExtraCapacity - fee,
          { isForChange: leastExtraCapacity !== Zero },
        );
      }

      await this.prepareTransaction(tx);
      if (leastFee === Zero) {
        // The initial fee is calculated based on prepared transaction
        // This should only happens during the first iteration
        leastFee = tx.estimateFee(feeRate);
      }
      // The extra capacity paid the fee without a change
      // leastExtraCapacity should be 0 here, otherwise we should failed in the previous check
      // So this only happens in the first iteration
      if (fee === leastFee) {
        return {
          tx,
          hasChanged: false,
          context: collectCapacityContext,
        };
      }

      // Invoke the change function on a transaction multiple times may cause problems, so we clone it
      const txCopy = tx.clone();
      const needed = numFrom(
        await Promise.resolve(change(txCopy, fee - leastFee)),
      );
      if (needed > Zero) {
        // No enough extra capacity to create new cells for change, collect inputs again
        leastExtraCapacity = needed;
        continue;
      }

      if ((await txCopy.getFee(this.client)) !== leastFee) {
        throw new Error(
          "The change function doesn't use all available capacity",
        );
      }

      // New change cells created, update the fee
      await this.prepareTransaction(txCopy);
      const changedFee = txCopy.estimateFee(feeRate);
      if (leastFee > changedFee) {
        throw new Error("The change function removed existed transaction data");
      }
      // The fee has been paid
      if (leastFee === changedFee) {
        return {
          tx: txCopy,
          hasChanged: true,
          context: collectCapacityContext,
        };
      }

      // The fee after changing is more than the original fee
      leastFee = changedFee;
    }
  }

  /**
   * Completes the transaction fee by adding inputs and creating a change output with the specified lock script.
   * This is a convenience method that automatically creates a change cell with the provided lock script
   * when there's excess capacity after paying the transaction fee.
   *
   * @param txLike - The transaction to complete the fee for.
   * @param change - The lock script for the change output cell.
   * @param options - Optional configuration for completing the fee.
   * @returns A promise that resolves to the transaction with the fee paid, whether it was modified, and the operation context.
   *
   * @example
   * ```typescript
   * const changeScript = Script.from({
   *   codeHash: "0x...",
   *   hashType: "type",
   *   args: "0x..."
   * });
   *
   * const { hasChanged } = await feePayer.completeFeeChangeToLock(
   *   tx,
   *   changeScript,
   * );
   * ```
   */
  completeFeeChangeToLock(
    txLike: TransactionLike,
    change: ScriptLike,
    options?: CompleteFeeOptions,
  ): Promise<FeePayerCompleteFeeResult<CollectCapacityContext>> {
    const script = Script.from(change);
    const tx = Transaction.from(txLike);

    return this.completeFeeChangeTo(
      tx,
      (tx, capacity) => {
        const changeCell = CellOutput.from({
          capacity: 0, // For auto conducting capacity occupation
          lock: script,
        });
        const occupiedCapacity = fixedPointFrom(changeCell.occupiedSize);
        if (capacity < occupiedCapacity) {
          return occupiedCapacity;
        }
        changeCell.capacity = capacity;
        tx.addOutput(changeCell);
        return 0;
      },
      options,
    );
  }

  /**
   * Completes the transaction fee by adding excess capacity to an existing output.
   * Instead of creating a new change output, this method adds any excess capacity
   * to the specified existing output in the transaction.
   *
   * @param txLike - The transaction to complete the fee for.
   * @param index - The index of the existing output to add excess capacity to.
   * @param options - Optional configuration for completing the fee.
   * @returns A promise that resolves to the transaction with the fee paid, whether it was modified, and the operation context.
   *
   * @throws {Error} When the specified output index doesn't exist.
   *
   * @example
   * ```typescript
   * // Add excess capacity to the first output (index 0)
   * const { hasChanged } = await feePayer.completeFeeChangeToOutput(
   *   tx,
   *   0, // Output index
   * );
   * ```
   */
  completeFeeChangeToOutput(
    txLike: TransactionLike,
    index: NumLike,
    options?: CompleteFeeOptions,
  ): Promise<FeePayerCompleteFeeResult<CollectCapacityContext>> {
    const tx = Transaction.from(txLike);
    const change = Number(numFrom(index));
    if (!tx.outputs[change]) {
      throw new Error("Non-existed output to change");
    }

    return this.completeFeeChangeTo(
      tx,
      (tx, capacity) => {
        tx.outputs[change].capacity += capacity;
        return 0;
      },
      options,
    );
  }
}
