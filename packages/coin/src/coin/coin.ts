import { coBuild } from "@ckb-ccc/co-build";
import { ccc } from "@ckb-ccc/core";
import { CoinAction } from "../coBuild.js";
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
   * Indexes of change outputs in `tx.outputs`.
   * Empty when `hasChanged` is `false` or when the generic completion callback
   * does not report concrete output indexes.
   */
  changeIndexes: number[];
};

/**
 * Script configurations for {@link Coin}.
 * @public
 */
export type CoinOptionsScript = {
  knownScript?: ccc.KnownScript | null;
  script: {
    codeHash?: ccc.HexLike | null;
    hashType?: ccc.HashTypeLike | null;
    args: ccc.BytesLike;
  };
  cellDeps?: ccc.CellDepLike[] | null;
};

/**
 * Common configurations shared by {@link Coin} implementations.
 * @public
 */
export type CoinOptionsCommon = {
  client: ccc.Client;
  filter?: ccc.ClientIndexerSearchKeyFilterLike | null;
  outputTransformer?:
    ((cell: ccc.CellAny) => ccc.CellAnyLike | Promise<ccc.CellAnyLike>) | null;
  scriptInfo?: coBuild.ScriptInfoLike | null;
};

/**
 * Options for creating a {@link Coin} instance.
 * @public
 */
