import {
  Cell,
  CellDep,
  CellDepInfoLike,
  CellInput,
  CellOutput,
  Client,
  ClientBlock,
  ClientBlockHeader,
  ClientFindCellsResponse,
  ClientFindTransactionsGroupedResponse,
  ClientFindTransactionsResponse,
  ClientIndexerSearchKeyLike,
  ClientIndexerSearchKeyTransactionLike,
  ClientTransactionResponse,
  DepType,
  hashCkb,
  Hex,
  hexFrom,
  HexLike,
  KnownScript,
  Num,
  numBeToBytes,
  numFrom,
  NumLike,
  OutPoint,
  OutPointLike,
  OutputsValidator,
  Script,
  ScriptInfo,
  ScriptLike,
  Transaction,
  TransactionLike,
} from "@ckb-ccc/core";
import {
  ClientCollectableSearchKeyLike,
  JsonRpcBlockHeader,
  JsonRpcCellDep,
  JsonRpcCellInput,
  JsonRpcCellOutput,
  JsonRpcTransaction,
  JsonRpcTransformers,
} from "@ckb-ccc/core/advanced";
import assert from "assert";
import {
  spawnSync,
  SpawnSyncOptionsWithBufferEncoding,
  SpawnSyncReturns,
} from "child_process";

/**
 * Defines the metadata for a transaction input.
 */
export type MockInfoInput = {
  input: JsonRpcCellInput;
  output: JsonRpcCellOutput;
  data: Hex;
};

/**
 * Defines the metadata for a Cell dependency in the transaction.
 */
export type MockInfoCellDep = {
  cell_dep: JsonRpcCellDep;
  output: JsonRpcCellOutput;
  data: Hex;
};

/**
 * Defines a block header dependency.
 */
export type MockInfoHeaderDep = JsonRpcBlockHeader;

/**
 * The overall structure that holds transaction metadata including
 * inputs, cell dependencies, and header dependencies.
 */
export type MockInfo = {
  inputs: MockInfoInput[];
  cell_deps: MockInfoCellDep[];
  header_deps: MockInfoHeaderDep[];
};

/**
 * Defines the structure of a transaction file, containing mock
 * information and the actual transaction.
 */
export type TxFile = {
  mock_info: MockInfo;
  tx: JsonRpcTransaction;
};

/**
 * Parses the error code from the given stdout output.
 * Assumes that the desired error code is located on the third-to-last line of the output,
 * in the format `Result: <value>`.
 * @param stdout - The stdout output as a string.
 * @returns The parsed integer value from the error code.
 */
export function parseRunResult(stdout: string): number {
  return parseInt(stdout.split("\n").at(-3)!.split(":")[1].slice(1));
}

/**
 * Parses the total cycle count from the given stdout output.
 * Assumes that the desired cycle information is located on the second-to-last line of the output,
 * in the format `Cycles: <value> (<details>)`.
 * @param stdout - The stdout output as a string.
 * @returns The parsed integer value representing the total cycles.
 */
export function parseAllCycles(stdout: string): number {
  return parseInt(
    stdout.split("\n").at(-2)!.split(":")[1].slice(1).split("(")[0],
  );
}

export class ScriptVerificationResult {
  constructor(
    public groupType: "lock" | "type",
    public cellType: "input" | "output",
    public index: number,
    public spawnReturn: SpawnSyncReturns<Buffer>,
    private cachedCycles: number | null = null,
    private cachedScriptErrorCode: number | null = null,
  ) {}

  /**
   * Gets the process exit status code returned by the ckb-debugger process.
   *
   * This status code indicates whether the debugger process itself executed successfully:
   * - 0: Process completed successfully
   * - -2: Script verification failed
   * - Other values: Process encountered other errors
   *
   * Note: This status code is different from the script error code returned by the
   * script execution itself (see {@link scriptErrorCode}).
   *
   * @returns The process exit status code
   */
  get status() {
    return this.spawnReturn.status;
  }

  /**
   * Gets the stdout output from the ckb-debugger process.
   *
   * This output contains detailed information about the script verification process.
   * It includes the script verification result, cycles, and any additional debug messages.
   *
   * @returns The stdout output from the ckb-debugger process
   */
  get stdout() {
    return this.spawnReturn.stdout.toString();
  }

