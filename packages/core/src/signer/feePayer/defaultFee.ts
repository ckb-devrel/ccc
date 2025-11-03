import { Address, AddressLike } from "../../address/index.js";
import { Script } from "../../ckb/script.js";
import {
  Cell,
  CellOutput,
  Transaction,
  TransactionLike,
} from "../../ckb/transaction.js";
import { ErrorTransactionInsufficientCapacity } from "../../ckb/transactionErrors.js";
import { Client } from "../../client/client.js";
import { ClientCollectableSearchKeyFilterLike } from "../../client/clientTypes.advanced.js";
import { fixedPointFrom, Zero } from "../../fixedPoint/index.js";
import { Num, numFrom, NumLike } from "../../num/index.js";
import { FeePayer } from "./index.js";

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

export class DefaultFeePayer implements FeePayer {
  private addresses: Address[] = [];

  private changeFn?: (
    tx: Transaction,
    capacity: Num,
  ) => Promise<NumLike> | NumLike;
  private feeRate?: NumLike;
  private filter?: ClientCollectableSearchKeyFilterLike;
  private options?: {
    feeRateBlockRange?: NumLike;
    maxFeeRate?: NumLike;
    shouldAddInputs?: boolean;
  };

  async completeTxFee(tx: Transaction, client: Client): Promise<void> {
    await this.completeFee(tx, client);
  }

  setAddresses(addresses: AddressLike[]): void {
    this.addresses = addresses.map((address) => Address.from(address));
    if (this.addresses.length === 0) {
      throw new Error("Addresses cannot be empty");
    }
  }

  setOptionalProperties(props: {
    changeFn?: (tx: Transaction, capacity: Num) => Promise<NumLike> | NumLike;
    feeRate?: NumLike;
    filter?: ClientCollectableSearchKeyFilterLike;
    options?: {
      feeRateBlockRange?: NumLike;
      maxFeeRate?: NumLike;
      shouldAddInputs?: boolean;
    };
  }): void {
    this.changeFn = props.changeFn;
    this.feeRate = props.feeRate;
    this.filter = props.filter;
    this.options = props.options;
  }

  async completeFee(
    tx: Transaction,
    client: Client,
  ): Promise<[number, boolean]> {
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

      const fee = await tx.getFee(client);
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
          this.changeFn?.(txCopy, fee - leastFee) ??
            defaultChangeFn(txCopy, this.addresses[0].script, fee - leastFee),
        ),
      );
      if (needed > Zero) {
        // No enough extra capacity to create new cells for change, collect inputs again
        leastExtraCapacity = needed;
        continue;
      }

      if ((await txCopy.getFee(client)) !== leastFee) {
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
        addedCount: collectedCells.length,
      };
    }

    return {
      addedCount: collectedCells.length,
      accumulated: acc,
    };
  }
}
