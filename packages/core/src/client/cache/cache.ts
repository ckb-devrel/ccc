import {
  Cell,
  CellLike,
  OutPointLike,
  Transaction,
  TransactionLike,
} from "../../ckb/index.js";
import { HexLike } from "../../hex/index.js";
import { numFrom, NumLike } from "../../num/index.js";
import { ClientCollectableSearchKeyLike } from "../clientTypes.advanced.js";
import {
  ClientBlock,
  ClientBlockHeader,
  ClientBlockHeaderLike,
  ClientBlockLike,
  ClientTransactionResponse,
  ClientTransactionResponseLike,
} from "../clientTypes.js";
import { DEFAULT_CONFIRMED_BLOCK_TIME } from "./memory.advanced.js";

/**
 * @public
 * The ClientCache class is mainly designed for chained transactions.
 * Consumed & Created cells are "marked" so they can be correctly handled when composing transactions.
 * It also act as cache for rpc requests to reduce cost, but this is optional.
 */
export abstract class ClientCache {
  abstract markUsableNoCache(
    ...cellLikes: (CellLike | CellLike[])[]
  ): Promise<void>;
  async markUsable(...cellLikes: (CellLike | CellLike[])[]): Promise<void> {
    await this.recordCells(...cellLikes);
    return this.markUsableNoCache(...cellLikes);
  }
  abstract markUnusable(
    ...outPointLike: (OutPointLike | OutPointLike[])[]
  ): Promise<void>;
  async markTransactions(
    ...transactionLike: (TransactionLike | TransactionLike[])[]
  ): Promise<void> {
    await Promise.all([
      this.recordTransactionResponses(
        transactionLike.flat().map((transaction) => ({
          transaction: transaction,
          status: "sent",
        })),
      ),
      ...transactionLike.flat().map((transactionLike) => {
        const tx = Transaction.from(transactionLike);
        const txHash = tx.hash();

        return Promise.all([
          ...tx.inputs.map((i) => this.markUnusable(i.previousOutput)),
          ...tx.outputs.map((o, i) =>
            this.markUsable({
              cellOutput: o,
              outputData: tx.outputsData[i],
              outPoint: {
                txHash,
                index: i,
              },
            }),
          ),
        ]);
      }),
    ]);
  }
  abstract clear(): Promise<void>;
  abstract findCells(
    filter: ClientCollectableSearchKeyLike,
  ): AsyncGenerator<Cell>;
  abstract isUnusable(outPointLike: OutPointLike): Promise<boolean>;

  // ======
  // Following methods are for requests caching and optional.
  // ======

  /**
   * Record known cells
   * Implement this method to enable cells query caching
   * @param _cells
   */
  async recordCells(..._cells: (CellLike | CellLike[])[]): Promise<void> {}
  /**
   * Get a known cell by out point
   * Implement this method to enable cells query caching
   * @param _outPoint
   */
  async getCell(_outPoint: OutPointLike): Promise<Cell | undefined> {
    return;
  }

  /**
   * Record known transaction responses.
   * Implement this method to enable transactions query caching
   * @param _transactions
   */
  async recordTransactionResponses(
    ..._transactions: (
      | ClientTransactionResponseLike
      | ClientTransactionResponseLike[]
    )[]
  ): Promise<void> {}
  /**
   * Get a known transaction response by hash
   * Implement this method to enable transactions query caching
   * @param _txHash
   */
  async getTransactionResponse(
    _txHash: HexLike,
  ): Promise<ClientTransactionResponse | undefined> {
    return;
  }
  /**
   * Record known transactions.
   * @param transactions
   */
  async recordTransactions(
    ...transactions: (TransactionLike | TransactionLike[])[]
  ): Promise<void> {
    return this.recordTransactionResponses(
      transactions.flat().map((transaction) => ({
        transaction,
        status: "unknown",
      })),
    );
  }
  /**
   * Get a known transaction by hash
   * @param txHash
   */
  async getTransaction(txHash: HexLike): Promise<Transaction | undefined> {
    return (await this.getTransactionResponse(txHash))?.transaction;
  }

  /**
   * Record known block headers.
   * Implement this method to enable block headers query caching
   * @param _headers
   */
  async recordHeaders(
    ..._headers: (ClientBlockHeaderLike | ClientBlockHeaderLike[])[]
  ): Promise<void> {}
  /**
   * Get a known block header by hash
   * Implement this method to enable block headers query caching
   * @param _hash
   */
  async getHeaderByHash(
    _hash: HexLike,
  ): Promise<ClientBlockHeader | undefined> {
    return;
  }
  /**
   * Get a known block header by number
   * Implement this method to enable block headers query caching
   * @param _number
   */
  async getHeaderByNumber(
    _number: NumLike,
  ): Promise<ClientBlockHeader | undefined> {
    return;
  }

  /**
   * Record known blocks.
   * Implement this method to enable blocks query caching
   * @param _blocks
   */
  async recordBlocks(
    ..._blocks: (ClientBlockLike | ClientBlockLike[])[]
  ): Promise<void> {}
  /**
   * Get a known block header by hash
   * Implement this method to enable block headers query caching
   * @param _hash
   */
  async getBlockByHash(_hash: HexLike): Promise<ClientBlock | undefined> {
    return;
  }
  /**
   * Get a known block header by number
   * Implement this method to enable block headers query caching
   * @param _number
   */
  async getBlockByNumber(_number: NumLike): Promise<ClientBlock | undefined> {
    return;
  }

  /**
   * Checks if a block header is considered confirmed.
   * The default implementation compares the header's timestamp against the current time
   * and a configured confirmation time. Override this method for custom confirmation logic.
   * @param header
   */
  hasHeaderConfirmed(header: ClientBlockHeader): boolean {
    return (
      numFrom(Date.now()) - header.timestamp >= DEFAULT_CONFIRMED_BLOCK_TIME
    );
  }
}