  /**
   * Gets the stderr output from the ckb-debugger process.
   *
   * This output contains detailed error messages and debugging information.
   * It is useful for diagnosing issues when the script verification fails.
   *
   * @returns The stderr output from the ckb-debugger process
   */
  get stderr() {
    return this.spawnReturn.stderr.toString();
  }

  /**
   * Parses the total cycles from the stdout output.
   * @returns The parsed integer value representing the total cycles.
   */
  get stdoutCycles() {
    if (this.cachedCycles === null) {
      this.cachedCycles = parseAllCycles(this.stdout);
    }
    return this.cachedCycles;
  }

  /**
   * Gets the error code returned by the script execution.
   *
   * This error code is returned by the script itself during execution and is different
   * from the `status` code returned by the ckb-debugger process.
   * The error code is parsed from the stdout output using {@link parseRunResult}.
   *
   * @returns The error code returned by the script execution
   */
  get scriptErrorCode() {
    if (this.cachedScriptErrorCode === null) {
      this.cachedScriptErrorCode = parseRunResult(this.stdout);
    }
    return this.cachedScriptErrorCode;
  }

  /**
   * Reports a summary of the script verification process.
   * This method prints a formatted summary of the script verification results,
   * including the script type, index, stdout, and stderr outputs.
   */
  reportSummary() {
    console.log(`
╔════════════════════════════════════════════════════════
║ Script Verification Summary
║ Type: ${this.cellType} ${this.groupType} script
║ Index: ${this.index}
╠════════════════════════════════════════════════════════
║ STDOUT:
║ ${this.stdout.trim().split("\n").join("\n║ ")}
╠════════════════════════════════════════════════════════
║ STDERR:
║ ${this.stderr.trim().split("\n").join("\n║ ")}
╚════════════════════════════════════════════════════════
`);
  }
}

/**
 * Manages CKB resources for unit testing, including Cells, block headers, and other on-chain data.
 *
 * This class provides mock data for unit tests that require on-chain information but run in an isolated environment.
 * It maintains collections of:
 * - Cells: Mock transaction input cells
 * - Block Headers: Mock block header information
 * - Cell Dependencies: Mock dependencies required by transactions
 *
 * The class offers methods to:
 * - Create and track mock cells with custom scripts and data
 * - Generate unique type IDs for type scripts
 * - Deploy cells with associated scripts
 * - Create various transaction components (inputs, outputs, deps)
 *
 * @example
 * ```typescript
 * // Create a new resource manager
 * const resource = new Resource();
 *
 * // Mock a cell with a lock script
 * const lock = new Script("0x...", "data", "0x");
 * const cell = resource.mockCell(lock);
 *
 * // Create transaction components
 * const input = Resource.createCellInput(cell);
 * ```
 */
export class Resource {
  constructor(
    public cells: Map<OutPoint, Cell> = new Map(),
    public cellOutpointHash: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000",
    public cellOutpointIncr: Num = numFrom(0),
    public header: Map<Hex, MockInfoHeaderDep> = new Map(),
    public headerIncr: Num = numFrom(0),
    public typeidIncr: Num = numFrom(0),
  ) {}

  // Static method to return a default Resource instance.
  static default(): Resource {
    return new Resource();
  }

  /**
   * Mock a new Cell with specified capacity, lock script, data, and optional type.
   * @param lock - The lock script to control the ownership of the Cell.
   * @param type - Optional type script for the Cell.
   * @param data - The data to be stored in the Cell. default is "0x".
   * @param capacity - The capacity (amount) of the Cell. default is 0.
   * @returns A cell object representing the newly created Cell.
   */
  mockCell(
    lock: Script,
    type?: Script,
    data: Hex = "0x",
    capacity: Num = numFrom(0),
  ): Cell {
    const cellOutPoint = new OutPoint(
      this.cellOutpointHash,
      this.cellOutpointIncr,
    );
    const cellOutput = new CellOutput(capacity, lock, type);
    const cell = new Cell(cellOutPoint, cellOutput, data);
    this.cells.set(cellOutPoint, cell);
    this.cellOutpointIncr += numFrom(1);
    return cell;
  }

