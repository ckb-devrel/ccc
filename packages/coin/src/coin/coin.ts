import { ccc } from "@ckb-ccc/core";
import { CoinInfo, CoinInfoLike } from "./coinInfo.js";
import { ErrorCoinInsufficient } from "./error.js";

/**
 * Return type for all `complete*` methods on {@link Coin}.
 *
 * @public
 */
export type CoinCompleteResponse = {
  /** The completed transaction. */
  tx: ccc.Transaction;
  /** Number of Coin inputs added to the transaction. */
  addedInputs: number;
  /** Whether a change output was written. `false` when inputs and outputs were already balanced. */
  hasChanged: boolean;
  /**
   * Index of the change output in `tx.outputs`.
   * `undefined` when `hasChanged` is `false`.
   */
  changeIndex: number | undefined;
};

/**
 * Options for creating a {@link Coin} instance.
 * @public
 */
export type CoinOptions = {
  script: ccc.ScriptLike | Promise<ccc.ScriptLike>;
  filter?:
    | ccc.ClientIndexerSearchKeyFilterLike
    | Promise<ccc.ClientIndexerSearchKeyFilterLike>
    | null;
  cellDeps: ccc.CellDepLike[] | Promise<ccc.CellDepLike[]>;
} & (
  | {
      client: ccc.Client;
      signer?: null;
    }
  | {
      client?: ccc.Client | null;
      signer: ccc.Signer;
    }
);

/**
 * A generic on-chain Coin (fungible token) identified by a CKB type script.
 *
 * Provides helpers for querying balances and building/completing transactions.
 * Asset identity is defined by the complete type script `(codeHash, hashType, args)` —
 * only cells with an identical type script belong to the same Coin.
 *
 * @public
 * @category Blockchain
 * @category Token
 */
export class Coin {
  /** Type script that identifies this Coin. @public */
  public readonly script: Promise<ccc.Script>;

  private readonly _signer: ccc.Signer | undefined;

  /**
   * Signer used for all input sourcing and transaction completion.
   * @throws if the `Coin` was constructed without a `signer`.
   * @public
   */
  get signer(): ccc.Signer {
    if (!this._signer) {
      throw new Error(
        "Coin was constructed without a signer. Pass signer to use this method.",
      );
    }
    return this._signer;
  }

  /** Client for network requests. @public */
  public readonly client: ccc.Client;

  /**
   * Indexer search filter used to find Coin cells.
   * Defaults to cells with this type script and `outputDataLenRange: [16, ∞)`.
   *
   * @public
   */
  public readonly filter: Promise<ccc.ClientIndexerSearchKeyFilter>;

  /** Cell deps required by the type script, added to every built transaction. @public */
  public readonly cellDeps: Promise<ccc.CellDep[]>;

  /**
   * @param options.script - Type script that identifies this Coin asset.
   * @param options.signer - Signer used for input sourcing and transaction completion.
   *   Takes priority over `client`. Required for `complete*` methods.
   * @param options.client - Client for network requests. Used when no `signer` is provided.
   *   At least one of `signer` or `client` must be supplied.
   * @param options.filter - Custom indexer filter. Defaults to cells with this type script
   *   and `outputDataLenRange: [16, ∞)`.
   * @param options.cellDeps - Cell deps automatically added to every built transaction.
   *
   * @example
   * ```typescript
   * const coin = new Coin({
   *   script: { codeHash: "0x...", hashType: "type", args: "0x..." },
   *   signer,
   *   cellDeps: [{ outPoint: codeOutPoint, depType: "code" }],
   * });
   * ```
   */
  constructor(options: CoinOptions) {
    this._signer = options.signer ?? undefined;
    if (options.signer == undefined) {
      this.client = options.client;
    } else {
      this.client = options.signer.client;
    }

    this.script = Promise.resolve(options.script).then((s) =>
      ccc.Script.from(s),
    );

    this.cellDeps = Promise.resolve(options.cellDeps).then((deps) =>
      deps.map(ccc.CellDep.from),
    );

    if (options.filter !== undefined && options.filter !== null) {
      this.filter = Promise.resolve(options.filter).then((f) =>
        ccc.ClientIndexerSearchKeyFilter.from(f),
      );
    } else {
      this.filter = this.script.then((script) =>
        ccc.ClientIndexerSearchKeyFilter.from({
          script,
          outputDataLenRange: [16, "0xffffffff"],
        }),
      );
    }
  }

