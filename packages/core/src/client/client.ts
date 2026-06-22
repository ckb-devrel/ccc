import {
  Cell,
  CellDep,
  OutPoint,
  OutPointLike,
  ScriptLike,
  Transaction,
  TransactionLike,
} from "../ckb/index.js";
import { Zero } from "../fixedPoint/index.js";
import { Hex, HexLike, hexFrom } from "../hex/index.js";
import { Num, NumLike, numFrom, numMax, numMin } from "../num/index.js";
import { reduceAsync, sleep } from "../utils/index.js";
import { ClientCache } from "./cache/index.js";
import { ClientCacheMemory } from "./cache/memory.js";
import {
  ClientCollectableSearchKeyLike,
  DEFAULT_MAX_FEE_RATE,
  DEFAULT_MIN_FEE_RATE,
} from "./clientTypes.advanced.js";
import {
  CellDepInfo,
  CellDepInfoLike,
  ClientBlock,
  ClientBlockHeader,
  ClientFindCellsResponse,
  ClientFindTransactionsGroupedResponse,
  ClientFindTransactionsResponse,
  ClientIndexerSearchKey,
  ClientIndexerSearchKeyLike,
  ClientIndexerSearchKeyTransactionLike,
  ClientTransactionResponse,
  ErrorClientMaxFeeRateExceeded,
  ErrorClientWaitTransactionTimeout,
  OutputsValidator,
  ScriptInfo,
} from "./clientTypes.js";
import { KnownScript } from "./knownScript.js";

/**
 * @public
 */
export abstract class Client {
  public cache: ClientCache;

  constructor(config?: { cache?: ClientCache }) {
    this.cache = config?.cache ?? new ClientCacheMemory();
  }

  abstract get url(): string;
  abstract get addressPrefix(): string;

  /**
   * Get the deployment info for a well-known CKB script.
   * Returns the cell deps and type script info needed to use the script.
   *
   * @param script - The KnownScript enum value.
   * @returns Script info including cellDeps and type hash.
   *
   * @example
   * ```typescript
   * import { ccc } from "@ckb-ccc/core";
   *
   * const client = new ccc.ClientPublicTestnet();
   *
   * // Get xUDT script deployment info
   * const xudtInfo = await client.getKnownScript(ccc.KnownScript.XUdt);
   * console.log(`xUDT cellDeps:`, xudtInfo.cellDeps);
   *
   * // Build an xUDT type script
   * const xudtType = await ccc.Script.fromKnownScript(
   *   client,
   *   ccc.KnownScript.XUdt,
   *   "0xOWNER_LOCK_HASH...",
   * );
   * ```
   */
  abstract getKnownScript(script: KnownScript): Promise<ScriptInfo>;

  abstract getFeeRateStatistics(
    blockRange?: NumLike,
  ): Promise<{ mean?: Num; median?: Num }>;
  /**
   * Get the recommended transaction fee rate based on recent blocks.
   * Returns the median fee rate, clamped between min and max fee rates.
   *
   * @param blockRange - Number of recent blocks to analyze.
   * @param options - Optional max fee rate cap.
   * @returns The recommended fee rate in Shannons per KB.
   *
   * @example
   * ```typescript
   * import { ccc } from "@ckb-ccc/core";
   *
   * const client = new ccc.ClientPublicTestnet();
   * const feeRate = await client.getFeeRate();
   * console.log(`Current fee rate: ${feeRate} Shannons/KB`);
   * ```
   */
  async getFeeRate(
    blockRange?: NumLike,
    options?: { maxFeeRate?: NumLike },
  ): Promise<Num> {
    const feeRate = numMax(
      (await this.getFeeRateStatistics(blockRange)).median ?? Zero,
      DEFAULT_MIN_FEE_RATE,
    );

    const maxFeeRate = numFrom(options?.maxFeeRate ?? DEFAULT_MAX_FEE_RATE);
    if (maxFeeRate === Zero) {
      return feeRate;
    }

    return numMin(feeRate, maxFeeRate);
  }

  /**
   * Get the latest block number (tip) of the chain.
   *
   * @returns The current tip block number.
   *
   * @example
   * ```typescript
   * import { ccc } from "@ckb-ccc/core";
   *
   * const client = new ccc.ClientPublicTestnet();
   * const tipBlockNumber = await client.getTip();
   * console.log(`Current block height: ${tipBlockNumber}`);
   * ```
   */
  abstract getTip(): Promise<Num>;

