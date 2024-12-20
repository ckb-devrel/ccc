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
import { Num, NumLike, numFrom, numMax } from "../num/index.js";
import { reduceAsync, sleep } from "../utils/index.js";
import { ClientCache } from "./cache/index.js";
import { ClientCacheMemory } from "./cache/memory.js";
import { ClientCollectableSearchKeyLike } from "./clientTypes.advanced.js";
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
  ErrorClientWaitTransactionTimeout,
  KnownScript,
  OutputsValidator,
  ScriptInfo,
} from "./clientTypes.js";

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

  abstract getKnownScript(script: KnownScript): Promise<ScriptInfo>;

  abstract getFeeRateStatistics(
    blockRange?: NumLike,
  ): Promise<{ mean: Num; median: Num }>;
  async getFeeRate(blockRange?: NumLike): Promise<Num> {
    return numMax((await this.getFeeRateStatistics(blockRange)).median, 1000);
  }

  abstract getTip(): Promise<Num>;
  abstract getTipHeader(verbosity?: number | null): Promise<ClientBlockHeader>;
  abstract getBlockByNumber(
    blockNumber: NumLike,
    verbosity?: number | null,
    withCycles?: boolean | null,
  ): Promise<ClientBlock | undefined>;
  abstract getBlockByHash(
    blockHash: HexLike,
    verbosity?: number | null,
    withCycles?: boolean | null,
  ): Promise<ClientBlock | undefined>;
  abstract getHeaderByNumber(
    blockNumber: NumLike,
    verbosity?: number | null,
  ): Promise<ClientBlockHeader | undefined>;
  abstract getHeaderByHash(
    blockHash: HexLike,
    verbosity?: number | null,
  ): Promise<ClientBlockHeader | undefined>;

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

  async getCell(outPointLike: OutPointLike): Promise<Cell | undefined> {
    const outPoint = OutPoint.from(outPointLike);
    const cached = await this.cache.getCell(outPoint);

    if (cached) {
      return cached;
    }

    const transaction = await this.getTransactionNoCache(outPoint.txHash);
    if (!transaction) {
      return;
    }

    const index = Number(numFrom(outPoint.index));
    if (index >= transaction.transaction.outputs.length) {
      return;
    }

    const cell = Cell.from({
      outPoint,
      cellOutput: transaction.transaction.outputs[index],
      outputData: transaction.transaction.outputsData[index] ?? "0x",
    });
    await this.cache.recordCells(cell);
    return cell;
  }

  abstract getCellLiveNoCache(
    outPointLike: OutPointLike,
    withData?: boolean | null,
    includeTxPool?: boolean | null,
  ): Promise<Cell | undefined>;
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
   *
   * @param keyLike - The search key.
   * @returns A async generator for yielding cells.
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
    withData = false,
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

  async getBalance(locks: ScriptLike[]): Promise<Num> {
    return reduceAsync(
      locks,
      async (acc, lock) => acc + (await this.getBalanceSingle(lock)),
      Zero,
    );
  }

  async sendTransaction(
    transaction: TransactionLike,
    validator?: OutputsValidator,
  ): Promise<Hex> {
    const tx = Transaction.from(transaction);

    const txHash = await this.sendTransactionNoCache(tx, validator);

    await this.cache.recordTransactions(tx);
    await this.cache.markTransactions(tx);

    return txHash;
  }

  async getTransaction(
    txHashLike: HexLike,
  ): Promise<ClientTransactionResponse | undefined> {
    const txHash = hexFrom(txHashLike);
    const res = await this.getTransactionNoCache(txHash);
    if (res?.transaction) {
      return res;
    }

    const tx = await this.cache.getTransaction(txHash);
    if (!tx) {
      return;
    }

    if (!res) {
      return {
        transaction: tx,
        status: "sent",
      };
    }

    return {
      ...res,
      transaction: tx,
    };
  }

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
        throw new ErrorClientWaitTransactionTimeout();
      }
      await sleep(interval);
    }
  }
}