  /**
   * Reads the Coin balance from raw output data without verifying the type script.
   * Returns `0` if the data is shorter than 16 bytes.
   *
   * ⚠️ The caller must ensure the data belongs to a valid Coin cell.
   * For safe extraction from an arbitrary cell use `balanceFrom`.
   */
  static balanceFromUnsafe(outputData: ccc.HexLike): ccc.Num {
    const data = ccc.bytesFrom(outputData).slice(0, 16);
    return data.length < 16 ? ccc.Zero : ccc.numLeFromBytes(data);
  }

  /**
   * Aggregates Coin info (balance, capacity, count) from cells, skipping non-Coins.
   * Accepts a single cell, a sync iterable, or an async iterable.
   */
  async infoFrom(
    cells:
      | ccc.CellAnyLike
      | Iterable<ccc.CellAnyLike>
      | AsyncIterable<ccc.CellAnyLike>,
    acc?: CoinInfoLike | null,
  ): Promise<CoinInfo> {
    const result = CoinInfo.from(acc).clone();

    // TODO: Replace this with a refactored `ccc.reduceAsync` utility for better performance and cleaner code.
    // See https://github.com/ckb-devrel/ccc/commit/5e1f8d2d3e6ee26002e323ff0bcd1fcf54240f0b
    const iterable: AsyncIterable<ccc.CellAnyLike> | Iterable<ccc.CellAnyLike> =
      Symbol.asyncIterator in Object(cells)
        ? (cells as AsyncIterable<ccc.CellAnyLike>)
        : Symbol.iterator in Object(cells)
          ? (cells as Iterable<ccc.CellAnyLike>)
          : [cells as ccc.CellAnyLike];

    for await (const cellLike of iterable) {
      const cell = ccc.CellAny.from(cellLike);
      if (!(await this.isCoin(cell))) {
        continue;
      }

      result.addAssign({
        balance: Coin.balanceFromUnsafe(cell.outputData),
        capacity: cell.cellOutput.capacity,
        count: 1,
      });
    }

    return result;
  }

  /** Convenience wrapper around `infoFrom` that returns only the balance. */
  async balanceFrom(
    cells:
      | ccc.CellAnyLike
      | Iterable<ccc.CellAnyLike>
      | AsyncIterable<ccc.CellAnyLike>,
    acc?: ccc.NumLike | null,
  ): Promise<ccc.Num> {
    return (await this.infoFrom(cells, { balance: acc })).balance;
  }

  /**
   * Scans all Coins owned by the signer and returns aggregated info.
   *
   * @param options.source - `"chain"` (default) queries on-chain state; `"local"` uses the
   *   local indexer cache which is faster but may be stale.
   *
   * ⚠️ Expensive — scales linearly with the number of Coin cells.
   */
  async calculateInfo(
    signer?: ccc.Signer | null,
    options?: { source?: "chain" | "local" | null },
  ): Promise<CoinInfo> {
    const s = signer ?? this.signer;
    const isFromLocal = (options?.source ?? "chain") === "local";
    const filter = await this.filter;
    const cells = isFromLocal
      ? s.findCells(filter)
      : s.findCellsOnChain(filter);

    return this.infoFrom(cells);
  }

  /**
   * Convenience wrapper around `calculateInfo` that returns only the balance.
   *
   * ⚠️ Expensive — scans all Coin cells owned by the signer.
   */
  async calculateBalance(
    signer?: ccc.Signer | null,
    options?: { source?: "chain" | "local" | null },
  ): Promise<ccc.Num> {
    return (await this.calculateInfo(signer, options)).balance;
  }