export type CoinOptions = CoinOptionsCommon & CoinOptionsScript;

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

  /** Output transformer for Coin outputs. @public */
  public readonly outputTransformer?:
    ((cell: ccc.CellAny) => ccc.CellAnyLike | Promise<ccc.CellAnyLike>) | null;

  /** CoBuild instance for this Coin. @public */
  public readonly coBuild: Promise<coBuild.CoBuild>;

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
   * @param options.knownScript - Optional known script standard (e.g., `ccc.KnownScript.SUdt`) to dynamically resolve `codeHash`, `hashType`, and `cellDeps`.
   *   Used only when `script.codeHash` or `script.hashType` is not provided.
   * @param options.script - Type script that identifies this Coin asset. A complete script with `codeHash` and `hashType`
   *   takes priority over `knownScript`; otherwise `knownScript` is used as shorthand and only `args` is required.
   * @param options.client - Client for network requests.
   * @param options.filter - Custom indexer filter. Defaults to cells with this type script
   *   and `outputDataLenRange: [16, ∞)`.
   * @param options.cellDeps - Cell deps automatically added to every built transaction. If the known script shorthand is used, these custom cell deps are appended after the resolved default cell deps of the known script.
   * @param options.outputTransformer - Optional callback to further modify generated Coin cells after the
   *   amount has been written into `outputData[0..16)`. Any capacity below the data minimum is raised automatically;
   *   capacity above the minimum is preserved as-is.
   *
   * @example
   * ```typescript
   * const coin = new Coin({
   *   script: { codeHash: "0x...", hashType: "type", args: "0x..." },
   *   client,
   *   cellDeps: [{ outPoint: codeOutPoint, depType: "code" }],
   * });
   * ```
   *
   * @example
   * ```typescript
   * const coin = new Coin({
   *   knownScript: ccc.KnownScript.SUdt,
   *   script: { args: ownerLock.hash() },
   *   client,
   *   outputTransformer: async (cell) => ({
   *     ...cell,
   *     outputData: ccc.hexFrom(ccc.bytesConcat(ccc.bytesFrom(cell.outputData), extraData)),
   *   }),
   * });
   * ```
   */
  constructor(options: CoinOptions) {
    const { outputTransformer, knownScript, script, cellDeps, client } =
      options;

    this.outputTransformer = outputTransformer;
    this.client = client;

    if (
      knownScript == null &&
      (script.codeHash == null || script.hashType == null)
    ) {
      throw new Error(
        "Either knownScript or script.codeHash and script.hashType must be provided for Coin",
      );
    }
    const resolved = (async (): Promise<
      [ccc.ScriptLike, ccc.CellDepLike[]]
    > => {
      if (script.codeHash != null && script.hashType != null) {
        return [script as ccc.ScriptLike, cellDeps ?? []];
      }

      const scriptInfo = await client.getKnownScript(
        knownScript as ccc.KnownScript,
      );
      return [
        {
          codeHash: scriptInfo.codeHash,
          hashType: scriptInfo.hashType,
          args: script.args,
        },
        (await client.getCellDeps(scriptInfo.cellDeps)).concat(
          cellDeps?.map(ccc.CellDep.from) ?? [],
        ),
      ];
    })();

    this.script = resolved.then(([script]) => ccc.Script.from(script));
    this.cellDeps = resolved.then(([_, cellDeps]) =>
      cellDeps.map(ccc.CellDep.from),
    );

    const scriptRes = this.script;
    this.filter = (async () => {
      return ccc.ClientIndexerSearchKeyFilter.from(
        options.filter ?? {
          script: await scriptRes,
          outputDataLenRange: [16, "0xffffffff"],
        },
      );
    })();

    this.coBuild = Promise.all([this.script]).then(
      ([script]) => new coBuild.CoBuild(script, options.scriptInfo),
    );
  }

  /**
   * Reads the Coin amount from raw output data without verifying the type script.
   * Returns `0` if the data is shorter than 16 bytes.
   *
   * ⚠️ The caller must ensure the data belongs to a valid Coin cell.
   * For safe extraction from an arbitrary cell use `amountFrom`.
   */
  static amountFromUnsafe(outputData: ccc.HexLike): ccc.Num {
    const data = ccc.bytesFrom(outputData).slice(0, 16);
    return data.length < 16 ? ccc.Zero : ccc.numLeFromBytes(data);
  }

  /**
   * Normalizes a cell output and applies this Coin's output transformer.
   *
   * This is useful for subclasses or callers that need to construct Coin
   * outputs while preserving the same post-processing behavior used by
   * `transfer` and change creation.
   *
   * @param output - Cell output and data to normalize and transform.
   * @returns The normalized cell after `outputTransformer`, if one is configured.
   * @public
   */
  async transformOutput(output: ccc.CellAnyLike): Promise<ccc.CellAny> {
    if (!this.outputTransformer) {
      return ccc.CellAny.from(output);
    }

    return ccc.CellAny.from(
      await this.outputTransformer(ccc.CellAny.from(output)),
    );
  }

  /**
   * Writes a Coin amount into a cell's output data and applies output transformation.
   *
   * The amount is encoded as a 16-byte little-endian integer at
   * `outputData[0..16)`. Any bytes after the first 16 are preserved, which lets
   * callers keep extension data attached to token cells.
   *
   * @param output - Cell output and existing output data.
   * @param amount - Coin amount to write into `outputData[0..16)`.
   * @returns The updated cell after `outputTransformer`, if one is configured.
   * @public
   */
  async setAmount(
    output: ccc.CellAnyLike,
    amount: ccc.NumLike,
  ): Promise<ccc.CellAny> {
    const cell = ccc.CellAny.from(output);
    const normalizedAmount = ccc.numFrom(amount);

    cell.outputData = ccc.hexFrom(
      ccc.bytesConcat(
        ccc.numLeToBytes(normalizedAmount, 16),
        ccc.bytesFrom(cell.outputData).slice(16),
      ),
    );

    return this.transformOutput(cell);
  }

  /**
   * Aggregates Coin info (amount, capacity, count) from cells, skipping non-Coins.
   * Accepts a single cell, a sync iterable, or an async iterable.
   */
  async infoFrom(
    cells:
      | ccc.CellAnyLike
      | Iterable<ccc.CellAnyLike>
      | AsyncIterable<ccc.CellAnyLike>,
    acc?: CoinInfoLike | null,
  ): Promise<CoinInfo> {
    return ccc.reduceAsync(
      cells,
      async (acc, cellLike) => {
        const cell = ccc.CellAny.from(cellLike);
        if (!(await this.isCoin(cell))) {
          return;
        }

        return acc.addAssign({
          amount: Coin.amountFromUnsafe(cell.outputData),
          capacity: cell.cellOutput.capacity,
          count: 1,
        });
      },
      CoinInfo.from(acc).clone(),
    );
  }

  /** Convenience wrapper around `infoFrom` that returns only the amount. */
  async amountFrom(
    cells:
      | ccc.CellAnyLike
      | Iterable<ccc.CellAnyLike>
      | AsyncIterable<ccc.CellAnyLike>,
    acc?: ccc.NumLike | null,
  ): Promise<ccc.Num> {
    return (await this.infoFrom(cells, { amount: acc })).amount;
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
    signer: ccc.Signer,
    options?: { source?: "chain" | "local" | null },
  ): Promise<CoinInfo> {
    const isFromLocal = (options?.source ?? "chain") === "local";
    const filter = await this.filter;
    const cells = isFromLocal
      ? signer.findCells(filter)
      : signer.findCellsOnChain(filter);

    return this.infoFrom(cells);
  }

  /**
   * Convenience wrapper around `calculateInfo` that returns only the balance.
   *
   * ⚠️ Expensive — scans all Coin cells owned by the signer.
   */
  async calculateBalance(
    signer: ccc.Signer,
    options?: { source?: "chain" | "local" | null },
  ): Promise<ccc.Num> {
    return (await this.calculateInfo(signer, options)).amount;
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

  /** Returns aggregated Coin info (amount, capacity, count) for all Coin inputs in the transaction. */
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

  /** Convenience wrapper around `getInputsInfo` that returns only the amount. */
  async getInputsAmount(txLike: ccc.TransactionLike): Promise<ccc.Num> {
    return (await this.getInputsInfo(txLike)).amount;
  }

  /** Returns aggregated Coin info (amount, capacity, count) for all Coin outputs in the transaction. */
  async getOutputsInfo(txLike: ccc.TransactionLike): Promise<CoinInfo> {
    const tx = ccc.Transaction.from(txLike);
    return this.infoFrom(Array.from(tx.outputCells));
  }

  /** Convenience wrapper around `getOutputsInfo` that returns only the amount. */
  async getOutputsAmount(txLike: ccc.TransactionLike): Promise<ccc.Num> {
    return (await this.getOutputsInfo(txLike)).amount;
  }

  /**
   * Returns inputs minus outputs as a `CoinInfo`. Positive amount means tokens are burned;
   * positive capacity means Coins provide surplus CKB.
   */
  async getInfoBurned(txLike: ccc.TransactionLike): Promise<CoinInfo> {
    const tx = ccc.Transaction.from(txLike);
    return (await this.getInputsInfo(tx)).sub(await this.getOutputsInfo(tx));
  }

  /** Convenience wrapper around `getInfoBurned` that returns only the amount (inputs − outputs). */
  async getAmountBurned(txLike: ccc.TransactionLike): Promise<ccc.Num> {
    return (await this.getInfoBurned(txLike)).amount;
  }

  async getIntendedAmountBurned(txLike: ccc.TransactionLike): Promise<ccc.Num> {
    const tx = ccc.Transaction.from(txLike);

    return (await this.coBuild)
      .findActions(tx, await this.script)
      .reduce((acc, action) => {
        try {
          const coinAction = CoinAction.fromBytes(action.data, {
            isExtraFieldIgnored: true,
          });
          acc += coinAction.match({
            Mint: (mint) => -mint.amount,
            Burn: (burn) => burn.amount,
            _: () => ccc.Zero,
          });
        } catch (_) {}
        return acc;
      }, ccc.Zero);
  }

  /**
   * Low-level input selector driven by a custom accumulator.
   * For each candidate Coin cell the `accumulator` receives `(state, cell, coinInfo)` and
   * returns the next state to keep going, or `undefined` to stop.
   *
   * @returns `accumulated` is `undefined` if the target was reached before all cells were visited.
   *
   * @example
   * ```typescript
   * // Collect inputs until amount reaches a target
   * const { tx } = await coin.completeInputs(
   *   signer,
   *   (acc, _cell, coinInfo) => {
   *     const next = acc + coinInfo.amount;
   *     return next >= target ? undefined : next;
   *   },
   *   ccc.Zero,
   *   tx,
   * );
   * ```
   */
  async completeInputs<T>(
    signer: ccc.Signer,
    accumulator: (
      acc: T,
      cell: ccc.Cell,
      coinInfo: CoinInfo,
      i: number,
      cells: ccc.Cell[],
    ) => Promise<T | undefined> | T | undefined,
    init: T,
    txLike?: ccc.TransactionLike | null,
  ): Promise<{
    tx: ccc.Transaction;
    addedCount: number;
    accumulated?: T;
  }> {
    const tx = ccc.Transaction.from(txLike ?? {});
    tx.addCellDeps(await this.cellDeps);

    const res = await tx.completeInputs(
      signer,
      await this.filter,
      async (acc, cell, i, cells) =>
        accumulator(acc, cell, await this.infoFrom(cell), i, cells),
      init,
    );

    return {
      ...res,
      tx,
    };
  }

  /**
   * Adds Coin inputs until the Coin amount gap is covered, also attempting to cover the
   * CKB capacity gap on a best-effort basis (capacity may still be negative if Coin inputs
   * are exhausted before it is satisfied).
   *
   * @param amountTweak - Extra Coin amount to require beyond what outputs consume.
   * @param capacityTweak - Extra CKB capacity to require beyond what outputs consume.
   *
   * @throws {ErrorCoinInsufficient} if the signer has insufficient Coin amount.
   *
   * @example
   * ```typescript
   * const { tx: completedTx } = await coin.completeInputsByAmount(signer);
   * ```
   */
  async completeInputsByAmount(
    signer: ccc.Signer,
    txLike?: ccc.TransactionLike | null,
    amountTweak?: ccc.NumLike | null,
    capacityTweak?: ccc.NumLike | null,
  ): Promise<{
    addedCount: number;
    tx: ccc.Transaction;
  }> {
    const tx = ccc.Transaction.from(txLike ?? {});
    tx.addCellDeps(await this.cellDeps);

    const { amount: inAmount, capacity: inCapacity } =
      await this.getInputsInfo(tx);
    const { amount: outAmount, capacity: outCapacity } =
      await this.getOutputsInfo(tx);

    const amountExcess =
      inAmount -
      outAmount -
      ccc.numFrom(amountTweak ?? 0) -
      (await this.getIntendedAmountBurned(tx));
    // Try to let Coin inputs absorb the tx fee so no extra CKB capacity cell is needed.
    // Cap at the current fee: we never ask Coins to cover more than what the tx owes.
    const capacityExcess =
      ccc.numMin(inCapacity - outCapacity, await tx.getFee(this.client)) -
      ccc.numFrom(capacityTweak ?? 0);

    if (amountExcess >= ccc.Zero && capacityExcess >= ccc.Zero) {
      return { addedCount: 0, tx };
    }

    const {
      tx: txRes,
      addedCount,
      accumulated,
    } = await this.completeInputs(
      signer,
      (acc, _cell, coinInfo) => {
        const info = acc.add(coinInfo);

        // Try to provide enough capacity with Coins to avoid extra occupation
        return info.amount >= ccc.Zero && info.capacity >= ccc.Zero
          ? undefined
          : info;
      },
      CoinInfo.from({ amount: amountExcess, capacity: capacityExcess }),
      tx,
    );

    if (accumulated === undefined || accumulated.amount >= ccc.Zero) {
      return { tx: txRes, addedCount };
    }

    throw new ErrorCoinInsufficient({
      amount: -accumulated.amount,
      type: await this.script,
    });
  }

  /**
   * Adds ALL available Coins from the signer as inputs. Useful for consolidation or full sweeps.
   */
  async completeInputsAll(
    signer: ccc.Signer,
    txLike?: ccc.TransactionLike | null,
  ): Promise<{
    addedCount: number;
    tx: ccc.Transaction;
  }> {
    const tx = ccc.Transaction.from(txLike ?? {});

    const { tx: txRes, addedCount } = await this.completeInputs(
      signer,
      (acc, _cell, coinInfo) => acc.addAssign(coinInfo),
      CoinInfo.default(),
      tx,
    );

    return { tx: txRes, addedCount };
  }

  /**
   * Low-level completion primitive. Adds Coin inputs, then calls `change(tx, amount)` to
   * write the change output.
   *
   * `complete` never manages CKB capacity on its own — it only opportunistically uses any
   * capacity gap between inputs and outputs to merge Coin cells (reducing the number of
   * Coin inputs added), on a best-effort basis. It does not guarantee `tx` has enough
   * capacity afterwards; follow up with `tx.completeBy` (or similar) to complete capacity.
   *
   * @param change - Callback that receives the transaction and the excess Coin amount, and
   *   should write the change output in place. Must be side-effect-free beyond modifying `tx`,
   *   as it may be invoked more than once (e.g. speculatively on a clone) before being applied
   *   to the final transaction.
   * @param options.shouldAddInputs - When `false`, skips input sourcing entirely; the caller
   *   is responsible for ensuring `tx` already has enough Coin inputs. Defaults to `true`.
   *
   * @example
   * ```typescript
   * const { tx: completedTx } = await coin.complete(signer, async (tx, amount) => {
   *   tx.addOutput(
   *     await coin.setAmount(
   *       {
   *         cellOutput: { lock: changeLock, type: await coin.script },
   *         outputData: "0x",
   *       },
   *       amount,
   *     ),
   *   );
   * }, tx);
   * ```
   */
  async complete(
    signer: ccc.Signer,
    change: (tx: ccc.Transaction, amount: ccc.Num) => Promise<void> | void,
    txLike?: ccc.TransactionLike | null,
    options?: { shouldAddInputs?: boolean | null },
  ): Promise<CoinCompleteResponse> {
    let tx = ccc.Transaction.from(txLike ?? {});
    tx.addCellDeps(await this.cellDeps);
    let addedInputs = 0;

    /* === Figure out the amount to change === */
    if (options?.shouldAddInputs ?? true) {
      const res = await this.completeInputsByAmount(signer, tx);
      tx = res.tx;
      addedInputs += res.addedCount;
    }

    const amountExcess =
      (await this.getAmountBurned(tx)) -
      (await this.getIntendedAmountBurned(tx));

    if (amountExcess < ccc.Zero) {
      throw new ErrorCoinInsufficient({
        amount: -amountExcess,
        type: await this.script,
      });
    } else if (amountExcess === ccc.Zero) {
      // No change needed — inputs and outputs are perfectly balanced
      return { tx, addedInputs, hasChanged: false, changeIndexes: [] };
    }
    /* === Some amount need to change === */

    if (!(options?.shouldAddInputs ?? true)) {
      // Caller manages inputs manually; apply change with current amount as-is
      await Promise.resolve(change(tx, amountExcess));
      return { tx, addedInputs, hasChanged: true, changeIndexes: [] };
    }

    // Clone the transaction and apply change to measure the extra output capacity
    // the change cell requires, then source inputs, and finally apply change to
    // the real transaction with the correct final amount.
    const cloned = tx.clone();
    const capacityBefore = tx.getOutputsCapacity();
    await Promise.resolve(change(cloned, amountExcess));
    const extraCapacity = cloned.getOutputsCapacity() - capacityBefore;

    const res2 = await this.completeInputsByAmount(
      signer,
      tx,
      ccc.Zero,
      extraCapacity,
    );
    tx = res2.tx;
    addedInputs += res2.addedCount;

    await Promise.resolve(
      change(
        tx,
        (await this.getAmountBurned(tx)) -
          (await this.getIntendedAmountBurned(tx)),
      ),
    );

    return { tx, addedInputs, hasChanged: true, changeIndexes: [] };
  }

  /**
   * Completes the transaction by writing the excess Coin amount into the existing output at
   * `index`. The output must already be a valid Coin cell with this type script.
   *
   * @throws {Error} If the output at `index` does not exist or is not a valid Coin.
   *
   * @example
   * ```typescript
   * // Change goes into output 1 of the transaction
   * const { tx: completedTx } = await coin.completeChangeToOutput(signer, 1, tx);
   * ```
   */
  async completeChangeToOutput(
    signer: ccc.Signer,
    indexLike: ccc.NumLike,
    txLike?: ccc.TransactionLike | null,
    options?: {
      shouldAddInputs?: boolean | null;
    },
  ) {
    const tx = ccc.Transaction.from(txLike ?? {});
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
      signer,
      async (tx, amount) => {
        const cell = await this.setAmount(
          {
            cellOutput: output.cellOutput.clone(),
            outputData: output.outputData,
          },
          await this.amountFrom(output, amount),
        );

        tx.outputs[index] = cell.cellOutput;
        tx.outputsData[index] = cell.outputData;
      },
      tx,
      options,
    );

    return { ...result, changeIndexes: result.hasChanged ? [index] : [] };
  }

  /**
   * Completes the transaction by creating a new change output locked to `changeLike`.
   *
   * @example
   * ```typescript
   * const { script: changeLock } = await signer.getRecommendedAddressObj();
   * const { tx: completedTx, changeIndexes } = await coin.completeChangeToLock(signer, changeLock, tx);
   * ```
   */
  async completeChangeToLock(
    signer: ccc.Signer,
    changeLike: ccc.ScriptLike,
    txLike?: ccc.TransactionLike | null,
    options?: {
      shouldAddInputs?: boolean | null;
    },
  ): Promise<CoinCompleteResponse> {
    const change = ccc.Script.from(changeLike);
    let changeIndex: number | undefined;

    const { tx, addedInputs, hasChanged } = await this.complete(
      signer,
      async (tx, amount) => {
        changeIndex =
          tx.addOutput(
            await this.setAmount(
              {
                cellOutput: { lock: change, type: await this.script },
              },
              amount,
            ),
          ) - 1;
      },
      txLike,
      options,
    );

    return {
      tx,
      addedInputs,
      hasChanged,
      changeIndexes:
        hasChanged && changeIndex !== undefined ? [changeIndex] : [],
    };
  }

  /**
   * Convenience wrapper around `completeChangeToLock` using the signer's recommended address.
   *
   * @example
   * ```typescript
   * const { tx: completedTx } = await coin.completeBy(signer, tx);
   * await completedTx.completeFeeBy(signer);
   * await signer.sendTransaction(completedTx);
   * ```
   *
   * @see {@link completeChangeToLock} for more control over the change destination.
   */
  async completeBy(
    signer: ccc.Signer,
    tx?: ccc.TransactionLike | null,
    options?: {
      shouldAddInputs?: boolean | null;
    },
  ) {
    const { script } = await signer.getRecommendedAddressObj();

    return this.completeChangeToLock(signer, script, tx, options);
  }

  /**
   * Make the transaction perform transfer actions to the specified recipients.
   *
   * @returns An object containing:
   *   - `tx`: The updated transaction with added transfer outputs and CoBuild actions.
   *   - `outputIndexes`: The indexes of the newly added Coin outputs in `tx.outputs`.
   *   - `witnessIndex`: The index of the witness where CoBuild actions were appended.
   *
   * @example
   * ```typescript
   * const { tx } = await coin.transfer([
   *   { to: recipientLock, amount: 100n },
   * ]);
   * const { tx: completedTx } = await coin.completeBy(signer, tx);
   * await completedTx.completeFeeBy(signer);
   * await signer.sendTransaction(completedTx);
   * ```
   */
  async transfer(
    transfers: {
      to: ccc.ScriptLike;
      amount: ccc.NumLike;
    }[],
    txLike?: ccc.TransactionLike | null,
  ): Promise<{
    tx: ccc.Transaction;
    outputIndexes: number[];
    witnessIndex: number;
  }> {
    const tx = ccc.Transaction.from(txLike ?? {});
    const outputIndexes = [];

    for (const { to, amount } of transfers) {
      outputIndexes.push(
        tx.addOutput(
          await this.setAmount(
            {
              cellOutput: { lock: to, type: await this.script },
            },
            amount,
          ),
        ) - 1,
      );
    }

    return {
      ...(await (
        await this.coBuild
      ).appendActions(
        tx,
        transfers.map((transfer) =>
          CoinAction.from({
            type: "Transfer",
            value: transfer,
          }),
        ),
      )),
      outputIndexes,
    };
  }

  /**
   * Make the transaction perform mint actions to the specified recipients.
   *
   * @returns An object containing:
   *   - `tx`: The updated transaction with added mint outputs and CoBuild actions.
   *   - `outputIndexes`: The indexes of the newly added Coin outputs in `tx.outputs`.
   *   - `witnessIndex`: The index of the witness where CoBuild actions were appended.
   *
   * @example
   * ```typescript
   * const { tx } = await coin.mint([
   *   { to: recipientLock, amount: 100n },
   * ]);
   * const { tx: completedTx } = await coin.completeBy(signer, tx);
   * await completedTx.completeFeeBy(signer);
   * await signer.sendTransaction(completedTx);
   * ```
   */
  async mint(
    mints: {
      to: ccc.ScriptLike;
      amount: ccc.NumLike;
    }[],
    txLike?: ccc.TransactionLike | null,
  ): Promise<{
    tx: ccc.Transaction;
    outputIndexes: number[];
    witnessIndex: number;
  }> {
    const tx = ccc.Transaction.from(txLike ?? {});
    const outputIndexes = [];

    for (const { to, amount } of mints) {
      outputIndexes.push(
        tx.addOutput(
          await this.setAmount(
            {
              cellOutput: { lock: to, type: await this.script },
            },
            amount,
          ),
        ) - 1,
      );
    }

    return {
      ...(await (
        await this.coBuild
      ).appendActions(
        tx,
        mints.map((mint) =>
          CoinAction.from({
            type: "Mint",
            value: mint,
          }),
        ),
      )),
      outputIndexes,
    };
  }

  /**
   * Make the transaction perform burn actions for the specified amount.
   *
   * @returns An object containing:
   *   - `tx`: The updated transaction with appended CoBuild actions.
   *   - `witnessIndex`: The index of the witness where CoBuild actions were appended.
   *
   * @example
   * ```typescript
   * const { tx } = await coin.burn(100n);
   * const { tx: completedTx } = await coin.completeBy(signer, tx);
   * await completedTx.completeFeeBy(signer);
   * await signer.sendTransaction(completedTx);
   * ```
   */
  async burn(
    amount: ccc.NumLike,
    txLike?: ccc.TransactionLike | null,
  ): Promise<{
    tx: ccc.Transaction;
    witnessIndex: number;
  }> {
    return (await this.coBuild).appendActions(
      txLike ?? {},
      CoinAction.from({
        type: "Burn",
        value: { amount },
      }),
    );
  }
}
