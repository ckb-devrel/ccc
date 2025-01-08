import {
  Cell,
  OutPoint,
  OutPointLike,
  TransactionLike,
} from "../../ckb/index.js";
import { Hex, HexLike, hexFrom } from "../../hex/index.js";
import {
  RequestorJsonRpc,
  RequestorJsonRpcConfig,
} from "../../jsonRpc/requestor.js";
import { Num, NumLike, numFrom, numToHex } from "../../num/index.js";
import { apply } from "../../utils/index.js";
import { ClientCache } from "../cache/index.js";
import { Client } from "../client.js";
import {
  ClientFindCellsResponse,
  ClientIndexerSearchKeyLike,
  ClientTransactionResponse,
  ErrorClientBase,
  ErrorClientBaseLike,
  ErrorClientDuplicatedTransaction,
  ErrorClientRBFRejected,
  ErrorClientResolveUnknown,
  ErrorClientVerification,
  OutputsValidator,
} from "../clientTypes.js";
import {
  JsonRpcBlock,
  JsonRpcBlockHeader,
  JsonRpcCellOutput,
  JsonRpcTransformers,
} from "./advanced.js";

const ERROR_PARSERS: [
  string,
  (error: ErrorClientBaseLike, match: RegExpMatchArray) => ErrorClientBase,
][] = [
  [
    "Resolve\\(Unknown\\(OutPoint\\((0x.*)\\)\\)\\)",
    (error, match) =>
      new ErrorClientResolveUnknown(error, OutPoint.fromBytes(match[1])),
  ],
  [
    "Verification\\(Error { kind: Script, inner: TransactionScriptError { source: (Inputs|Outputs)\\[([0-9]*)\\].(Lock|Type), cause: ValidationFailure: see error code (-?[0-9])* on page https://nervosnetwork\\.github\\.io/ckb-script-error-codes/by-(type|data)-hash/(.*)\\.html",
    (error, match) =>
      new ErrorClientVerification(
        error,
        match[3] === "Lock"
          ? "lock"
          : match[1] === "Inputs"
            ? "inputType"
            : "outputType",
        match[2],
        Number(match[4]),
        match[5] === "data" ? "data" : "type",
        match[6],
      ),
  ],
  [
    "Duplicated\\(Byte32\\((0x.*)\\)\\)",
    (error, match) => new ErrorClientDuplicatedTransaction(error, match[1]),
  ],
  [
    'RBFRejected\\("Tx\'s current fee is ([0-9]*), expect it to >= ([0-9]*) to replace old txs"\\)',
    (error, match) => new ErrorClientRBFRejected(error, match[1], match[2]),
  ],
];

export type ClientJsonRpcConfig = RequestorJsonRpcConfig & {
  cache?: ClientCache;
  requestor?: RequestorJsonRpc;
};

/**
 * An abstract class implementing JSON-RPC client functionality for a specific URL and timeout.
 * Provides methods for sending transactions and building JSON-RPC payloads.
 */
export abstract class ClientJsonRpc extends Client {
  public readonly requestor: RequestorJsonRpc;

  /**
   * Creates an instance of ClientJsonRpc.
   *
   * @param url_ - The URL of the JSON-RPC server.
   * @param timeout - The timeout for requests in milliseconds
   */

  constructor(url_: string, config?: ClientJsonRpcConfig) {
    super(config);

    this.requestor =
      config?.requestor ??
      new RequestorJsonRpc(url_, config, (errAny) => {
        if (
          typeof errAny !== "object" ||
          errAny === null ||
          !("data" in errAny) ||
          typeof errAny.data !== "string"
        ) {
          throw errAny;
        }
        const err = errAny as ErrorClientBaseLike;

        for (const [regexp, builder] of ERROR_PARSERS) {
          const match = err.data.match(regexp);
          if (match) {
            throw builder(err, match);
          }
        }

        throw new ErrorClientBase(err);
      });
  }

  /**
   * Returns the URL of the JSON-RPC server.
   *
   * @returns The URL of the JSON-RPC server.
   */
  get url(): string {
    return this.requestor.url;
  }

  /**
   * Get fee rate statistics
   *
   * @returns Fee rate statistics
   */