  /**
   * Get the header of the latest block.
   *
   * @param verbosity - Verbosity level (0 for hex, 1 for object).
   * @returns The tip block header.
   *
   * @example
   * ```typescript
   * import { ccc } from "@ckb-ccc/core";
   *
   * const client = new ccc.ClientPublicTestnet();
   * const header = await client.getTipHeader();
   * console.log(`Block #${header.number}, hash: ${header.hash}`);
   * ```
   */
  abstract getTipHeader(verbosity?: number | null): Promise<ClientBlockHeader>;
  abstract getBlockByNumberNoCache(
    blockNumber: NumLike,
    verbosity?: number | null,
    withCycles?: boolean | null,
  ): Promise<ClientBlock | undefined>;
  abstract getBlockByHashNoCache(
    blockHash: HexLike,
    verbosity?: number | null,
    withCycles?: boolean | null,
  ): Promise<ClientBlock | undefined>;
  abstract getHeaderByNumberNoCache(
    blockNumber: NumLike,
    verbosity?: number | null,
  ): Promise<ClientBlockHeader | undefined>;
  abstract getHeaderByHashNoCache(
    blockHash: HexLike,
    verbosity?: number | null,
  ): Promise<ClientBlockHeader | undefined>;
  async getBlockByNumber(
    blockNumber: NumLike,
    verbosity?: number | null,
    withCycles?: boolean | null,
  ): Promise<ClientBlock | undefined> {
    const block = await this.cache.getBlockByNumber(blockNumber);
    if (block) {
      return block;
    }

    const res = await this.getBlockByNumberNoCache(
      blockNumber,
      verbosity,
      withCycles,
    );
    if (res && this.cache.hasHeaderConfirmed(res.header)) {
      await this.cache.recordBlocks(res);
    }
    return res;
  }
  async getBlockByHash(
    blockHash: HexLike,
    verbosity?: number | null,
    withCycles?: boolean | null,
  ): Promise<ClientBlock | undefined> {
    const block = await this.cache.getBlockByHash(blockHash);
    if (block) {
      return block;
    }

    const res = await this.getBlockByHashNoCache(
      blockHash,
      verbosity,
      withCycles,
    );
    if (res && this.cache.hasHeaderConfirmed(res.header)) {
      await this.cache.recordBlocks(res);
    }
    return res;
  }
  async getHeaderByNumber(
    blockNumber: NumLike,
    verbosity?: number | null,
  ): Promise<ClientBlockHeader | undefined> {
    const header = await this.cache.getHeaderByNumber(blockNumber);
    if (header) {
      return header;
    }

    const res = await this.getHeaderByNumberNoCache(blockNumber, verbosity);
    if (res && this.cache.hasHeaderConfirmed(res)) {
      await this.cache.recordHeaders(res);
    }
    return res;
  }
  async getHeaderByHash(
    blockHash: HexLike,
    verbosity?: number | null,
  ): Promise<ClientBlockHeader | undefined> {
    const header = await this.cache.getHeaderByHash(blockHash);
    if (header) {
      return header;
    }

    const res = await this.getHeaderByHashNoCache(blockHash, verbosity);
    if (res && this.cache.hasHeaderConfirmed(res)) {
      await this.cache.recordHeaders(res);
    }
    return res;
  }

  abstract estimateCycles(transaction: TransactionLike): Promise<Num>;
  abstract sendTransactionDry(
    transaction: TransactionLike,
    validator?: OutputsValidator,
  ): Promise<Num>;

  abstract sendTransactionNoCache(
    transaction: TransactionLike,
    validator?: OutputsValidator,
  ): Promise<Hex>;
  abstract getTransactionNoCache(
    txHash: HexLike,
  ): Promise<ClientTransactionResponse | undefined>;