  /**
   * Returns whether the cell is a valid Coin for this token.
   * Subclasses may override this to apply additional validation rules.
   */
  async isCoin(cellLike: ccc.CellAnyLike): Promise<boolean> {
    const cell = ccc.CellAny.from(cellLike);
    return (
      (cell.cellOutput.type?.eq(await this.script) ?? false) &&
      ccc.bytesFrom(cell.outputData).length >= 16
    );
  }

  /** Returns aggregated Coin info (balance, capacity, count) for all Coin inputs in the transaction. */
  async getInputsInfo(txLike: ccc.TransactionLike): Promise<CoinInfo> {
    const tx = ccc.Transaction.from(txLike);
    const client = this.client;
    return this.infoFrom(
      (async function* () {
        for (const input of tx.inputs) {
          yield await input.getCell(client);
        }
      })(),
    );
  }

  /** Convenience wrapper around `getInputsInfo` that returns only the balance. */
  async getInputsBalance(txLike: ccc.TransactionLike): Promise<ccc.Num> {
    return (await this.getInputsInfo(txLike)).balance;
  }

  /** Returns aggregated Coin info (balance, capacity, count) for all Coin outputs in the transaction. */
  async getOutputsInfo(txLike: ccc.TransactionLike): Promise<CoinInfo> {
    const tx = ccc.Transaction.from(txLike);
    return this.infoFrom(Array.from(tx.outputCells));
  }

  /** Convenience wrapper around `getOutputsInfo` that returns only the balance. */
  async getOutputsBalance(txLike: ccc.TransactionLike): Promise<ccc.Num> {
    return (await this.getOutputsInfo(txLike)).balance;
  }

  /**
   * Returns inputs minus outputs as a `CoinInfo`. Positive balance means tokens are burned;
   * positive capacity means Coins provide surplus CKB.
   */
  async getInfoBurned(txLike: ccc.TransactionLike): Promise<CoinInfo> {
    const tx = ccc.Transaction.from(txLike);
    return (await this.getInputsInfo(tx)).sub(await this.getOutputsInfo(tx));
  }

  /** Convenience wrapper around `getInfoBurned` that returns only the balance (inputs − outputs). */
  async getBalanceBurned(txLike: ccc.TransactionLike): Promise<ccc.Num> {
    return (await this.getInfoBurned(txLike)).balance;
  }

  /**
   * Low-level input selector driven by a custom accumulator.
   * For each candidate Coin cell the `accumulator` receives `(state, cell, coinInfo)` and
   * returns the next state to keep going, or `undefined` to stop.
   *
   * @returns `accumulated` is `undefined` if the target was reached before all cells were visited.
   *
   * @remarks Does not add `cellDeps`. Use `complete` / `completeChangeToLock` / `completeBy` instead.
   *
   * @example
   * ```typescript
   * // Collect inputs until balance reaches a target
   * const { tx } = await coin.completeInputs(
   *   tx, signer,
   *   (acc, _cell, coinInfo) => {
   *     const next = acc + coinInfo.balance;
   *     return next >= target ? undefined : next;
   *   },
   *   ccc.Zero,
   * );
   * ```
   */
  async completeInputs<T>(
    txLike: ccc.TransactionLike,
    accumulator: (
      acc: T,
      cell: ccc.Cell,
      coinInfo: CoinInfo,
    ) => Promise<T | undefined> | T | undefined,
    init: T,
  ): Promise<{
    tx: ccc.Transaction;
    addedCount: number;
    accumulated?: T;
  }> {
    const tx = ccc.Transaction.from(txLike);
    tx.addCellDeps(await this.cellDeps);

    const res = await tx.completeInputs(
      this.signer,
      await this.filter,
      async (acc, cell) => accumulator(acc, cell, await this.infoFrom(cell)),
      init,
    );

    return {
      ...res,
      tx,
    };
  }

