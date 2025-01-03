import {
  Cell,
  CellLike,
  OutPoint,
  OutPointLike,
  Transaction,
  TransactionLike,
} from "../../ckb/index.js";
import { hexFrom, HexLike } from "../../hex/index.js";
import { ClientCollectableSearchKeyLike } from "../clientTypes.advanced.js";
import { ClientCache } from "./cache.js";
import { CellRecord, filterCell, MapLru } from "./memory.advanced.js";

export class ClientCacheMemory extends ClientCache {
  /**
   * OutPoint => [isLive, Cell | OutPoint]
   */
  private readonly cells: MapLru<string, CellRecord>;

  /**
   * TX Hash => Transaction
   */
  private readonly knownTransactions: MapLru<string, Transaction>;

  constructor(
    private readonly maxCells = 512,
    private readonly maxTxs = 256,
  ) {
    super();

    this.cells = new MapLru<string, CellRecord>(this.maxCells);
    this.knownTransactions = new MapLru<string, Transaction>(this.maxTxs);
  }

  async markUsable(...cellLikes: (CellLike | CellLike[])[]): Promise<void> {
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

      this.cells.access(key);
      yield cell.clone();
    }
  }
  async getCell(outPointLike: OutPointLike): Promise<Cell | undefined> {
    const outPoint = OutPoint.from(outPointLike);

    const cell = this.cells.get(hexFrom(outPoint.toBytes()))?.[1];
    if (cell && cell.cellOutput && cell.outputData) {
      return Cell.from((cell as Cell).clone());
    }
  }

  async isUnusable(outPointLike: OutPointLike): Promise<boolean> {
    const outPoint = OutPoint.from(outPointLike);

    return !(this.cells.get(hexFrom(outPoint.toBytes()))?.[0] ?? true);
  }

  async recordTransactions(
    ...transactions: (TransactionLike | TransactionLike[])[]
  ): Promise<void> {
    transactions.flat().map((txLike) => {
      const tx = Transaction.from(txLike);
      this.knownTransactions.set(tx.hash(), tx);
    });
  }
  async getTransaction(txHashLike: HexLike): Promise<Transaction | undefined> {
    const txHash = hexFrom(txHashLike);
    return this.knownTransactions.get(txHash)?.clone();
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
}