  /**
   * Get a cell by its out point.
   * The cell will be cached if it is found.
   *
   * @param outPointLike - The out point of the cell to get.
   * @returns The cell if it exists, otherwise undefined.
   *
   * @example
   * ```typescript
   * import { ccc } from "@ckb-ccc/core";
   *
   * const client = new ccc.ClientPublicTestnet();
   * const cell = await client.getCell({
   *   txHash: "0xTX_HASH...",
   *   index: 0,
   * });
   * if (cell) {
   *   console.log(`Capacity: ${ccc.fixedPointToString(cell.cellOutput.capacity)} CKB`);
   *   console.log(`Lock: ${cell.cellOutput.lock.codeHash}`);
   *   console.log(`Data: ${cell.outputData}`);
   * }
   * ```
   */
  async getCell(outPointLike: OutPointLike): Promise<Cell | undefined> {
    const outPoint = OutPoint.from(outPointLike);
    const cached = await this.cache.getCell(outPoint);

    if (cached) {
      return cached;
    }

    const transaction = await this.getTransaction(outPoint.txHash);
    if (!transaction) {
      return;
    }
    const output = transaction.transaction.getOutput(outPoint.index);
    if (!output) {
      return;
    }

    const cell = Cell.from({
      ...output,
      outPoint,
    });
    await this.cache.recordCells(cell);
    return cell;
  }

  async getCellWithHeader(
    outPointLike: OutPointLike,
  ): Promise<{ cell: Cell; header?: ClientBlockHeader } | undefined> {
    const outPoint = OutPoint.from(outPointLike);

    const res = await this.getTransactionWithHeader(outPoint.txHash);
    if (!res) {
      return;
    }
    const { transaction, header } = res;

    const output = transaction.transaction.getOutput(outPoint.index);
    if (!output) {
      return;
    }

    const cell = Cell.from({
      ...output,
      outPoint,
    });
    await this.cache.recordCells(cell);
    return { cell, header };
  }

  abstract getCellLiveNoCache(
    outPointLike: OutPointLike,
    withData?: boolean | null,
    includeTxPool?: boolean | null,
  ): Promise<Cell | undefined>;
  /**
   * Get a live (unspent) cell by its out point.
   * Unlike getCell(), this verifies the cell is still live on-chain.
   *
   * @param outPointLike - The out point of the cell.
   * @param withData - Whether to include cell data.
   * @param includeTxPool - Whether to include cells in the transaction pool.
   * @returns The live cell, or undefined if spent or not found.
   *
   * @example
   * ```typescript
   * import { ccc } from "@ckb-ccc/core";
   *
   * const client = new ccc.ClientPublicTestnet();
   * const cell = await client.getCellLive(
   *   { txHash: "0xTX_HASH...", index: 0 },
   *   true,  // include data
   *   true,  // include tx pool
   * );
   * if (cell) {
   *   console.log("Cell is still live!");
   * } else {
   *   console.log("Cell has been spent or does not exist.");
   * }
   * ```
   */
  async getCellLive(
    outPointLike: OutPointLike,
    withData?: boolean | null,
    includeTxPool?: boolean | null,
  ): Promise<Cell | undefined> {
    const cell = await this.getCellLiveNoCache(
      outPointLike,
      withData,
      includeTxPool,
    );
    if (withData && cell) {
      await this.cache.recordCells(cell);
    }
    return cell;
  }

  abstract findCellsPagedNoCache(
    key: ClientIndexerSearchKeyLike,
    order?: "asc" | "desc",
    limit?: NumLike,
    after?: string,
  ): Promise<ClientFindCellsResponse>;
  /**
   * Find cells with pagination support.
   * Returns one page of results at a time with a cursor for the next page.
   *
   * @param key - The indexer search key.
   * @param order - Sort order ("asc" or "desc").
   * @param limit - Maximum cells per page.
   * @param after - Cursor from previous page for pagination.
   * @returns A page of cells with a cursor for the next page.
   *
   * @example
   * ```typescript
   * import { ccc } from "@ckb-ccc/core";
   *
   * const client = new ccc.ClientPublicTestnet();
   * const { script: lock } = await ccc.Address.fromString("ckt1q...", client);
   *
   * // Get first page of cells
   * const page1 = await client.findCellsPaged({
   *   script: lock,
   *   scriptType: "lock",
   * }, "asc", 20);
   * console.log(`Found ${page1.cells.length} cells`);
   *
   * // Get next page
   * if (page1.cells.length === 20) {
   *   const page2 = await client.findCellsPaged(
   *     { script: lock, scriptType: "lock" },
   *     "asc", 20, page1.lastCursor,
   *   );
   * }
   * ```
   */
  async findCellsPaged(
    key: ClientIndexerSearchKeyLike,
    order?: "asc" | "desc",
    limit?: NumLike,
    after?: string,
  ): Promise<ClientFindCellsResponse> {
    const res = await this.findCellsPagedNoCache(key, order, limit, after);
    await this.cache.recordCells(res.cells);
    return res;
  }