  /**
   * Adds Coin inputs until the Coin balance gap is covered, also attempting to cover the
   * CKB capacity gap on a best-effort basis (capacity may still be negative if Coin inputs
   * are exhausted before it is satisfied).
   *
   * @param balanceTweak - Extra Coin balance to require beyond what outputs consume.
   * @param capacityTweak - Extra CKB capacity to require beyond what outputs consume.
   *
   * @throws {ErrorCoinInsufficient} if the signer has insufficient Coin balance.
   *
   * @example
   * ```typescript
   * const { tx: completedTx } = await coin.completeInputsByBalance(tx);
   * ```
   */
  async completeInputsByBalance(
    txLike: ccc.TransactionLike,
    balanceTweak?: ccc.NumLike | null,
    capacityTweak?: ccc.NumLike | null,
  ): Promise<{
    addedCount: number;
    tx: ccc.Transaction;
  }> {
    const tx = ccc.Transaction.from(txLike);
    tx.addCellDeps(await this.cellDeps);

    const { balance: inBalance, capacity: inCapacity } =
      await this.getInputsInfo(tx);
    const { balance: outBalance, capacity: outCapacity } =
      await this.getOutputsInfo(tx);

    const balanceBurned =
      inBalance - outBalance - ccc.numFrom(balanceTweak ?? 0);
    // Try to let Coin inputs absorb the tx fee so no extra CKB capacity cell is needed.
    // Cap at the current fee: we never ask Coins to cover more than what the tx owes.
    const capacityBurned =
      ccc.numMin(inCapacity - outCapacity, await tx.getFee(this.client)) -
      ccc.numFrom(capacityTweak ?? 0);

    if (balanceBurned >= ccc.Zero && capacityBurned >= ccc.Zero) {
      return { addedCount: 0, tx };
    }

    const {
      tx: txRes,
      addedCount,
      accumulated,
    } = await this.completeInputs(
      tx,
      (acc, _cell, coinInfo) => {
        const info = acc.add(coinInfo);

        // Try to provide enough capacity with Coins to avoid extra occupation
        return info.balance >= ccc.Zero && info.capacity >= ccc.Zero
          ? undefined
          : info;
      },
      CoinInfo.from({ balance: balanceBurned, capacity: capacityBurned }),
    );

    if (accumulated === undefined || accumulated.balance >= ccc.Zero) {
      return { tx: txRes, addedCount };
    }

    throw new ErrorCoinInsufficient({
      amount: -accumulated.balance,
      type: await this.script,
    });
  }

  /**
   * Adds ALL available Coins from the signer as inputs. Useful for consolidation or full sweeps.
   *
   * @remarks Does not add `cellDeps`. Use `complete` / `completeChangeToLock` / `completeBy` instead.
   */
  async completeInputsAll(txLike: ccc.TransactionLike): Promise<{
    addedCount: number;
    tx: ccc.Transaction;
  }> {
    const tx = ccc.Transaction.from(txLike);

    const { tx: txRes, addedCount } = await this.completeInputs(
      tx,
      (acc, _cell, coinInfo) => acc.addAssign(coinInfo),
      CoinInfo.default(),
    );

    return { tx: txRes, addedCount };
  }