  getFeeRateStatistics = this.buildSender(
    "get_fee_rate_statistics",
    [(n: NumLike) => apply(numFrom, n)],
    ({ mean, median }: { mean: NumLike; median: NumLike }) => ({
      mean: numFrom(mean),
      median: numFrom(median),
    }),
  ) as Client["getFeeRateStatistics"];

  /**
   * Get tip block number
   *
   * @returns Tip block number
   */

  getTip = this.buildSender(
    "get_tip_block_number",
    [],
    numFrom,
  ) as () => Promise<Num>;

  /**
   * Get tip block header
   *
   * @param verbosity - result format which allows 0 and 1. (Optional, the default is 1.)
   * @returns BlockHeader
   */
  getTipHeader = this.buildSender(
    "get_tip_header",
    [],
    (b: JsonRpcBlockHeader) => apply(JsonRpcTransformers.blockHeaderTo, b),
  ) as Client["getTipHeader"];

  /**
   * Get block by block number
   *
   * @param blockNumber - The block number.
   * @param verbosity - result format which allows 0 and 2. (Optional, the default is 2.)
   * @param withCycles - whether the return cycles of block transactions. (Optional, default false.)
   * @returns Block
   */
  getBlockByNumber = this.buildSender(
    "get_block_by_number",
    [(v: NumLike) => numToHex(numFrom(v))],
    (b: JsonRpcBlock) => apply(JsonRpcTransformers.blockTo, b),
  ) as Client["getBlockByNumber"];

  /**
   * Get block by block hash
   *
   * @param blockHash - The block hash.
   * @param verbosity - result format which allows 0 and 2. (Optional, the default is 2.)
   * @param withCycles - whether the return cycles of block transactions. (Optional, default false.)
   * @returns Block
   */
  getBlockByHash = this.buildSender("get_block", [hexFrom], (b: JsonRpcBlock) =>
    apply(JsonRpcTransformers.blockTo, b),
  ) as Client["getBlockByHash"];

  /**
   * Get header by block number
   *
   * @param blockNumber - The block number.
   * @param verbosity - result format which allows 0 and 1. (Optional, the default is 1.)
   * @returns BlockHeader
   */
  getHeaderByNumber = this.buildSender(
    "get_header_by_number",
    [(v: NumLike) => numToHex(numFrom(v))],
    (b: JsonRpcBlockHeader) => apply(JsonRpcTransformers.blockHeaderTo, b),
  ) as Client["getHeaderByNumber"];

  /**
   * Get header by block hash
   *
   * @param blockHash - The block hash.
   * @param verbosity - result format which allows 0 and 1. (Optional, the default is 1.)
   * @returns BlockHeader
   */
  getHeaderByHash = this.buildSender(
    "get_header",
    [hexFrom],
    (b: JsonRpcBlockHeader) => apply(JsonRpcTransformers.blockHeaderTo, b),
  ) as Client["getHeaderByHash"];

  /**
   * Estimate cycles of a transaction.
   *
   * @param transaction - The transaction to estimate.
   * @returns Consumed cycles
   */
  estimateCycles = this.buildSender(
    "estimate_cycles",
    [JsonRpcTransformers.transactionFrom],
    ({ cycles }: { cycles: NumLike }) => numFrom(cycles),
  ) as Client["estimateCycles"];

  /**
   * Test a transaction.
   *
   * @param transaction - The transaction to test.
   * @param validator - "passthrough": Disable validation. "well_known_scripts_only": Only accept well known scripts in the transaction.
   * @returns Consumed cycles
   */

  sendTransactionDry = this.buildSender(
    "test_tx_pool_accept",
    [JsonRpcTransformers.transactionFrom],
    ({ cycles }: { cycles: NumLike }) => numFrom(cycles),
  ) as Client["sendTransactionDry"];

  /**
   * Send a transaction to node.
   *
   * @param transaction - The transaction to send.
   * @param validator - "passthrough": Disable validation. "well_known_scripts_only": Only accept well known scripts in the transaction.
   * @returns Transaction hash.
   */

  sendTransactionNoCache = this.buildSender(
    "send_transaction",
    [JsonRpcTransformers.transactionFrom],
    hexFrom,
  ) as (
    transaction: TransactionLike,
    validator?: OutputsValidator | undefined,
  ) => Promise<Hex>;