  async *findCellsOnChain(
    key: ClientIndexerSearchKeyLike,
    order?: "asc" | "desc",
    limit = 10,
  ): AsyncGenerator<Cell> {
    let last: string | undefined = undefined;

    while (true) {
      const { cells, lastCursor } = await this.findCellsPaged(
        key,
        order,
        limit,
        last,
      );
      for (const cell of cells) {
        yield cell;
      }
      if (cells.length === 0 || cells.length < limit) {
        return;
      }
      last = lastCursor;
    }
  }

  /**
   * Find cells by search key designed for collectable cells.
   * The result also includes cached cells, the order param only works for cells fetched from RPC.
   *
   * @param keyLike - The search key.
   * @returns A async generator for yielding cells.
   *
   * @example
   * ```typescript
   * import { ccc } from "@ckb-ccc/core";
   *
   * const client = new ccc.ClientPublicTestnet();
   * const { script: lock } = await ccc.Address.fromString("ckt1q...", client);
   *
   * // Find all cells owned by a lock script
   * for await (const cell of client.findCells({
   *   script: lock,
   *   scriptType: "lock",
   *   scriptSearchMode: "exact",
   *   withData: true,
   * })) {
   *   console.log(`Cell: ${cell.outPoint.txHash}:${cell.outPoint.index}`);
   *   console.log(`Capacity: ${ccc.fixedPointToString(cell.cellOutput.capacity)} CKB`);
   * }
   * ```
   */
  async *findCells(
    keyLike: ClientCollectableSearchKeyLike,
    order?: "asc" | "desc",
    limit = 10,
  ): AsyncGenerator<Cell> {
    const key = ClientIndexerSearchKey.from(keyLike);
    const foundedOutPoints = [];

    for await (const cell of this.cache.findCells(key)) {
      foundedOutPoints.push(cell.outPoint);
      yield cell;
    }

    for await (const cell of this.findCellsOnChain(key, order, limit)) {
      if (
        (await this.cache.isUnusable(cell.outPoint)) ||
        foundedOutPoints.some((founded) => founded.eq(cell.outPoint))
      ) {
        continue;
      }

      yield cell;
    }
  }

  /**
   * Find cells by lock script, optionally filtered by type script.
   *
   * @param lock - The lock script to search by.
   * @param type - Optional type script filter.
   * @param withData - Whether to include cell data (default: true).
   * @param order - Sort order by block number ("asc" or "desc").
   * @param limit - Page size for each RPC call (default: 10).
   * @returns An async generator yielding matching cells.
   *
   * @example
   * ```typescript
   * import { ccc } from "@ckb-ccc/core";
   *
   * const client = new ccc.ClientPublicTestnet();
   * const { script: lock } = await ccc.Address.fromString("ckt1q...", client);
   *
   * // Find all cells belonging to this address
   * for await (const cell of client.findCellsByLock(lock)) {
   *   console.log(`${ccc.fixedPointToString(cell.cellOutput.capacity)} CKB`);
   * }
   *
   * // Find only xUDT cells belonging to this address
   * const xudtType = await ccc.Script.fromKnownScript(
   *   client, ccc.KnownScript.XUdt, "0xOWNER_LOCK_HASH...",
   * );
   * for await (const cell of client.findCellsByLock(lock, xudtType)) {
   *   console.log(`UDT cell found`);
   * }
   * ```
   */
  findCellsByLock(
    lock: ScriptLike,
    type?: ScriptLike | null,
    withData = true,
    order?: "asc" | "desc",
    limit = 10,
  ): AsyncGenerator<Cell> {
    return this.findCells(
      {
        script: lock,
        scriptType: "lock",
        scriptSearchMode: "exact",
        filter: {
          script: type,
        },
        withData,
      },
      order,
      limit,
    );
  }