  /**
   * Creates a CellDep (Cell Dependency) for the given cell.
   * @param cell - The metadata of the Cell.
   * @param depType - The type of dependency (Code, DepGroup).
   * @returns A CellDep object representing the Cell dependency.
   */
  createCellDep(cell: Cell, depType: DepType): CellDep {
    return new CellDep(cell.outPoint, depType);
  }

  /**
   * Creates a CellInput for a given cell.
   * @param cell - The metadata of the Cell.
   * @returns A CellInput object representing the input for the transaction.
   *
   * @example
   * ```typescript
   * // First mock a cell using mockCell
   * const lock = new Script("0x...", "data", "0x");
   * const cell = resource.mockCell(lock, undefined, "0x", 1000n);
   *
   * // Then create a cell input from it
   * const input = Resource.createCellInput(cell);
   *
   * // The input can now be used in a transaction
   * const tx = new Transaction();
   * tx.inputs.push(input);
   * ```
   */
  static createCellInput(cell: Cell): CellInput {
    return new CellInput(cell.outPoint, numFrom(0));
  }

  /**
   * Creates a CellOutput with lock script, optional type script and capacities.
   * @param lock - The lock script for the Cell.
   * @param type - Optional type script for the Cell.
   * @param capacity - The capacity (amount) of the Cell. default is 0.
   * @returns A CellOutput object.
   *
   * @example
   * ```typescript
   * // Create a basic cell output with just a lock script
   * const lock = new Script("0x...", "data", "0x");
   * const output = Resource.createCellOutput(lock, undefined, 1000n);
   *
   * // The outputs can now be used in a transaction
   * const tx = new Transaction();
   * tx.outputsData.push(hexFrom("0x"));
   * tx.outputs.push(output);
   * ```
   */
  static createCellOutput(
    lock: Script,
    type?: Script,
    capacity: Num = numFrom(0),
  ): CellOutput {
    return new CellOutput(capacity, lock, type);
  }

  /**
   * Mock a new block header dependency and returns its hash.
   * @param header - The block header to be added.
   * @returns The hash of the block header.
   */
  mockHeader(header: MockInfoHeaderDep): Hex {
    header.hash = hexFrom(numBeToBytes(this.headerIncr, 32));
    this.header.set(header.hash, header);
    this.headerIncr += numFrom(1);
    return header.hash;
  }

  /**
   * Creates a Script based on data and its associated dataHash.
   * @param cell - The metadata of the Cell.
   * @param args - The arguments to be used in the script.
   * @returns A Script object.
   */
  createScriptByData(cell: Cell, args: Hex): Script {
    return new Script(hashCkb(cell.outputData), "data2", args);
  }

  /**
   * Creates a Script based on the type of the Cell.
   * @param cell - The metadata of the Cell.
   * @param args - The arguments to be used in the script.
   * @returns A Script object.
   */
  createScriptByType(cell: Cell, args: Hex): Script {
    return new Script(cell.cellOutput.type!.hash(), "type", args);
  }

  /**
   * Creates a Script with a type ID, incrementing the type ID for each call.
   * @returns A Script object representing the type ID.
   */
  createScriptTypeID(): Script {
    const args = hexFrom(numBeToBytes(this.typeidIncr, 32));
    this.typeidIncr += numFrom(1);
    return new Script(
      "0x00000000000000000000000000000000000000000000000000545950455f4944",
      "type",
      args,
    );
  }

  /**
   * Creates a placeholder Script with a zero code hash and empty args.
   * @remarks
   * This script is intended for testing purposes only and should not be used in real transactions.
   * It is primarily used as a placeholder lock script for cell_deps where the actual script execution
   * is not needed.
   * @returns A non-executable Script object with zero code hash
   */
  createScriptUnused(): Script {
    return new Script(
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "data",
      "0x",
    );
  }