  /**
   * Get a transaction from node.
   *
   * @param txHash - The hash of the transaction.
   * @returns The transaction with status.
   */

  getTransactionNoCache = this.buildSender(
    "get_transaction",
    [hexFrom],
    JsonRpcTransformers.transactionResponseTo,
  ) as (txHash: HexLike) => Promise<ClientTransactionResponse | undefined>;

  /**
   * Get a live cell from node.
   *
   * @param outPoint - The out point of the cell.
   * @param withData - Include data in the response.
   * @param includeTxPool - Include cells in the tx pool.
   * @returns The cell
   */
  getCellLiveNoCache(
    outPoint: OutPointLike,
    withData?: boolean | null,
    includeTxPool?: boolean | null,
  ) {
    return this.buildSender(
      "get_live_cell",
      [JsonRpcTransformers.outPointFrom],
      ({
        cell,
      }: {
        cell?: {
          output: JsonRpcCellOutput;
          data?: { content: HexLike; hash: HexLike };
        };
      }) =>
        apply(
          ({
            output,
            data,
          }: {
            output: JsonRpcCellOutput;
            data?: { content: HexLike; hash: HexLike };
          }) =>
            Cell.from({
              cellOutput: JsonRpcTransformers.cellOutputTo(output),
              outputData: data?.content ?? "0x",
              outPoint,
            }),
          cell,
        ),
    )(outPoint, withData ?? true, includeTxPool) as Promise<Cell | undefined>;
  }

  /**
   * find cells from node.
   *
   * @param key - The search key of cells.
   * @param order - The order of cells.
   * @param limit - The max return size of cells.
   * @param after - Pagination parameter.
   * @returns The found cells.
   */

  findCellsPagedNoCache = this.buildSender(
    "get_cells",
    [
      JsonRpcTransformers.indexerSearchKeyFrom,
      (order?: "asc" | "desc") => order ?? "asc",
      (limit?: NumLike) => numToHex(limit ?? 10),
    ],
    JsonRpcTransformers.findCellsResponseTo,
  ) as (
    key: ClientIndexerSearchKeyLike,
    order?: "asc" | "desc",
    limit?: NumLike,
    after?: string,
  ) => Promise<ClientFindCellsResponse>;

  /**
   * find transactions from node.
   *
   * @param key - The search key of transactions.
   * @param order - The order of transactions.
   * @param limit - The max return size of transactions.
   * @param after - Pagination parameter.
   * @returns The found transactions.
   */

  findTransactionsPaged = this.buildSender(
    "get_transactions",
    [
      JsonRpcTransformers.indexerSearchKeyTransactionFrom,
      (order?: "asc" | "desc") => order ?? "asc",
      (limit?: NumLike) => numToHex(limit ?? 10),
    ],
    JsonRpcTransformers.findTransactionsResponseTo,
  ) as Client["findTransactionsPaged"];

  /**
   * get cells capacity from node.
   *
   * @param key - The search key of cells.
   * @returns The sum of cells capacity.
   */

  getCellsCapacity = this.buildSender(
    "get_cells_capacity",
    [JsonRpcTransformers.indexerSearchKeyFrom],
    ({ capacity }: { capacity: NumLike }) => numFrom(capacity),
  ) as (key: ClientIndexerSearchKeyLike) => Promise<Num>;

  /**
   * Builds a sender function for a JSON-RPC method.
   *
   * @param rpcMethod - The JSON-RPC method.
   * @param inTransformers - An array of input transformers.
   * @param outTransformer - An output transformer function.
   * @returns A function that sends a JSON-RPC request with the given method and transformed parameters.
   */

  buildSender(
    rpcMethod: Parameters<RequestorJsonRpc["request"]>[0],
    inTransformers?: Parameters<RequestorJsonRpc["request"]>[2],
    outTransformer?: Parameters<RequestorJsonRpc["request"]>[3],
  ): (...req: unknown[]) => Promise<unknown> {
    return async (...req: unknown[]) => {
      return this.requestor.request(
        rpcMethod,
        req,
        inTransformers,
        outTransformer,
      );
    };
  }
}