  /**
   * Find cells by type script.
   *
   * @param type - The type script to search by.
   * @param withData - Whether to include cell data (default: true).
   * @param order - Sort order by block number.
   * @param limit - Page size for each RPC call (default: 10).
   * @returns An async generator yielding matching cells.
   *
   * @example
   * ```typescript
   * import { ccc } from "@ckb-ccc/core";
   *
   * const client = new ccc.ClientPublicTestnet();
   * // Find all xUDT cells of a specific token
   * const xudtType = await ccc.Script.fromKnownScript(
   *   client, ccc.KnownScript.XUdt, "0xOWNER_LOCK_HASH...",
   * );
   * for await (const cell of client.findCellsByType(xudtType)) {
   *   console.log(`Token cell: ${cell.outPoint.txHash}:${cell.outPoint.index}`);
   * }
   * ```
   */
  findCellsByType(
    type: ScriptLike,
    withData = true,
    order?: "asc" | "desc",
    limit = 10,
  ): AsyncGenerator<Cell> {
    return this.findCells(
      {
        script: type,
        scriptType: "type",
        scriptSearchMode: "exact",
        withData,
      },
      order,
      limit,
    );
  }

  async findSingletonCellByType(
    type: ScriptLike,
    withData = true,
  ): Promise<Cell | undefined> {
    for await (const cell of this.findCellsByType(
      type,
      withData,
      undefined,
      1,
    )) {
      return cell;
    }
  }

  /**
   * Resolve cell dependency info into concrete CellDep objects.
   * If a CellDepInfo specifies a type script, the actual deployed cell is located on-chain.
   *
   * @param cellDepsInfoLike - One or more CellDepInfo or arrays of CellDepInfo.
   * @returns Resolved CellDep array ready to be added to a transaction.
   *
   * @example
   * ```typescript
   * import { ccc } from "@ckb-ccc/core";
   *
   * const client = new ccc.ClientPublicTestnet();
   * const xudtInfo = await client.getKnownScript(ccc.KnownScript.XUdt);
   * const cellDeps = await client.getCellDeps(xudtInfo.cellDeps);
   * // cellDeps can be added to a transaction:
   * // tx.cellDeps.push(...cellDeps);
   * ```
   */
  async getCellDeps(
    ...cellDepsInfoLike: (CellDepInfoLike | CellDepInfoLike[])[]
  ): Promise<CellDep[]> {
    return Promise.all(
      cellDepsInfoLike.flat().map(async (infoLike) => {
        const { cellDep, type } = CellDepInfo.from(infoLike);
        if (type === undefined) {
          return cellDep;
        }
        const found = await this.findSingletonCellByType(type);
        if (!found) {
          return cellDep;
        }

        return CellDep.from({
          outPoint: found.outPoint,
          depType: cellDep.depType,
        });
      }),
    );
  }

  abstract findTransactionsPaged(
    key: Omit<ClientIndexerSearchKeyTransactionLike, "groupByTransaction"> & {
      groupByTransaction: true;
    },
    order?: "asc" | "desc",
    limit?: NumLike,
    after?: string,
  ): Promise<ClientFindTransactionsGroupedResponse>;
  abstract findTransactionsPaged(
    key: Omit<ClientIndexerSearchKeyTransactionLike, "groupByTransaction"> & {
      groupByTransaction?: false | null;
    },
    order?: "asc" | "desc",
    limit?: NumLike,
    after?: string,
  ): Promise<ClientFindTransactionsResponse>;
  abstract findTransactionsPaged(
    key: ClientIndexerSearchKeyTransactionLike,
    order?: "asc" | "desc",
    limit?: NumLike,
    after?: string,
  ): Promise<
    ClientFindTransactionsResponse | ClientFindTransactionsGroupedResponse
  >;