  /**
   * Low-level completion primitive. Adds Coin inputs, then calls `change(tx, balance)` to
   * write the change output. `change` is called twice: once on a clone to measure the extra
   * capacity the change cell needs, and once on the real transaction with the final balance.
   *
   * @param change - Callback that receives the transaction and the excess Coin balance, and
   *   should write the change output in place. Must be side-effect-free beyond modifying `tx`.
   * @param options.shouldAddInputs - When `false`, skips input sourcing entirely and calls
   *   `change` once with the current balance. Defaults to `true`.
   *
   * @example
   * ```typescript
   * const { tx: completedTx } = await coin.complete(tx, (tx, balance) => {
   *   tx.addOutput({ lock: changeLock, type: coin.script }, ccc.numLeToBytes(balance, 16));
   * });
   * ```
   */
  async complete(
    txLike: ccc.TransactionLike,
    change: (tx: ccc.Transaction, balance: ccc.Num) => Promise<void> | void,
    options?: { shouldAddInputs?: boolean | null },
  ): Promise<CoinCompleteResponse> {
    let tx = ccc.Transaction.from(txLike);
    tx.addCellDeps(await this.cellDeps);
    let addedInputs = 0;

    /* === Figure out the balance to change === */
    if (options?.shouldAddInputs ?? true) {
      const res = await this.completeInputsByBalance(tx);
      tx = res.tx;
      addedInputs += res.addedCount;
    }

    const balanceBurned = await this.getBalanceBurned(tx);

    if (balanceBurned < ccc.Zero) {
      throw new ErrorCoinInsufficient({
        amount: -balanceBurned,
        type: await this.script,
      });
    } else if (balanceBurned === ccc.Zero) {
      // No change needed — inputs and outputs are perfectly balanced
      return { tx, addedInputs, hasChanged: false, changeIndex: undefined };
    }
    /* === Some balance need to change === */

    if (!(options?.shouldAddInputs ?? true)) {
      // Caller manages inputs manually; apply change with current balance as-is
      await Promise.resolve(change(tx, balanceBurned));
      return { tx, addedInputs, hasChanged: true, changeIndex: undefined };
    }

    // Clone the transaction and apply change to measure the extra output capacity
    // the change cell requires, then source inputs, and finally apply change to
    // the real transaction with the correct final balance.
    const cloned = tx.clone();
    const capacityBefore = tx.getOutputsCapacity();
    await Promise.resolve(change(cloned, balanceBurned));
    const extraCapacity = cloned.getOutputsCapacity() - capacityBefore;

    const res2 = await this.completeInputsByBalance(
      tx,
      ccc.Zero,
      extraCapacity,
    );
    tx = res2.tx;
    addedInputs += res2.addedCount;

    await Promise.resolve(change(tx, await this.getBalanceBurned(tx)));

    return { tx, addedInputs, hasChanged: true, changeIndex: undefined };
  }

  /**
   * Completes the transaction by writing the excess Coin balance into the existing output at
   * `index`. The output must already be a valid Coin cell with this type script.
   *
   * @param options.transformer - Optional callback to further modify the change cell after the
   *   balance has been written into `outputData[0..16)`. Receives the updated cell and returns
   *   the final cell. Any capacity below the data minimum is raised automatically; capacity
   *   above the minimum is preserved as-is. The transformer runs on every `change` call, so
   *   it must be idempotent with respect to data layout.
   *
   * @throws {Error} If the output at `index` does not exist or is not a valid Coin.
   *
   * @example
   * ```typescript
   * // Change goes into output 1 of the transaction
   * const completedTx = await coin.completeChangeToOutput(tx, 1);
   * ```
   */
  async completeChangeToOutput(
    txLike: ccc.TransactionLike,
    indexLike: ccc.NumLike,
    options?: {
      shouldAddInputs?: boolean | null;
      transformer?:
        | ((cell: ccc.CellAny) => ccc.CellAnyLike | Promise<ccc.CellAnyLike>)
        | null;
    },
  ) {
    const tx = ccc.Transaction.from(txLike);
    const index = Number(ccc.numFrom(indexLike));

    const cellOutput = tx.outputs[index];
    if (!cellOutput) {
      throw new Error(`Output at index ${index} does not exist`);
    }

    const output = ccc.CellAny.from({
      cellOutput: cellOutput.clone(),
      outputData: tx.outputsData[index],
    });

    if (!(await this.isCoin(output))) {
      throw new Error("Change output must be a Coin");
    }

    const result = await this.complete(
      tx,
      async (tx, balance) => {
        const balanceData = ccc.numLeToBytes(
          await this.balanceFrom(output, balance),
          16,
        );

        let cell = ccc.CellAny.from({
          cellOutput: output.cellOutput.clone(),
          outputData: ccc.hexFrom(
            ccc.bytesConcat(
              balanceData,
              ccc.bytesFrom(output.outputData).slice(16),
            ),
          ),
        });

        if (options?.transformer) {
          cell = ccc.CellAny.from(await options.transformer(cell));
        }

        tx.outputs[index] = cell.cellOutput;
        tx.outputsData[index] = cell.outputData;
      },
      options,
    );

    return { ...result, changeIndex: result.hasChanged ? index : undefined };
  }

