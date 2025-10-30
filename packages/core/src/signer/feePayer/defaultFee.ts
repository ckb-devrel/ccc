import { Address } from "../../address/index.js";
import { Cell, Transaction } from "../../ckb/transaction.js";
import { ErrorTransactionInsufficientCapacity } from "../../ckb/transactionErrors.js";
import { Client } from "../../client/client.js";
import { ClientCollectableSearchKeyFilterLike } from "../../client/clientTypes.advanced.js";
import { Zero } from "../../fixedPoint/index.js";
import { Num, numFrom, NumLike } from "../../num/index.js";
import { FeePayer } from "./index.js";

export class DefaultFeePayer implements FeePayer {
  constructor(private addresses: Address[]) {}

  private feeRate?: NumLike;
  private filter?: ClientCollectableSearchKeyFilterLike;
  private options?: {
    feeRateBlockRange?: NumLike;
    maxFeeRate?: NumLike;
    shouldAddInputs?: boolean;
  };
  private changeFn?: (
    tx: Transaction,
    capacity: Num,
  ) => Promise<NumLike> | NumLike;

  async completeTxFee(tx: Transaction, client: Client): Promise<Transaction> {
    return tx;
  }

  async completeFee(
    tx: Transaction,
    client: Client,
  ): Promise<{
    tx: Transaction;
    result: [number, boolean];
  }> {
    const feeRate =
      this.feeRate ??
      (await client.getFeeRate(this.options?.feeRateBlockRange, this.options));

    // Complete all inputs extra infos for cache
    await tx.getInputsCapacity(client);

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
        if (!(this.options?.shouldAddInputs ?? true)) {
          return 0;
        }

        try {
          return await this.completeInputsByCapacity(
            tx,
            client,
            leastFee + leastExtraCapacity,
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

      const fee = await this.getFee(from.client);
      if (fee < leastFee + leastExtraCapacity) {
        // Not enough capacity are collected, it should only happens when shouldAddInputs is false
        throw new ErrorTransactionInsufficientCapacity(
          leastFee + leastExtraCapacity - fee,
          { isForChange: leastExtraCapacity !== Zero },
        );
      }

      await from.prepareTransaction(this);
      if (leastFee === Zero) {
        // The initial fee is calculated based on prepared transaction
        // This should only happens during the first iteration
        leastFee = this.estimateFee(feeRate);
      }
      // The extra capacity paid the fee without a change
      // leastExtraCapacity should be 0 here, otherwise we should failed in the previous check
      // So this only happens in the first iteration
      if (fee === leastFee) {
        return [collected, false];
      }

      // Invoke the change function on a transaction multiple times may cause problems, so we clone it
      const tx = tx.clone();
      const needed = numFrom(await Promise.resolve(this.changeFn?.(tx, fee - leastFee)));
      if (needed > Zero) {
        // No enough extra capacity to create new cells for change, collect inputs again
        leastExtraCapacity = needed;
        continue;
      }

      if ((await tx.getFee(from.client)) !== leastFee) {
        throw new Error(
          "The change function doesn't use all available capacity",
        );
      }

      // New change cells created, update the fee
      await from.prepareTransaction(tx);
      const changedFee = tx.estimateFee(feeRate);
      if (leastFee > changedFee) {
        throw new Error("The change function removed existed transaction data");
      }
      // The fee has been paid
      if (leastFee === changedFee) {
        this.copy(tx);
        return [collected, true];
      }

      // The fee after changing is more than the original fee
      leastFee = changedFee;
    }
  }

  async completeInputsByCapacity(
    tx: Transaction,
    client: Client,
    capacityTweak?: NumLike,
  ): Promise<number> {
    const expectedCapacity =
      tx.getOutputsCapacity() + numFrom(capacityTweak ?? 0);
    const inputsCapacity = await tx.getInputsCapacity(client);
    if (inputsCapacity >= expectedCapacity) {
      return 0;
    }

    const { addedCount, accumulated } = await this.completeInputs(
      tx,
      client,
      this.filter ?? {
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
    tx: Transaction;
    addedCount: number;
    accumulated?: T;
  }> {
    const collectedCells = [];

    let acc: T = init;
    let fulfilled = false;
    for (const address of this.addresses) {
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
        tx,
        addedCount: collectedCells.length,
      };
    }

    return {
      tx,
      addedCount: collectedCells.length,
      accumulated: acc,
    };
  }
}