  findTransactions(
    key: Omit<ClientIndexerSearchKeyTransactionLike, "groupByTransaction"> & {
      groupByTransaction: true;
    },
    order?: "asc" | "desc",
    limit?: number,
  ): AsyncGenerator<ClientFindTransactionsGroupedResponse["transactions"][0]>;
  findTransactions(
    key: Omit<ClientIndexerSearchKeyTransactionLike, "groupByTransaction"> & {
      groupByTransaction?: false | null;
    },
    order?: "asc" | "desc",
    limit?: number,
  ): AsyncGenerator<ClientFindTransactionsResponse["transactions"][0]>;
  findTransactions(
    key: ClientIndexerSearchKeyTransactionLike,
    order?: "asc" | "desc",
    limit?: number,
  ): AsyncGenerator<
    | ClientFindTransactionsResponse["transactions"][0]
    | ClientFindTransactionsGroupedResponse["transactions"][0]
  >;
  async *findTransactions(
    key: ClientIndexerSearchKeyTransactionLike,
    order?: "asc" | "desc",
    limit = 10,
  ): AsyncGenerator<
    | ClientFindTransactionsResponse["transactions"][0]
    | ClientFindTransactionsGroupedResponse["transactions"][0]
  > {
    let last: string | undefined = undefined;

    while (true) {
      const {
        transactions,
        lastCursor,
      }:
        | ClientFindTransactionsResponse
        | ClientFindTransactionsGroupedResponse =
        await this.findTransactionsPaged(key, order, limit, last);
      for (const tx of transactions) {
        yield tx;
      }
      if (transactions.length === 0 || transactions.length < limit) {
        return;
      }
      last = lastCursor;
    }
  }

  /**
   * Find transactions related to a lock script, optionally filtered by type script.
   *
   * @param lock - The lock script to search by.
   * @param type - Optional type script filter.
   * @param groupByTransaction - If true, group results by transaction.
   * @param order - Sort order by block number.
   * @param limit - Page size per RPC call.
   * @returns An async generator yielding transaction records.
   *
   * @example
   * ```typescript
   * import { ccc } from "@ckb-ccc/core";
   *
   * const client = new ccc.ClientPublicTestnet();
   * const { script: lock } = await ccc.Address.fromString("ckt1q...", client);
   *
   * // List all transactions related to an address (grouped)
   * for await (const txRecord of client.findTransactionsByLock(lock, null, true)) {
   *   console.log(`TX: ${txRecord.txHash}, Block: ${txRecord.blockNumber}`);
   * }
   * ```
   */
  findTransactionsByLock(
    lock: ScriptLike,
    type: ScriptLike | undefined | null,
    groupByTransaction: true,
    order?: "asc" | "desc",
    limit?: number,
  ): AsyncGenerator<ClientFindTransactionsGroupedResponse["transactions"][0]>;
  findTransactionsByLock(
    lock: ScriptLike,
    type?: ScriptLike | null,
    groupByTransaction?: false | null,
    order?: "asc" | "desc",
    limit?: number,
  ): AsyncGenerator<ClientFindTransactionsResponse["transactions"][0]>;
  findTransactionsByLock(
    lock: ScriptLike,
    type?: ScriptLike | null,
    groupByTransaction?: boolean | null,
    order?: "asc" | "desc",
    limit?: number,
  ): AsyncGenerator<
    | ClientFindTransactionsResponse["transactions"][0]
    | ClientFindTransactionsGroupedResponse["transactions"][0]
  >;
  findTransactionsByLock(
    lock: ScriptLike,
    type?: ScriptLike | null,
    groupByTransaction?: boolean | null,
    order?: "asc" | "desc",
    limit = 10,
  ): AsyncGenerator<
    | ClientFindTransactionsResponse["transactions"][0]
    | ClientFindTransactionsGroupedResponse["transactions"][0]
  > {
    return this.findTransactions(
      {
        script: lock,
        scriptType: "lock",
        scriptSearchMode: "exact",
        filter: {
          script: type,
        },
        groupByTransaction,
      },
      order,
      limit,
    );
  }

  findTransactionsByType(
    type: ScriptLike,
    groupByTransaction: true,
    order?: "asc" | "desc",
    limit?: number,
  ): AsyncGenerator<ClientFindTransactionsGroupedResponse["transactions"][0]>;
  findTransactionsByType(
    type: ScriptLike,
    groupByTransaction?: false | null,
    order?: "asc" | "desc",
    limit?: number,
  ): AsyncGenerator<ClientFindTransactionsResponse["transactions"][0]>;
  findTransactionsByType(
    type: ScriptLike,
    groupByTransaction?: boolean | null,
    order?: "asc" | "desc",
    limit?: number,
  ): AsyncGenerator<
    | ClientFindTransactionsResponse["transactions"][0]
    | ClientFindTransactionsGroupedResponse["transactions"][0]
  >;
  findTransactionsByType(
    type: ScriptLike,
    groupByTransaction?: boolean | null,
    order?: "asc" | "desc",
    limit = 10,
  ): AsyncGenerator<
    | ClientFindTransactionsResponse["transactions"][0]
    | ClientFindTransactionsGroupedResponse["transactions"][0]
  > {
    return this.findTransactions(
      {
        script: type,
        scriptType: "type",
        scriptSearchMode: "exact",
        groupByTransaction,
      },
      order,
      limit,
    );
  }

