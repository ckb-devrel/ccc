import { Address } from "../address/index.js";
import { Cell, Transaction, TransactionLike } from "../ckb/transaction.js";
import { Zero } from "../fixedPoint/index.js";
import { Num, numFrom, NumLike } from "../num/index.js";
import { ErrorFeePayerInsufficientCapacity } from "./errors.js";
import { FeePayer } from "./feePayer.js";
import {
  FeePayerCollectCapacityResult,
  FeePayerCompleteFeeResult,
  FeePayerCompleteInputsContext,
  FeePayerCompleteInputsOptions,
  FeePayerCompleteInputsOptionsLike,
  FeePayerCompleteInputsResult,
  FeePayerGetFeeRateOptionsLike,
} from "./types.js";

/**
 * A fee payer that uses addresses to find cells and complete transactions.
 * @public
 */
export abstract class FeePayerFromAddress extends FeePayer<
  FeePayerCompleteInputsOptionsLike,
  FeePayerCompleteInputsContext
> {
  /**
   * Gets an array of Address objects associated with the signer.
   *
   * @returns A promise that resolves to an array of Address objects.
   */
  abstract getAddressObjs(): Promise<Address[]>;

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

  /**
   * Completes transaction inputs by searching for cells associated with the fee payer's addresses.
   *
   * @param txLike - The transaction to complete inputs for.
   * @param accumulator - A function that accumulates cells until a condition is met.
   * @param init - The initial value for the accumulator.
   * @param options - Optional configuration for completing inputs.
   * @returns A promise that resolves to the result of completing inputs.
   */
  async completeInputs<T>(
    txLike: TransactionLike,
    accumulator: (
      acc: T,
      v: Cell,
      i: number,
      array: Cell[],
    ) => Promise<T | undefined> | T | undefined,
    init: T,
    options?: FeePayerCompleteInputsOptionsLike,
  ): Promise<FeePayerCompleteInputsResult & { accumulated?: T }> {
    const tx = Transaction.from(txLike);
    const collectedCells = [];

    let acc: T = init;
    let fulfilled = false;

    if (!FeePayerCompleteInputsOptions.from(options).shouldAddInputs) {
      return {
        tx,
        addedCount: 0,
        accumulated: acc,
        collectedCapacity: Zero,
      };
    }

    for (const address of await this.getAddressObjs()) {
      for await (const cell of this.client.findCells({
        script: address.script,
        scriptType: "lock",
        filter: options?.filter,
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
    const collectedCapacity = collectedCells.reduce(
      (acc, { cellOutput: { capacity } }) => acc + capacity,
      Zero,
    );
    if (fulfilled) {
      return {
        tx,
        addedCount: collectedCells.length,
        collectedCapacity,
      };
    }

    return {
      tx,
      addedCount: collectedCells.length,
      collectedCapacity,
      accumulated: acc,
    };
  }

  /**
   * Completes transaction inputs to satisfy a required capacity.
   *
   * @param txLike - The transaction to complete inputs for.
   * @param capacityTweak - Optional additional capacity needed.
   * @param options - Optional configuration for completing inputs.
   * @returns A promise that resolves to the result of completing inputs.
   */
  async completeInputsByCapacity(
    txLike: TransactionLike,
    capacityTweak?: NumLike,
    options?: FeePayerCompleteInputsOptionsLike,
  ): Promise<FeePayerCompleteInputsResult> {
    const {
      tx,
      context: { addedCount, collectedCapacity },
      expectedCapacity,
      accumulated,
    } = await this.collectCapacity(txLike, capacityTweak, options);

    if (accumulated !== undefined) {
      throw new ErrorFeePayerInsufficientCapacity(
        expectedCapacity - accumulated,
      );
    }

    return {
      tx,
      addedCount,
      collectedCapacity,
    };
  }

  /**
   * Completes transaction inputs by adding all available cells from the fee payer.
   *
   * @param txLike - The transaction to complete inputs for.
   * @param options - Optional configuration for completing inputs.
   * @returns A promise that resolves to the result of completing inputs.
   */
  async completeInputsAll(
    txLike: TransactionLike,
    options?: FeePayerCompleteInputsOptionsLike,
  ): Promise<FeePayerCompleteInputsResult> {
    return this.completeInputs(
      txLike,
      (acc, { cellOutput: { capacity } }) => acc + capacity,
      Zero,
      options,
    );
  }

  /**
   * Completes transaction inputs by adding exactly one more cell.
   *
   * @param txLike - The transaction to complete inputs for.
   * @param options - Optional configuration for completing inputs.
   * @returns A promise that resolves to the result of completing inputs.
   */
  async completeInputsAddOne(
    txLike: TransactionLike,
    options?: FeePayerCompleteInputsOptionsLike,
  ): Promise<FeePayerCompleteInputsResult> {
    const res = await this.completeInputs(
      txLike,
      () => undefined,
      true,
      options,
    );

    if (res.accumulated === undefined) {
      return res;
    }

    throw new Error(`Insufficient CKB, need at least one new cell`);
  }

  /**
   * Completes transaction inputs by adding at least one cell if no inputs exist.
   *
   * @param txLike - The transaction to complete inputs for.
   * @param options - Optional configuration for completing inputs.
   * @returns A promise that resolves to the result of completing inputs.
   */
  async completeInputsAtLeastOne(
    txLike: TransactionLike,
    options?: FeePayerCompleteInputsOptionsLike,
  ): Promise<FeePayerCompleteInputsResult> {
    const tx = Transaction.from(txLike);
    if (tx.inputs.length > 0) {
      return {
        tx,
        addedCount: 0,
        collectedCapacity: Zero,
      };
    }

    return this.completeInputsAddOne(tx, options);
  }

  /**
   * Collects capacity for the transaction from the fee payer's addresses.
   *
   * @param txLike - The transaction to collect capacity for.
   * @param capacityTweak - Optional additional capacity needed.
   * @param options - Optional configuration for completing inputs.
   * @param contextLike - Optional context for completing inputs.
   * @returns A promise that resolves to the result of collecting capacity, including the total capacity collected from added inputs.
   *
   * @remarks
   * This method attempts to collect sufficient capacity to meet the requirement (outputs capacity plus `capacityTweak`).
   * If the requirement cannot be fully met, it adds as many inputs as possible to minimize the deficit and does NOT throw an error.
   * This behavior enables multiple fee payers to collaborate in providing the necessary capacity.
   */
  async collectCapacity(
    txLike: TransactionLike,
    capacityTweak?: NumLike,
    options?: FeePayerCompleteInputsOptionsLike,
    contextLike?: FeePayerCompleteInputsContext,
  ): Promise<
    FeePayerCollectCapacityResult<FeePayerCompleteInputsContext> & {
      expectedCapacity: Num;
      accumulated?: Num;
    }
  > {
    const tx = Transaction.from(txLike);
    const context = {
      addedCount: contextLike?.addedCount ?? 0,
      collectedCapacity: contextLike?.collectedCapacity ?? Zero,
    };

    const expectedCapacity =
      tx.getOutputsCapacity() + numFrom(capacityTweak ?? 0);
    const inputsCapacity = await tx.getInputsCapacity(this.client);
    if (inputsCapacity >= expectedCapacity) {
      return {
        tx,
        context,
        expectedCapacity,
        collectedCapacity: Zero,
      };
    }

    const {
      addedCount,
      accumulated,
      collectedCapacity,
      tx: resTx,
    } = await this.completeInputs(
      tx,
      (acc, { cellOutput: { capacity } }) => {
        const sum = acc + capacity;
        return sum >= expectedCapacity ? undefined : sum;
      },
      inputsCapacity,
      options,
    );
    context.addedCount += addedCount;
    context.collectedCapacity += collectedCapacity;

    return {
      tx: resTx,
      context,
      expectedCapacity,
      collectedCapacity,
      accumulated,
    };
  }

  /**
   * Completes the transaction fee by adding a change output to a recommended address.
   *
   * @param txLike - The transaction to complete the fee for.
   * @param options - Optional configuration for completing the fee.
   * @returns A promise that resolves to the transaction with the fee paid, whether it was modified, and the operation context.
   */
  async completeFee(
    txLike: TransactionLike,
    options?: FeePayerGetFeeRateOptionsLike & FeePayerCompleteInputsOptionsLike,
  ): Promise<FeePayerCompleteFeeResult<FeePayerCompleteInputsContext>> {
    return this.completeFeeChangeToLock(
      txLike,
      (await this.getRecommendedAddressObj()).script,
      options,
    );
  }
}