  /**
   * Deploys a new Cell with given data and adds it as a cell dependency to the transaction.
   * @param data - The data to be stored in the deployed cell.
   * @param tx - The transaction to which the cell dependency will be added.
   * @param isType - If true, creates a type ID script for the cell. If false, uses data hash for script code hash.
   * @returns A Script object that can be used to reference this deployed cell. The returned script has empty args ("0x")
   * which should be updated by the caller with appropriate arguments.
   *
   * @example
   * ```typescript
   * // Deploy cell with data hash based script
   * const script = resource.deployCell(data, tx, false);
   * script.args = "0xEEFF"; // Update args as needed
   *
   * // Deploy cell with type ID based script
   * const typeScript = resource.deployCell(data, tx, true);
   * typeScript.args = "0x0011"; // Update args as needed
   * ```
   */
  deployCell(data: Hex, tx: Transaction, isType: boolean): Script {
    let typeScript = undefined;
    if (isType) {
      typeScript = this.createScriptTypeID();
    }

    const deployedCell = this.mockCell(
      this.createScriptUnused(),
      typeScript,
      data,
    );
    tx.cellDeps.push(this.createCellDep(deployedCell, "code"));
    if (isType) {
      return this.createScriptByType(deployedCell, "0x");
    } else {
      return this.createScriptByData(deployedCell, "0x");
    }
  }
}

/**
 * A minimal CKB client implementation for unit testing purposes.
 * This client only implements the `getCell` method and rejects all other client operations.
 * It is primarily used for testing scenarios where only cell resolution is needed.
 *
 * @example
 * ```typescript
 * const sigHashAll = await tx.getSignHashInfo(
 *   lockScript,
 *   new UnitTestClient(resource)
 * );
 * ```
 */
export class UnitTestClient extends Client {
  constructor(public resource: Resource) {
    super();
  }

  get url(): string {
    return "";
  }

  get addressPrefix(): string {
    return "";
  }

  getKnownScript(_script: KnownScript): Promise<ScriptInfo> {
    return Promise.reject(new Error("Not implemented"));
  }

  getFeeRateStatistics(
    _blockRange?: NumLike,
  ): Promise<{ mean: Num; median: Num }> {
    return Promise.reject(new Error("Not implemented"));
  }

  getFeeRate(
    _blockRange?: NumLike,
    _options?: { maxFeeRate?: NumLike },
  ): Promise<Num> {
    return Promise.reject(new Error("Not implemented"));
  }

  getTip(): Promise<Num> {
    return Promise.reject(new Error("Not implemented"));
  }

  getTipHeader(_verbosity?: number | null): Promise<ClientBlockHeader> {
    return Promise.reject(new Error("Not implemented"));
  }

  getBlockByNumberNoCache(
    _blockNumber: NumLike,
    _verbosity?: number | null,
    _withCycles?: boolean | null,
  ): Promise<ClientBlock | undefined> {
    return Promise.reject(new Error("Not implemented"));
  }

  getBlockByHashNoCache(
    _blockHash: HexLike,
    _verbosity?: number | null,
    _withCycles?: boolean | null,
  ): Promise<ClientBlock | undefined> {
    return Promise.reject(new Error("Not implemented"));
  }

  getHeaderByNumberNoCache(
    _blockNumber: NumLike,
    _verbosity?: number | null,
  ): Promise<ClientBlockHeader | undefined> {
    return Promise.reject(new Error("Not implemented"));
  }

  getHeaderByHashNoCache(
    _blockHash: HexLike,
    _verbosity?: number | null,
  ): Promise<ClientBlockHeader | undefined> {
    return Promise.reject(new Error("Not implemented"));
  }

  getBlockByNumber(
    _blockNumber: NumLike,
    _verbosity?: number | null,
    _withCycles?: boolean | null,
  ): Promise<ClientBlock | undefined> {
    return Promise.reject(new Error("Not implemented"));
  }

  getBlockByHash(
    _blockHash: HexLike,
    _verbosity?: number | null,
    _withCycles?: boolean | null,
  ): Promise<ClientBlock | undefined> {
    return Promise.reject(new Error("Not implemented"));
  }

  getHeaderByNumber(
    _blockNumber: NumLike,
    _verbosity?: number | null,
  ): Promise<ClientBlockHeader | undefined> {
    return Promise.reject(new Error("Not implemented"));
  }

  getHeaderByHash(
    _blockHash: HexLike,
    _verbosity?: number | null,
  ): Promise<ClientBlockHeader | undefined> {
    return Promise.reject(new Error("Not implemented"));
  }

  estimateCycles(_transaction: TransactionLike): Promise<Num> {
    return Promise.reject(new Error("Not implemented"));
  }

  sendTransactionDry(
    _transaction: TransactionLike,
    _validator?: OutputsValidator,
  ): Promise<Num> {
    return Promise.reject(new Error("Not implemented"));
  }