  abstract getCellsCapacity(key: ClientIndexerSearchKeyLike): Promise<Num>;

  /**
   * Get the total CKB balance of a single lock script.
   * Only counts cells with no type script and no data (pure CKB capacity cells).
   *
   * @param lock - The lock script to query balance for.
   * @returns The total capacity in Shannons as a bigint.
   *
   * @example
   * ```typescript
   * import { ccc } from "@ckb-ccc/core";
   *
   * const client = new ccc.ClientPublicTestnet();
   * const { script: lock } = await ccc.Address.fromString(
   *   "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq...",
   *   client,
   * );
   * const balance = await client.getBalanceSingle(lock);
   * console.log(`Balance: ${ccc.fixedPointToString(balance)} CKB`);
   * ```
   */
  async getBalanceSingle(lock: ScriptLike): Promise<Num> {
    return this.getCellsCapacity({
      script: lock,
      scriptType: "lock",
      scriptSearchMode: "exact",
      filter: {
        scriptLenRange: [0, 1],
        outputDataLenRange: [0, 1],
      },
    });
  }

  /**
   * Get the total CKB balance across multiple lock scripts.
   * Sums the balance from each lock script.
   *
   * @param locks - An array of lock scripts to query.
   * @returns The combined total capacity in Shannons as a bigint.
   *
   * @example
   * ```typescript
   * import { ccc } from "@ckb-ccc/core";
   *
   * const client = new ccc.ClientPublicTestnet();
   * const signer = new ccc.SignerCkbPrivateKey(client, "0x...");
   * await signer.connect();
   *
   * const locks = await signer.getRecommendedAddressObj()
   *   .then(({ script }) => [script]);
   * const totalBalance = await client.getBalance(locks);
   * console.log(`Total: ${ccc.fixedPointToString(totalBalance)} CKB`);
   * ```
   */
  async getBalance(locks: ScriptLike[]): Promise<Num> {
    return reduceAsync(
      locks,
      async (acc, lock) => acc + (await this.getBalanceSingle(lock)),
      Zero,
    );
  }

  /**
   * Send a signed transaction to the CKB network.
   * Validates the fee rate against the maximum before sending.
   *
   * @param transaction - The transaction to send.
   * @param validator - Optional outputs validator ("passthrough" or "well_known_scripts_only").
   * @param options - Optional configuration including maxFeeRate.
   * @returns The transaction hash.
   *
   * @example
   * ```typescript
   * import { ccc } from "@ckb-ccc/core";
   *
   * const client = new ccc.ClientPublicTestnet();
   * const signer = new ccc.SignerCkbPrivateKey(client, "0x...");
   * await signer.connect();
   *
   * const tx = ccc.Transaction.from({
   *   outputs: [{ capacity: ccc.fixedPointFrom(100), lock: receiverLock }],
   * });
   * await tx.completeInputsByCapacity(signer);
   * await tx.completeFeeBy(signer);
   *
   * // Usually you call signer.sendTransaction(tx) which signs then sends.
   * // client.sendTransaction expects an already-signed transaction.
   * const txHash = await client.sendTransaction(tx);
   * ```
   */
  async sendTransaction(
    transaction: TransactionLike,
    validator?: OutputsValidator,
    options?: { maxFeeRate?: NumLike },
  ): Promise<Hex> {
    const tx = Transaction.from(transaction);

    const maxFeeRate = numFrom(options?.maxFeeRate ?? DEFAULT_MAX_FEE_RATE);
    const feeRate = await tx.getFeeRate(this);
    if (maxFeeRate > Zero && feeRate > maxFeeRate) {
      throw new ErrorClientMaxFeeRateExceeded(maxFeeRate, feeRate);
    }

    const txHash = await this.sendTransactionNoCache(tx, validator);

    await this.cache.markTransactions(tx);
    return txHash;
  }