  /**
   * Completes the transaction by creating a new change output locked to `changeLike`.
   *
   * @param options.transformer - Optional callback to further modify the change cell after the
   *   balance has been encoded into `outputData[0..16)`. Use this to append protocol-specific
   *   data or reserve extra capacity.
   *
   * @example
   * ```typescript
   * const { script: changeLock } = await coin.signer.getRecommendedAddressObj();
   * const { tx: completedTx, changeIndex } = await coin.completeChangeToLock(tx, changeLock);
   * ```
   *
   * @example
   * ```typescript
   * // Append extra protocol data after the 16-byte balance prefix
   * const { tx: completedTx } = await coin.completeChangeToLock(tx, changeLock, {
   *   transformer: async (cell) => ({
   *     ...cell,
   *     outputData: ccc.hexFrom(ccc.bytesConcat(ccc.bytesFrom(cell.outputData), extraData)),
   *   }),
   * });
   * ```
   */
  async completeChangeToLock(
    txLike: ccc.TransactionLike,
    changeLike: ccc.ScriptLike,
    options?: {
      shouldAddInputs?: boolean | null;
      transformer?:
        | ((cell: ccc.CellAny) => ccc.CellAnyLike | Promise<ccc.CellAnyLike>)
        | null;
    },
  ): Promise<CoinCompleteResponse> {
    const change = ccc.Script.from(changeLike);
    let changeIndex: number | undefined;

    const { tx, addedInputs, hasChanged } = await this.complete(
      txLike,
      async (tx, balance) => {
        let cell = ccc.CellAny.from({
          cellOutput: { lock: change, type: await this.script },
          outputData: ccc.numLeToBytes(balance, 16),
        });

        if (options?.transformer) {
          cell = ccc.CellAny.from(await options.transformer(cell));
        }

        changeIndex = tx.outputs.length;
        tx.addOutput(cell.cellOutput, cell.outputData);
      },
      options,
    );

    return { tx, addedInputs, hasChanged, changeIndex };
  }

  /**
   * Convenience wrapper around `completeChangeToLock` using the signer's recommended address.
   *
   * @example
   * ```typescript
   * const { tx: completedTx } = await coin.completeBy(tx);
   * await completedTx.completeInputsByCapacity(coin.signer);
   * await completedTx.completeFeeBy(coin.signer);
   * await coin.signer.sendTransaction(completedTx);
   * ```
   *
   * @see {@link completeChangeToLock} for more control over the change destination.
   */
  async completeBy(
    tx: ccc.TransactionLike,
    options?: {
      shouldAddInputs?: boolean | null;
      transformer?:
        | ((cell: ccc.CellAny) => ccc.CellAnyLike | Promise<ccc.CellAnyLike>)
        | null;
    },
  ) {
    const { script } = await this.signer.getRecommendedAddressObj();

    return this.completeChangeToLock(tx, script, options);
  }

  /**
   * Adds one Coin output per entry in `transfers`. Does not source inputs or write change —
   * call `completeBy` (or another `complete*` method) afterwards to balance the transaction.
   *
   * @example
   * ```typescript
   * const tx = ccc.Transaction.from({});
   * coin.transfer(tx, [{ to: recipientLock, amount: 100n }]);
   * const { tx: completedTx } = await coin.completeBy(tx);
   * await completedTx.completeInputsByCapacity(coin.signer);
   * await completedTx.completeFeeBy(coin.signer);
   * await coin.signer.sendTransaction(completedTx);
   * ```
   */
  async transfer(
    txLike: ccc.TransactionLike,
    transfers: {
      to: ccc.ScriptLike;
      amount: ccc.NumLike;
    }[],
  ): Promise<ccc.Transaction> {
    const tx = ccc.Transaction.from(txLike);

    for (const { to, amount } of transfers) {
      tx.addOutput(
        { lock: to, type: await this.script },
        ccc.numLeToBytes(ccc.numFrom(amount), 16),
      );
    }

    return tx;
  }
}
