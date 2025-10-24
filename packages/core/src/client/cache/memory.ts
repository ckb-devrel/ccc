import { Cell, CellLike, OutPoint, OutPointLike } from "../../ckb/index.js";
import { hexFrom, HexLike } from "../../hex/index.js";
import { Num, numFrom, NumLike } from "../../num/index.js";
import { ClientCollectableSearchKeyLike } from "../clientTypes.advanced.js";
import {
  ClientBlock,
  ClientBlockHeader,
  ClientBlockHeaderLike,
  ClientBlockLike,
  ClientTransactionResponse,
  ClientTransactionResponseLike,
} from "../clientTypes.js";
import { ClientCache } from "./cache.js";
import {
  CellRecord,
  DEFAULT_CONFIRMED_BLOCK_TIME,
  filterCell,
  MapLru,
} from "./memory.advanced.js";

export class ClientCacheMemory extends ClientCache {
  /**
   * OutPoint => [isLive, Cell | OutPoint]
   */
  private readonly cells: MapLru<string, CellRecord>;

  /**
   * TX Hash => Transaction Response
   */
  private readonly knownTransactions: MapLru<string, ClientTransactionResponse>;

  /**
   * Block Number => Block Hash
   */
  private readonly knownBlockHashes: MapLru<Num, string>;

  /**
   * Block Hash => Block Header / Full Block
   */
  private readonly knownBlocks: MapLru<
    string,
    Pick<ClientBlock, "header"> | ClientBlock
  >;

  private readonly confirmedBlockTime;

  /**
   * @param maxCells - Maximum number of cells to store in the cache. Defaults to 512.
   * @param maxTxs - Maximum number of transactions to store in the cache. Defaults to 256.
   * @param maxBlocks - Maximum number of blocks to store in the cache. Defaults to 128.
   * @param confirmedBlockTimeLike - Time in milliseconds after which a block is considered confirmed.
   *                                 Defaults to DEFAULT_CONFIRMED_BLOCK_TIME (50 blocks * 10s).
   */
  constructor(
    private readonly maxCells = 512,
    private readonly maxTxs = 256,
    private readonly maxBlocks = 128,
    confirmedBlockTimeLike: NumLike = DEFAULT_CONFIRMED_BLOCK_TIME,
  ) {
    super();

    this.cells = new MapLru<string, CellRecord>(this.maxCells);
    this.knownTransactions = new MapLru<string, ClientTransactionResponse>(
      this.maxTxs,
    );
    this.knownBlockHashes = new MapLru<Num, string>(this.maxBlocks);
    this.knownBlocks = new MapLru<
      string,
      Pick<ClientBlock, "header"> | ClientBlock
    >(this.maxBlocks);

    this.confirmedBlockTime = numFrom(confirmedBlockTimeLike);
  }

  async markUsableNoCache(
    ...cellLikes: (CellLike | CellLike[])[]
  ): Promise<void> {
    cellLikes.flat().forEach((cellLike) => {
      const cell = Cell.from(cellLike).clone();
      const outPointStr = hexFrom(cell.outPoint.toBytes());

      this.cells.set(outPointStr, [true, cell]);
    });
  }

  async markUnusable(
    ...outPointLikes: (OutPointLike | OutPointLike[])[]
  ): Promise<void> {
    outPointLikes.flat().forEach((outPointLike) => {
      const outPoint = OutPoint.from(outPointLike);
      const outPointStr = hexFrom(outPoint.toBytes());

      const existed = this.cells.get(outPointStr);
      if (existed) {
        existed[0] = false;
        return;
      }
      this.cells.set(outPointStr, [false, { outPoint }]);
    });
  }

  async clear(): Promise<void> {
    this.cells.clear();
    this.knownTransactions.clear();
  }

  async *findCells(
    keyLike: ClientCollectableSearchKeyLike,
  ): AsyncGenerator<Cell> {
    for (const [key, [isLive, cell]] of this.cells.entries()) {
      if (!isLive) {
        continue;
      }
      if (!filterCell(keyLike, cell)) {
        continue;
      }

      this.cells.get(key);
      yield cell.clone();
    }
  }