  sendTransactionNoCache(
    _transaction: TransactionLike,
    _validator?: OutputsValidator,
  ): Promise<Hex> {
    return Promise.reject(new Error("Not implemented"));
  }

  getTransactionNoCache(
    _txHash: HexLike,
  ): Promise<ClientTransactionResponse | undefined> {
    return Promise.reject(new Error("Not implemented"));
  }

  async getCell(outPointLike: OutPointLike): Promise<Cell | undefined> {
    const cell = this.resource.cells.get(OutPoint.from(outPointLike));
    if (!cell) {
      return;
    }
    return cell;
  }

  getCellLiveNoCache(
    _outPointLike: OutPointLike,
    _withData?: boolean | null,
    _includeTxPool?: boolean | null,
  ): Promise<Cell | undefined> {
    return Promise.reject(new Error("Not implemented"));
  }

  getCellLive(
    _outPointLike: OutPointLike,
    _withData?: boolean | null,
    _includeTxPool?: boolean | null,
  ): Promise<Cell | undefined> {
    return Promise.reject(new Error("Not implemented"));
  }

  findCellsPagedNoCache(
    _key: ClientIndexerSearchKeyLike,
    _order?: "asc" | "desc",
    _limit?: NumLike,
    _after?: string,
  ): Promise<ClientFindCellsResponse> {
    return Promise.reject(new Error("Not implemented"));
  }
  async findCellsPaged(
    _key: ClientIndexerSearchKeyLike,
    _order?: "asc" | "desc",
    _limit?: NumLike,
    _after?: string,
  ): Promise<ClientFindCellsResponse> {
    return Promise.reject(new Error("Not implemented"));
  }

  findCellsOnChain(
    _key: ClientIndexerSearchKeyLike,
    _order?: "asc" | "desc",
    _limit = 10,
  ): AsyncGenerator<Cell> {
    throw new Error("Not implemented");
  }

  findCells(
    _keyLike: ClientCollectableSearchKeyLike,
    _order?: "asc" | "desc",
    _limit = 10,
  ): AsyncGenerator<Cell> {
    throw new Error("Not implemented");
  }

  findCellsByLock(
    _lock: ScriptLike,
    _type?: ScriptLike | null,
    _withData = true,
    _order?: "asc" | "desc",
    _limit = 10,
  ): AsyncGenerator<Cell> {
    throw new Error("Not implemented");
  }

  findCellsByType(
    _type: ScriptLike,
    _withData = true,
    _order?: "asc" | "desc",
    _limit = 10,
  ): AsyncGenerator<Cell> {
    throw new Error("Not implemented");
  }

  async findSingletonCellByType(
    _type: ScriptLike,
    _withData = false,
  ): Promise<Cell | undefined> {
    return Promise.reject(new Error("Not implemented"));
  }

  async getCellDeps(
    ..._cellDepsInfoLike: (CellDepInfoLike | CellDepInfoLike[])[]
  ): Promise<CellDep[]> {
    return Promise.reject(new Error("Not implemented"));
  }

  findTransactionsPaged(
    key: Omit<ClientIndexerSearchKeyTransactionLike, "groupByTransaction"> & {
      groupByTransaction: true;
    },
    order?: "asc" | "desc",
    limit?: NumLike,
    after?: string,
  ): Promise<ClientFindTransactionsGroupedResponse>;
  findTransactionsPaged(
    key: Omit<ClientIndexerSearchKeyTransactionLike, "groupByTransaction"> & {
      groupByTransaction?: false | null;
    },
    order?: "asc" | "desc",
    limit?: NumLike,
    after?: string,
  ): Promise<ClientFindTransactionsResponse>;
  findTransactionsPaged(
    _key: ClientIndexerSearchKeyTransactionLike,
    _order?: "asc" | "desc",
    _limit?: NumLike,
    _after?: string,
  ): Promise<
    ClientFindTransactionsResponse | ClientFindTransactionsGroupedResponse
  > {
    return Promise.reject(new Error("Not implemented"));
  }

  getCellsCapacity(_key: ClientIndexerSearchKeyLike): Promise<Num> {
    return Promise.reject(new Error("Not implemented"));
  }

  async getBalanceSingle(_lock: ScriptLike): Promise<Num> {
    return Promise.reject(new Error("Not implemented"));
  }