  /**
   * Get a transaction by its hash, including its status and block info.
   *
   * @param txHashLike - The transaction hash to look up.
   * @returns The transaction response with status, or undefined if not found.
   *
   * @example
   * ```typescript
   * import { ccc } from "@ckb-ccc/core";
   *
   * const client = new ccc.ClientPublicTestnet();
   * const txResponse = await client.getTransaction("0xTX_HASH...");
   * if (txResponse) {
   *   console.log(`Status: ${txResponse.status}`);
   *   console.log(`Block: ${txResponse.blockNumber}`);
   *   console.log(`Outputs: ${txResponse.transaction.outputs.length}`);
   * }
   * ```
   */
  async getTransaction(
    txHashLike: HexLike,
  ): Promise<ClientTransactionResponse | undefined> {
    const txHash = hexFrom(txHashLike);
    const res = await this.getTransactionNoCache(txHash);
    if (res) {
      await this.cache.recordTransactionResponses(res);
      return res;
    }

    return this.cache.getTransactionResponse(txHash);
  }

  /**
   * This method gets specified transaction with its block header (if existed).
   * This is mainly for caching because we need the header to test if we can safely trust the cached tx status.
   * @param txHashLike
   */
  async getTransactionWithHeader(
    txHashLike: HexLike,
  ): Promise<
    | { transaction: ClientTransactionResponse; header?: ClientBlockHeader }
    | undefined
  > {
    const txHash = hexFrom(txHashLike);
    const tx = await this.cache.getTransactionResponse(txHash);
    if (tx?.blockHash) {
      const header = await this.getHeaderByHash(tx.blockHash);
      if (header && this.cache.hasHeaderConfirmed(header)) {
        return {
          transaction: tx,
          header,
        };
      }
    }

    const res = await this.getTransactionNoCache(txHash);
    if (!res) {
      return;
    }

    await this.cache.recordTransactionResponses(res);
    return {
      transaction: res,
      header: res.blockHash
        ? await this.getHeaderByHash(res.blockHash)
        : undefined,
    };
  }

  /**
   * Wait for a transaction to be confirmed on-chain.
   * Polls the node until the transaction reaches the specified confirmation depth.
   *
   * @param txHash - The transaction hash to wait for.
   * @param confirmations - Number of block confirmations to wait for (default: 0 = committed).
   * @param timeout - Maximum wait time in milliseconds (default: 60000).
   * @param interval - Polling interval in milliseconds (default: 2000).
   * @returns The transaction response once confirmed, or throws on timeout.
   *
   * @example
   * ```typescript
   * import { ccc } from "@ckb-ccc/core";
   *
   * const client = new ccc.ClientPublicTestnet();
   * // Wait for transaction to be committed (0 confirmations)
   * const tx = await client.waitTransaction("0xTX_HASH...");
   * console.log(`Confirmed in block: ${tx?.blockNumber}`);
   *
   * // Wait for 4 confirmations with 2 minute timeout
   * const confirmedTx = await client.waitTransaction(
   *   "0xTX_HASH...",
   *   4,       // confirmations
   *   120000,  // timeout: 2 minutes
   * );
   * ```
   */
  async waitTransaction(
    txHash: HexLike,
    confirmations: number = 0,
    timeout: number = 60000,
    interval: number = 2000,
  ): Promise<ClientTransactionResponse | undefined> {
    const startTime = Date.now();
    let tx: ClientTransactionResponse | undefined;

    const getTx = async () => {
      const res = await this.getTransaction(txHash);
      if (
        !res ||
        res.blockNumber == null ||
        ["sent", "pending", "proposed"].includes(res.status)
      ) {
        return undefined;
      }

      tx = res;
      return res;
    };

    while (true) {
      if (!tx) {
        if (await getTx()) {
          continue;
        }
      } else if (confirmations === 0) {
        return tx;
      } else if (
        (await this.getTipHeader()).number - tx.blockNumber! >=
        confirmations
      ) {
        return tx;
      }

      if (Date.now() - startTime + interval >= timeout) {
        throw new ErrorClientWaitTransactionTimeout(timeout);
      }
      await sleep(interval);
    }
  }
}
