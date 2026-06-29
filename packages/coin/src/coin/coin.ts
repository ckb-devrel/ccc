import { coBuild } from "@ckb-ccc/co-build";
import { ccc } from "@ckb-ccc/core";
import { CoinAction } from "../coBuild.js";
import { CoinInfo, CoinInfoLike } from "./coinInfo.js";
import { ErrorCoinInsufficient } from "./error.js";

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

/** Post-processes a transaction after Coin outputs have been written. @public */
export type CoinTransformerOnOutput = (
  tx: ccc.Transaction,
  outputIndex: number,
) => ccc.TransactionLike | Promise<ccc.TransactionLike>;

/**
 * Common configurations shared by {@link Coin} implementations.
 * @public
 */
export type CoinOptionsCommon = {
  client: ccc.Client;
  filter?: ccc.ClientIndexerSearchKeyFilterLike | null;
  transformerOnOutput?: CoinTransformerOnOutput | null;
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
  /** Whether Coin inputs should also be used to cover missing CKB capacity. @internal */
  protected get shouldUseCoinsForCapacity(): boolean {
    return true;
  }

  /** Type script that identifies this Coin. @public */
  public readonly script: ccc.Script;

  /** Output transformer for Coin outputs. @public */
  public readonly transformerOnOutput?: CoinTransformerOnOutput | null;

  /** CoBuild instance for this Coin. @public */
  public readonly coBuild: coBuild.CoBuild;

  /** Client for network requests. @public */
  public readonly client: ccc.Client;

  /**
   * Indexer search filter used to find Coin cells.
   * Defaults to cells with this type script and `outputDataLenRange: [16, ∞)`.
   *
   * @public
   */
  public readonly filter: ccc.ClientIndexerSearchKeyFilter;

  /** Cell deps required by the type script, added to every built transaction. @public */
  public readonly cellDeps: ccc.CellDep[];

  /** @internal */
  protected constructor(
    options: Awaited<ReturnType<typeof Coin.resolveOptions>>,
  ) {
    this.script = options.script;
    this.transformerOnOutput = options.transformerOnOutput;
    this.coBuild = options.coBuild;
    this.client = options.client;
    this.filter = options.filter;
    this.cellDeps = options.cellDeps;
  }

  /**
   * @param options.knownScript - Optional known script standard (e.g., `ccc.KnownScript.SUdt`) to dynamically resolve `codeHash`, `hashType`, and `cellDeps`.
   *   Used only when `script.codeHash` or `script.hashType` is not provided.
   * @param options.script - Type script that identifies this Coin asset. A complete script with `codeHash` and `hashType`
   *   takes priority over `knownScript`; otherwise `knownScript` is used as shorthand and only `args` is required.
   * @param options.client - Client for network requests.
   * @param options.filter - Custom indexer filter. Defaults to the exact Coin type
   *   script and an output data length of at least 16 bytes.
   * @param options.cellDeps - Cell deps automatically added to every built transaction. If the known script shorthand is used, these custom cell deps are appended after the resolved default cell deps of the known script.
   * @param options.transformerOnOutput - Optional callback to post-process the whole transaction after each generated
   *   Coin output is written. It receives the output's index in the input transaction. Completion may invoke it more
   *   than once on different transaction instances while estimating capacity, so it must be deterministic and free
   *   of external side effects.
   *
   * @example
   * ```typescript
   * const coin = await Coin.new({
   *   script: { codeHash: "0x...", hashType: "type", args: "0x..." },
   *   client,
   *   cellDeps: [{ outPoint: codeOutPoint, depType: "code" }],
   * });
   * ```
   *
   * @example
   * ```typescript
   * const coin = await Coin.new({
   *   knownScript: ccc.KnownScript.SUdt,
   *   script: { args: ownerLock.hash() },
   *   client,
   *   transformerOnOutput: async (tx, outputIndex) => {
   *     tx.addOutput(companionCell);
   *     return tx;
   *   },
   * });
   * ```
   */
  static async new(options: CoinOptions): Promise<Coin> {
    return new Coin(await Coin.resolveOptions(options));
  }

  /** Resolves asynchronous construction dependencies. @internal */
  protected static async resolveOptions(options: CoinOptions) {
    const {
      knownScript,
      script,
      cellDeps,
      client,
      transformerOnOutput,
      scriptInfo,
    } = options;

    if (
      knownScript == null &&
      (script.codeHash == null || script.hashType == null)
    ) {
      throw new Error(
        "Either knownScript or script.codeHash and script.hashType must be provided for Coin",
      );
    }
    let resolvedScript: ccc.ScriptLike;
    let resolvedCellDeps: ccc.CellDepLike[];
    if (script.codeHash != null && script.hashType != null) {
      resolvedScript = {
        codeHash: script.codeHash,
        hashType: script.hashType,
        args: script.args,
      };
      resolvedCellDeps = cellDeps ?? [];
    } else {
      const knownScriptInfo = await client.getKnownScript(
        knownScript as ccc.KnownScript,
      );
      resolvedScript = {
        codeHash: knownScriptInfo.codeHash,
        hashType: knownScriptInfo.hashType,
        args: script.args,
      };
      resolvedCellDeps = (
        await client.getCellDeps(knownScriptInfo.cellDeps)
      ).concat(cellDeps?.map(ccc.CellDep.from) ?? []);
    }

    const normalizedScript = ccc.Script.from(resolvedScript);
    const normalizedCellDeps = resolvedCellDeps.map(ccc.CellDep.from);
    // The indexer's script length is code_hash + hash_type + args, without
    // Molecule's table/Bytes serialization overhead.
    const scriptLength = 33 + ccc.bytesFrom(normalizedScript.args).length;
    const normalizedFilter = ccc.ClientIndexerSearchKeyFilter.from(
      options.filter ?? {
        script: normalizedScript,
        scriptLenRange: [scriptLength, scriptLength + 1],
        outputDataLenRange: [16, "0xffffffff"],
      },
    );
    const normalizedCoBuild = new coBuild.CoBuild(normalizedScript, scriptInfo);

    return {
      script: normalizedScript,
      transformerOnOutput,
      coBuild: normalizedCoBuild,
      client,
      filter: normalizedFilter,
      cellDeps: normalizedCellDeps,
    };
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

  /** Applies the configured output transformer to a transaction output. @public */
  async transformOutput(
    tx: ccc.Transaction,
    outputIndex: number,
  ): Promise<ccc.Transaction> {
    if (!this.transformerOnOutput) {
      return tx;
    }

    return ccc.Transaction.from(
      await this.transformerOnOutput(tx, outputIndex),
    );
  }

  /**
   * Writes a Coin amount into a transaction output and applies the configured
   * transformer for that output.
   *
   * The amount is encoded as a 16-byte little-endian integer at
   * `outputData[0..16)`. Any bytes after the first 16 are preserved, which lets
   * callers keep extension data attached to token cells.
   *
   * @param tx - Transaction containing the output.
   * @param outputIndexLike - Index of the output to update.
   * @param amount - Coin amount to write into `outputData[0..16)`.
   * @returns The transformed transaction.
   * @throws If the output does not exist.
   * @public
   */
  async setAmount(
    tx: ccc.Transaction,
    outputIndexLike: ccc.NumLike,
    amount: ccc.NumLike,
  ): Promise<ccc.Transaction> {
    const outputIndex = Number(ccc.numFrom(outputIndexLike));
    const cell = tx.getOutput(outputIndex);
    if (!cell) {
      throw new Error(`Output at index ${outputIndex} does not exist`);
    }
    const normalizedAmount = ccc.numFrom(amount);

    cell.outputData = ccc.hexFrom(
      ccc.bytesConcat(
        ccc.numLeToBytes(normalizedAmount, 16),
        ccc.bytesFrom(cell.outputData).slice(16),
      ),
    );

    tx.setOutput(outputIndex, cell);
    return this.transformOutput(tx, outputIndex);
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
    const filter = this.filter;
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
      (cell.cellOutput.type?.eq(this.script) ?? false) &&
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

    return this.coBuild.findActions(tx, this.script).reduce((acc, action) => {
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
    tx.addCellDeps(this.cellDeps);

    const res = await tx.completeInputs(
      signer,
      this.filter,
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
   * Adds Coin inputs until the Coin amount gap is covered. When
   * `shouldUseCoinsForCapacity` is enabled, it also attempts to cover the CKB capacity gap
   * on a best-effort basis (capacity may still be negative if Coin inputs are exhausted
   * before it is satisfied).
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
    tx.addCellDeps(this.cellDeps);

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
    const capacityExcess = this.shouldUseCoinsForCapacity
      ? ccc.numMin(inCapacity - outCapacity, await tx.getFee(this.client)) -
        ccc.numFrom(capacityTweak ?? 0)
      : ccc.Zero;

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
      type: this.script,
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
   * @param change - Callback that receives the transaction and the excess Coin amount, writes
   *   the change output, and returns the resulting transaction. It must be side-effect-free
   *   beyond modifying `tx`, as it may be invoked more than once (e.g. speculatively on a clone)
   *   before being applied to the final transaction.
   * @param options.shouldAddInputs - When `false`, skips input sourcing entirely; the caller
   *   is responsible for ensuring `tx` already has enough Coin inputs. Defaults to `true`.
   *
   * @example
   * ```typescript
   * const completedTx = await coin.complete(signer, async (tx, amount) => {
   *   const outputIndex = tx.addOutput({
   *     cellOutput: { lock: changeLock, type: coin.script },
   *     outputData: "0x",
   *   }) - 1;
   *   return coin.setAmount(tx, outputIndex, amount);
   * }, tx);
   * ```
   */
  async complete(
    signer: ccc.Signer,
    change: (
      tx: ccc.Transaction,
      amount: ccc.Num,
    ) => ccc.TransactionLike | Promise<ccc.TransactionLike>,
    txLike?: ccc.TransactionLike | null,
    options?: { shouldAddInputs?: boolean | null },
  ): Promise<ccc.Transaction> {
    let tx = ccc.Transaction.from(txLike ?? {});
    tx.addCellDeps(this.cellDeps);

    /* === Figure out the amount to change === */
    if (options?.shouldAddInputs ?? true) {
      const res = await this.completeInputsByAmount(signer, tx);
      tx = res.tx;
    }

    const amountExcess =
      (await this.getAmountBurned(tx)) -
      (await this.getIntendedAmountBurned(tx));

    if (amountExcess < ccc.Zero) {
      throw new ErrorCoinInsufficient({
        amount: -amountExcess,
        type: this.script,
      });
    } else if (amountExcess === ccc.Zero) {
      // No change needed — inputs and outputs are perfectly balanced
      return tx;
    }
    /* === Some amount need to change === */

    if (!(options?.shouldAddInputs ?? true)) {
      // Caller manages inputs manually; apply change with current amount as-is
      return ccc.Transaction.from(await change(tx, amountExcess));
    }

    // Clone the transaction and apply change to measure the extra output capacity
    // the change cell requires, then source inputs, and finally apply change to
    // the real transaction with the correct final amount.
    let cloned = tx.clone();
    const capacityBefore = tx.getOutputsCapacity();
    cloned = ccc.Transaction.from(await change(cloned, amountExcess));
    const extraCapacity = cloned.getOutputsCapacity() - capacityBefore;

    const res2 = await this.completeInputsByAmount(
      signer,
      tx,
      ccc.Zero,
      extraCapacity,
    );
    tx = res2.tx;

    return ccc.Transaction.from(
      await change(
        tx,
        (await this.getAmountBurned(tx)) -
          (await this.getIntendedAmountBurned(tx)),
      ),
    );
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
   * const completedTx = await coin.completeChangeToOutput(signer, 1, tx);
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

    return this.complete(
      signer,
      async (tx, amount) => {
        tx.setOutput(index, output.clone());
        return this.setAmount(tx, index, await this.amountFrom(output, amount));
      },
      tx,
      options,
    );
  }

  /**
   * Completes the transaction by creating a new change output locked to `changeLike`.
   *
   * @example
   * ```typescript
   * const { script: changeLock } = await signer.getRecommendedAddressObj();
   * const completedTx = await coin.completeChangeToLock(signer, changeLock, tx);
   * ```
   */
  async completeChangeToLock(
    signer: ccc.Signer,
    changeLike: ccc.ScriptLike,
    txLike?: ccc.TransactionLike | null,
    options?: {
      shouldAddInputs?: boolean | null;
    },
  ): Promise<ccc.Transaction> {
    const change = ccc.Script.from(changeLike);

    return this.complete(
      signer,
      async (tx, amount) => {
        const outputIndex =
          tx.addOutput({ lock: change, type: this.script }) - 1;
        return this.setAmount(tx, outputIndex, amount);
      },
      txLike,
      options,
    );
  }

  /**
   * Convenience wrapper around `completeChangeToLock` using the signer's recommended address.
   *
   * @example
   * ```typescript
   * const completedTx = await coin.completeBy(signer, tx);
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
   * @returns The updated transaction with added transfer outputs and CoBuild actions.
   *
   * @example
   * ```typescript
   * const tx = await coin.transfer([
   *   { to: recipientLock, amount: 100n },
   * ]);
   * const completedTx = await coin.completeBy(signer, tx);
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
  ): Promise<ccc.Transaction> {
    let tx = ccc.Transaction.from(txLike ?? {});

    for (const { to, amount } of transfers) {
      const outputIndex = tx.addOutput({ lock: to, type: this.script }) - 1;
      tx = await this.setAmount(tx, outputIndex, amount);
    }

    const { tx: txWithActions } = await this.coBuild.appendActions(
      transfers.map((transfer) =>
        CoinAction.from({
          type: "Transfer",
          value: transfer,
        }),
      ),
      tx,
    );
    return txWithActions;
  }

  /**
   * Make the transaction perform mint actions to the specified recipients.
   *
   * @returns The updated transaction with added mint outputs and CoBuild actions.
   *
   * @example
   * ```typescript
   * const tx = await coin.mint([
   *   { to: recipientLock, amount: 100n },
   * ]);
   * const completedTx = await coin.completeBy(signer, tx);
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
  ): Promise<ccc.Transaction> {
    let tx = ccc.Transaction.from(txLike ?? {});

    for (const { to, amount } of mints) {
      const outputIndex = tx.addOutput({ lock: to, type: this.script }) - 1;
      tx = await this.setAmount(tx, outputIndex, amount);
    }

    const { tx: txWithActions } = await this.coBuild.appendActions(
      mints.map((mint) =>
        CoinAction.from({
          type: "Mint",
          value: mint,
        }),
      ),
      tx,
    );
    return txWithActions;
  }

  /**
   * Make the transaction perform burn actions for the specified amount.
   *
   * @returns The updated transaction with appended CoBuild actions.
   *
   * @example
   * ```typescript
   * const tx = await coin.burn(100n);
   * const completedTx = await coin.completeBy(signer, tx);
   * await completedTx.completeFeeBy(signer);
   * await signer.sendTransaction(completedTx);
   * ```
   */
  async burn(
    amount: ccc.NumLike,
    txLike?: ccc.TransactionLike | null,
  ): Promise<ccc.Transaction> {
    const { tx } = await this.coBuild.appendActions(
      CoinAction.from({
        type: "Burn",
        value: { amount },
      }),
      txLike,
    );
    return tx;
  }
}