  async getBalance(_locks: ScriptLike[]): Promise<Num> {
    return Promise.reject(new Error("Not implemented"));
  }

  async sendTransaction(
    _transaction: TransactionLike,
    _validator?: OutputsValidator,
    _options?: { maxFeeRate?: NumLike },
  ): Promise<Hex> {
    return Promise.reject(new Error("Not implemented"));
  }

  async getTransaction(
    _txHashLike: HexLike,
  ): Promise<ClientTransactionResponse | undefined> {
    return Promise.reject(new Error("Not implemented"));
  }

  async waitTransaction(
    _txHash: HexLike,
    _confirmations: number = 0,
    _timeout: number = 60000,
    _interval: number = 2000,
  ): Promise<ClientTransactionResponse | undefined> {
    return Promise.reject(new Error("Not implemented"));
  }

  findTransactionsByLock(
    lock: ScriptLike,
    type: ScriptLike | null | undefined,
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
    _lock: ScriptLike,
    _type?: ScriptLike | null,
    _groupByTransaction?: boolean | null,
    _order?: "asc" | "desc",
    _limit = 10,
  ): AsyncGenerator<
    | ClientFindTransactionsResponse["transactions"][0]
    | ClientFindTransactionsGroupedResponse["transactions"][0]
  > {
    throw new Error("Not implemented");
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
    _type: ScriptLike,
    _groupByTransaction?: boolean | null,
    _order?: "asc" | "desc",
    _limit = 10,
  ): AsyncGenerator<
    | ClientFindTransactionsResponse["transactions"][0]
    | ClientFindTransactionsGroupedResponse["transactions"][0]
  > {
    throw new Error("Not implemented");
  }
}

// Verifier class is responsible for validating the transaction using a debugger tool.
export class Verifier {
  debugger: string; // The name of the debugger tool.
  args: string[];
  resource: Resource;
  tx: Transaction;

  constructor(resource: Resource, tx: Transaction) {
    this.debugger = "ckb-debugger";
    this.args = [];
    this.resource = resource;
    this.tx = tx;
  }

  // Static method to create a Verifier instance from a Resource and Transaction.
  static from(resource: Resource, tx: Transaction): Verifier {
    return new Verifier(resource, tx);
  }

  /**
   * Converts the transaction into a TxFile format.
   * @returns A TxFile object containing the transaction and mock information.
   */
  txFile(): TxFile {
    const r: TxFile = {
      mock_info: {
        inputs: [],
        cell_deps: [],
        header_deps: [],
      },
      tx: JsonRpcTransformers.transactionFrom(this.tx),
    };

    // Add cell dependencies to the mock info.
    for (const e of this.tx.cellDeps) {
      const cell = this.resource.cells.get(e.outPoint)!;
      r.mock_info.cell_deps.push({
        cell_dep: {
          out_point: JsonRpcTransformers.outPointFrom(cell.outPoint),
          dep_type: JsonRpcTransformers.depTypeFrom(e.depType),
        },
        output: JsonRpcTransformers.cellOutputFrom(cell.cellOutput),
        data: cell.outputData,
      });
    }

    // Add inputs to the mock info.
    for (const e of this.tx.inputs) {
      const cell = this.resource.cells.get(e.previousOutput)!;
      r.mock_info.inputs.push({
        input: JsonRpcTransformers.cellInputFrom(e),
        output: JsonRpcTransformers.cellOutputFrom(cell.cellOutput),
        data: cell.outputData,
      });
    }

    // Add header dependencies to the mock info.
    for (const e of this.tx.headerDeps) {
      const header = this.resource.header.get(e)!;
      r.mock_info.header_deps.push(header);
    }
    return r;
  }