  async isUnusable(outPointLike: OutPointLike): Promise<boolean> {
    const outPoint = OutPoint.from(outPointLike);

    return !(this.cells.get(hexFrom(outPoint.toBytes()))?.[0] ?? true);
  }

  async recordCells(...cells: (CellLike | CellLike[])[]): Promise<void> {
    cells.flat().map((cellLike) => {
      const cell = Cell.from(cellLike);
      const outPointStr = hexFrom(cell.outPoint.toBytes());

      if (this.cells.get(outPointStr)) {
        return;
      }
      this.cells.set(outPointStr, [undefined, cell]);
    });
  }
  async getCell(outPointLike: OutPointLike): Promise<Cell | undefined> {
    const outPoint = OutPoint.from(outPointLike);

    const cell = this.cells.get(hexFrom(outPoint.toBytes()))?.[1];
    if (cell && cell.cellOutput && cell.outputData) {
      return Cell.from((cell as Cell).clone());
    }
  }

  async recordTransactionResponses(
    ...transactions: (
      | ClientTransactionResponseLike
      | ClientTransactionResponseLike[]
    )[]
  ): Promise<void> {
    transactions.flat().map((txLike) => {
      const tx = ClientTransactionResponse.from(txLike);
      this.knownTransactions.set(tx.transaction.hash(), tx);
    });
  }
  async getTransactionResponse(
    txHashLike: HexLike,
  ): Promise<ClientTransactionResponse | undefined> {
    const txHash = hexFrom(txHashLike);
    return this.knownTransactions.get(txHash)?.clone();
  }

  async recordHeaders(
    ...headers: (ClientBlockHeaderLike | ClientBlockHeaderLike[])[]
  ): Promise<void> {
    headers.flat().map((headerLike) => {
      const header = ClientBlockHeader.from(headerLike);

      this.knownBlockHashes.set(header.number, header.hash);

      const existed = this.knownBlocks.get(header.hash);
      if (existed) {
        return;
      }
      this.knownBlocks.set(header.hash, { header });
    });
  }
  async getHeaderByHash(
    hashLike: HexLike,
  ): Promise<ClientBlockHeader | undefined> {
    const hash = hexFrom(hashLike);
    const block = this.knownBlocks.get(hash);
    if (block) {
      this.knownBlockHashes.get(block.header.number); // For LRU
    }
    return block?.header;
  }
  async getHeaderByNumber(
    numberLike: NumLike,
  ): Promise<ClientBlockHeader | undefined> {
    const number = numFrom(numberLike);

    const hash = this.knownBlockHashes.get(number);
    if (!hash) {
      return;
    }
    return this.getHeaderByHash(hash);
  }

  async recordBlocks(
    ...blocks: (ClientBlockLike | ClientBlockLike[])[]
  ): Promise<void> {
    blocks.flat().map((blockLike) => {
      const block = ClientBlock.from(blockLike);

      this.knownBlockHashes.set(block.header.number, block.header.hash);
      this.knownBlocks.set(block.header.hash, block);
    });
  }
  async getBlockByHash(hashLike: HexLike): Promise<ClientBlock | undefined> {
    const hash = hexFrom(hashLike);
    const block = this.knownBlocks.get(hash);
    if (block) {
      this.knownBlockHashes.get(block.header.number); // For LRU
      if ("transactions" in block) {
        return block;
      }
    }
    return;
  }
  async getBlockByNumber(
    numberLike: NumLike,
  ): Promise<ClientBlock | undefined> {
    const number = numFrom(numberLike);

    const hash = this.knownBlockHashes.get(number);
    if (!hash) {
      return;
    }
    return this.getBlockByHash(hash);
  }

  hasHeaderConfirmed(header: ClientBlockHeader): boolean {
    return numFrom(Date.now()) - header.timestamp >= this.confirmedBlockTime;
  }
}
