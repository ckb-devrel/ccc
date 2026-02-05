import { Address } from "../../address/index.js";
import { Script } from "../../ckb/script.js";
import {
  Cell,
  CellOutput,
  Transaction,
  TransactionLike,
} from "../../ckb/transaction.js";
import { ErrorTransactionInsufficientCapacity } from "../../ckb/transactionErrors.js";
import { ClientCollectableSearchKeyFilterLike } from "../../client/clientTypes.advanced.js";
import { fixedPointFrom, Zero } from "../../fixedPoint/index.js";
import { Num, numFrom, NumLike } from "../../num/index.js";
import { FeePayer, FeeRateOptionsLike } from "./feePayer.js";

function defaultChangeFn(
  tx: Transaction,
  changeScript: Script,
  capacity: Num,
): NumLike {
  const changeCell = CellOutput.from({ capacity: 0, lock: changeScript });
  const occupiedCapacity = fixedPointFrom(changeCell.occupiedSize);
  if (capacity < occupiedCapacity) {
    return occupiedCapacity;
  }
  changeCell.capacity = capacity;
  tx.addOutput(changeCell);
  return 0;
}

export interface FeePayerFromAddressOptionsLike {
  changeFn?: (tx: Transaction, capacity: Num) => Promise<NumLike> | NumLike;
  feeRate?: NumLike;
  filter?: ClientCollectableSearchKeyFilterLike;
  options?: {
    feeRateBlockRange?: NumLike;
    maxFeeRate?: NumLike;
    shouldAddInputs?: boolean;
  };
}

export abstract class FeePayerFromAddress extends FeePayer {
  /**
   * Gets an array of addresses associated with the signer as strings.
   *
   * @returns A promise that resolves to an array of addresses as strings.
   */
  async getAddresses(): Promise<string[]> {
    return this.getAddressObjs().then((addresses) =>
      addresses.map((address) => address.toString()),
    );
  }

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

  async completeTxFee(
    txLike: TransactionLike,
    options?: FeeRateOptionsLike,
  ): Promise<Transaction> {
    const tx = Transaction.from(txLike);
    await this.completeFee(tx, options);
    return tx;
  }

  async completeFee(
    tx: Transaction,
    options?: FeePayerFromAddressOptionsLike,
  ): Promise<[number, boolean]> {
    // Get fee rate at first
    const feeRate = await FeePayer.getFeeRate(this.client, options);

    // Complete all inputs extra infos for cache
    await tx.getInputsCapacity(this.client);

    let leastFee = Zero;
    let leastExtraCapacity = Zero;
    let collected = 0;

    // ===
    // Usually, for the worst situation, three iterations are needed
    // 1. First attempt to complete the transaction.
    // 2. Not enough capacity for the change cell.
    // 3. Fee increased by the change cell.
    // ===
    while (true) {
      collected += await (async () => {
        if (!(options?.options?.shouldAddInputs ?? true)) {
          return 0;
        }

        try {
          return await this.completeInputsByCapacity(
            tx,
            leastFee + leastExtraCapacity,
            options,
          );
        } catch (err) {
          if (
            err instanceof ErrorTransactionInsufficientCapacity &&
            leastExtraCapacity !== Zero
          ) {
            throw new ErrorTransactionInsufficientCapacity(err.amount, {
              isForChange: true,
            });
          }

          throw err;
        }
      })();

      const fee = await tx.getFee(this.client);
      if (fee < leastFee + leastExtraCapacity) {
        // Not enough capacity are collected, it should only happens when shouldAddInputs is false
        throw new ErrorTransactionInsufficientCapacity(
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
        return [collected, false];
      }

      // Invoke the change function on a transaction multiple times may cause problems, so we clone it
      const txCopy = tx.clone();
      const needed = numFrom(
        await Promise.resolve(
          options?.changeFn?.(txCopy, fee - leastFee) ??
            defaultChangeFn(
              txCopy,
              (await this.getRecommendedAddressObj()).script,
              fee - leastFee,
            ),
        ),
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
        tx.copy(txCopy);
        return [collected, true];
      }

      // The fee after changing is more than the original fee
      leastFee = changedFee;
    }
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
    const collectedCells = [];

    let acc: T = init;
    let fulfilled = false;
    for (const address of await this.getAddressObjs()) {
      for await (const cell of this.client.findCells({
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

  async completeInputsByCapacity(
    tx: Transaction,
    capacityTweak?: NumLike,
    options?: FeePayerFromAddressOptionsLike,
  ): Promise<number> {
    const expectedCapacity =
      tx.getOutputsCapacity() + numFrom(capacityTweak ?? 0);
    const inputsCapacity = await tx.getInputsCapacity(this.client);
    if (inputsCapacity >= expectedCapacity) {
      return 0;
    }

    const { addedCount, accumulated } = await this.completeInputs(
      tx,
      options?.filter ?? {
        scriptLenRange: [0, 1],
        outputDataLenRange: [0, 1],
      },
      (acc, { cellOutput: { capacity } }) => {
        const sum = acc + capacity;
        return sum >= expectedCapacity ? undefined : sum;
      },
      inputsCapacity,
    );

    if (accumulated === undefined) {
      return addedCount;
    }

    throw new ErrorTransactionInsufficientCapacity(
      expectedCapacity - accumulated,
    );
  }
}