  /**
   * Verifies that the transaction fails verification and optionally checks for a specific error code.
   * @param expectedErrorCode - Optional. If provided, asserts that the verification fails with this specific error code.
   * @param enableLog - When true, prints detailed verification summaries for each script execution,
   *                   including stdout and stderr output. Defaults to false.
   * @throws {AssertionError} If expectedErrorCode is provided and the actual error code doesn't match,
   *                          or if no verification failure occurs when one is expected.
   */
  verifyFailure(expectedErrorCode?: number, enableLog: boolean = false) {
    const runResults = this.verify();
    for (const e of runResults) {
      if (e.status != 0) {
        if (expectedErrorCode === undefined) {
          return;
        }

        if (e.scriptErrorCode != expectedErrorCode) {
          e.reportSummary();
          assert.fail(
            `Transaction verification failed with unexpected error code: expected ${expectedErrorCode}, got ${e.scriptErrorCode}. See details above.`,
          );
        } else {
          return;
        }
      }
      if (enableLog) {
        e.reportSummary();
      }
    }
    assert.fail(
      `Transaction verification should fail. No verification failure occurred.`,
    );
  }

  /**
   * Verifies that the transaction passes all script verifications successfully.
   *
   * @param enableLog - When true, prints detailed verification summaries for each script execution,
   *                   including stdout and stderr output. Defaults to false.
   * @throws {AssertionError} If any script verification fails. The error message
   *         will include a detailed summary of the failed verification.
   * @returns The total number of cycles consumed by all script executions
   */
  verifySuccess(enableLog: boolean = false): number {
    let cycles = 0;
    const runResults = this.verify();
    for (const e of runResults) {
      if (e.status != 0) {
        e.reportSummary();
        assert.fail("Transaction verification failed. See details above.");
      }
      if (enableLog) {
        e.reportSummary();
      }
      cycles += e.stdoutCycles;
    }
    return cycles;
  }
  static checkSpawnResult(result: SpawnSyncReturns<Buffer>) {
    if (result.status === 0) {
      return;
    }
    if (result.error?.message.includes("ENOENT")) {
      throw new Error(
        "ckb-debugger not found. Please install it first: https://github.com/nervosnetwork/ckb-standalone-debugger",
      );
    }
  }
  /**
   * Runs the verification process on the transaction by calling the debugger tool.
   * This method spawns a new process for each input/output in the transaction and checks for errors.
   * @returns An array of results from the debugger tool (contains information about verification status).
   */
  verify(): ScriptVerificationResult[] {
    const txFile = JSON.stringify(this.txFile());
    const config: SpawnSyncOptionsWithBufferEncoding = {
      input: txFile,
    };
    const result: ScriptVerificationResult[] = [];
    // only run the first script in same group, according to the CKB cell model
    const lockGroup: Set<Hex> = new Set();
    const typeGroup: Set<Hex> = new Set();
    for (const [i, e] of this.tx.inputs.entries()) {
      const cell = this.resource.cells.get(e.previousOutput)!;
      // skip lock script in same group
      const lockHash = cell.cellOutput.lock.hash();
      if (lockGroup.has(lockHash)) {
        continue;
      }
      lockGroup.add(lockHash);

      const argsLockPath = `--tx-file - --cell-type input  --script-group-type lock --cell-index ${i}`;
      const argsLock = this.args.slice().concat(argsLockPath.split(" "));
      const result1 = spawnSync(this.debugger, argsLock, config);
      Verifier.checkSpawnResult(result1);
      result.push(new ScriptVerificationResult("lock", "input", i, result1));

      if (!cell.cellOutput.type) {
        continue;
      }
      // skip type script in same group
      const typeHash = cell.cellOutput.type.hash();
      if (typeGroup.has(typeHash)) {
        continue;
      }
      typeGroup.add(typeHash);

      const argsTypePath = `--tx-file - --cell-type input  --script-group-type type --cell-index ${i}`;
      const argsType = this.args.slice().concat(argsTypePath.split(" "));
      const result2 = spawnSync(this.debugger, argsType, config);
      Verifier.checkSpawnResult(result2);
      result.push(new ScriptVerificationResult("type", "input", i, result2));
    }
    for (const [i, e] of this.tx.outputs.entries()) {
      if (!e.type) {
        continue;
      }
      // skip type script in same group
      const typeHash = e.type.hash();
      if (typeGroup.has(typeHash)) {
        continue;
      }
      typeGroup.add(typeHash);
      const argsTypePath = `--tx-file - --cell-type output --script-group-type type --cell-index ${i}`;
      const argsType = this.args.slice().concat(argsTypePath.split(" "));
      const result1 = spawnSync(this.debugger, argsType, config);
      Verifier.checkSpawnResult(result1);
      result.push(new ScriptVerificationResult("type", "output", i, result1));
    }
    return result;
  }
}
