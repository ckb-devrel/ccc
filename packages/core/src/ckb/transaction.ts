import { Bytes, BytesLike, bytesFrom } from "../bytes/index.js";
import type { ClientCollectableSearchKeyFilterLike } from "../client/clientTypes.advanced.js";
import {
  ClientBlockHeader,
  type CellDepInfoLike,
  type Client,
  type ClientBlockHeaderLike,
} from "../client/index.js";
import { KnownScript } from "../client/knownScript.js";
import { Zero, fixedPointFrom } from "../fixedPoint/index.js";
import { Hasher, HasherCkb, hashCkb } from "../hasher/index.js";
import { Hex, HexLike, hexFrom } from "../hex/index.js";
import { mol } from "../molecule/index.js";
import {
  Num,
  NumLike,
  numFrom,
  numFromBytes,
  numToBytes,
  numToHex,
} from "../num/index.js";
import type { Signer } from "../signer/index.js";
import { apply, reduceAsync } from "../utils/index.js";
import { Script, ScriptLike, ScriptOpt } from "./script.js";
import { DEP_TYPE_TO_NUM, NUM_TO_DEP_TYPE } from "./transaction.advanced.js";
import {
  ErrorTransactionInsufficientCapacity,
  ErrorTransactionInsufficientCoin,
} from "./transactionErrors.js";
import type { LumosTransactionSkeletonType } from "./transactionLumos.js";

export const DepTypeCodec: mol.Codec<DepTypeLike, DepType> = mol.Codec.from({
  byteLength: 1,
  encode: depTypeToBytes,
  decode: depTypeFromBytes,
});

/**
 * @public
 */
export type DepTypeLike = string | number | bigint;
/**
 * @public
 */
export type DepType = "depGroup" | "code";

/**
 * Converts a DepTypeLike value to a DepType.
 * @public
 *
 * @param val - The value to convert, which can be a string, number, or bigint.
 * @returns The corresponding DepType.
 *
 * @throws Will throw an error if the input value is not a valid dep type.
 *
 * @example
 * ```typescript
 * const depType = depTypeFrom(1); // Outputs "code"
 * const depType = depTypeFrom("depGroup"); // Outputs "depGroup"
 * ```
 */

export function depTypeFrom(val: DepTypeLike): DepType {
  const depType = (() => {
    if (typeof val === "number") {
      return NUM_TO_DEP_TYPE[val];
    }

    if (typeof val === "bigint") {
      return NUM_TO_DEP_TYPE[Number(val)];
    }

    return val as DepType;
  })();
  if (depType === undefined) {
    throw new Error(`Invalid dep type ${val}`);
  }
  return depType;
}

/**
 * Converts a DepTypeLike value to its corresponding byte representation.
 * @public
 *
 * @param depType - The dep type value to convert.
 * @returns A Uint8Array containing the byte representation of the dep type.
 *
 * @example
 * ```typescript
 * const depTypeBytes = depTypeToBytes("code"); // Outputs Uint8Array [1]
 * ```
 */

export function depTypeToBytes(depType: DepTypeLike): Bytes {
  return bytesFrom([DEP_TYPE_TO_NUM[depTypeFrom(depType)]]);
}

/**
 * Converts a byte-like value to a DepType.
 * @public
 *
 * @param bytes - The byte-like value to convert.
 * @returns The corresponding DepType.
 *
 * @throws Will throw an error if the input bytes do not correspond to a valid dep type.
 *
 * @example
 * ```typescript
 * const depType = depTypeFromBytes(new Uint8Array([1])); // Outputs "code"
 * ```
 */

export function depTypeFromBytes(bytes: BytesLike): DepType {
  return NUM_TO_DEP_TYPE[bytesFrom(bytes)[0]];
}

/**
 * @public
 */
export type OutPointLike = {
  txHash: HexLike;
  index: NumLike;
};
/**
 * @public
 */
@mol.codec(
  mol.struct({
    txHash: mol.Byte32,
    index: mol.Uint32,
  }),
)
export class OutPoint extends mol.Entity.Base<OutPointLike, OutPoint>() {
  /**
   * Creates an instance of OutPoint.
   *
   * @param txHash - The transaction hash.
   * @param index - The index of the output in the transaction.
   */

  constructor(
    public txHash: Hex,
    public index: Num,
  ) {
    super();
  }

  /**
   * Creates an OutPoint instance from an OutPointLike object.
   *
   * @param outPoint - An OutPointLike object or an instance of OutPoint.
   * @returns An OutPoint instance.
   *
   * @example
   * ```typescript
   * const outPoint = OutPoint.from({ txHash: "0x...", index: 0 });
   * ```
   */
  static from(outPoint: OutPointLike): OutPoint {
    if (outPoint instanceof OutPoint) {
      return outPoint;
    }
    return new OutPoint(hexFrom(outPoint.txHash), numFrom(outPoint.index));
  }
}

/**
 * @public
 */
export type CellOutputLike = {
  capacity: NumLike;
  lock: ScriptLike;
  type?: ScriptLike | null;
};
/**
 * @public
 */
@mol.codec(
  mol.table({
    capacity: mol.Uint64,
    lock: Script,
    type: ScriptOpt,
  }),
)
export class CellOutput extends mol.Entity.Base<CellOutputLike, CellOutput>() {
  /**
   * Creates an instance of CellOutput.
   *
   * @param capacity - The capacity of the cell.
   * @param lock - The lock script of the cell.
   * @param type - The optional type script of the cell.
   */

  constructor(
    public capacity: Num,
    public lock: Script,
    public type?: Script,
  ) {
    super();
  }

  get occupiedSize(): number {
    return 8 + this.lock.occupiedSize + (this.type?.occupiedSize ?? 0);
  }

  /**
   * Creates a CellOutput instance from a CellOutputLike object.
   * This method supports automatic capacity calculation when capacity is 0 or omitted.
   *
   * @param cellOutput - A CellOutputLike object or an instance of CellOutput.
   *                     Can also be an object without capacity when outputData is provided.
   * @param outputData - Optional output data used for automatic capacity calculation.
   *                     When provided and capacity is 0, the capacity will be calculated
   *                     as occupiedSize + outputData.length.
   * @returns A CellOutput instance.
   *
   * @example
   * ```typescript
   * // Basic usage with explicit capacity
   * const cellOutput1 = CellOutput.from({
   *   capacity: 1000n,
   *   lock: { codeHash: "0x...", hashType: "type", args: "0x..." },
   *   type: { codeHash: "0x...", hashType: "type", args: "0x..." }
   * });
   *
   * // Automatic capacity calculation
   * const cellOutput2 = CellOutput.from({
   *   lock: { codeHash: "0x...", hashType: "type", args: "0x..." }
   * }, "0x1234"); // Capacity will be calculated automatically
   * ```
   */
  static from(cellOutput: CellOutputLike, outputData?: HexLike): CellOutput;
  static from(
    cellOutput: Omit<CellOutputLike, "capacity"> &
      Partial<Pick<CellOutputLike, "capacity">>,
    outputData: HexLike,
  ): CellOutput;
  static from(
    cellOutput: Omit<CellOutputLike, "capacity"> &
      Partial<Pick<CellOutputLike, "capacity">>,
    outputData?: HexLike,
  ): CellOutput {
    if (cellOutput instanceof CellOutput) {
      return cellOutput;
    }

    const output = new CellOutput(
      numFrom(cellOutput.capacity ?? 0),
      Script.from(cellOutput.lock),
      apply(Script.from, cellOutput.type),
    );

    if (output.capacity === Zero) {
      output.capacity = fixedPointFrom(
        output.occupiedSize + bytesFrom(outputData as HexLike).length,
      );
    }

    return output;
  }
}
export const CellOutputVec = mol.vector(CellOutput);

/**
 * @public
 */
export type CellLike = (
  | {
      outPoint: OutPointLike;
    }
  | { previousOutput: OutPointLike }
) & {
  cellOutput: CellOutputLike;
  outputData: HexLike;
};
/**
 * @public
 */
export class Cell {
  /**
   * Creates an instance of Cell.
   *
   * @param outPoint - The output point of the cell.
   * @param cellOutput - The cell output of the cell.
   * @param outputData - The output data of the cell.
   */

  constructor(
    public outPoint: OutPoint,
    public cellOutput: CellOutput,
    public outputData: Hex,
  ) {}

  /**
   * Creates a Cell instance from a CellLike object.
   * This method accepts either `outPoint` or `previousOutput` to specify the cell's location,
   * and supports automatic capacity calculation for the cell output.
   *
   * @param cell - A CellLike object or an instance of Cell. The object can use either:
   *               - `outPoint`: For referencing a cell output
   *               - `previousOutput`: For referencing a cell input (alternative name for outPoint)
   *               The cellOutput can omit capacity for automatic calculation.
   * @returns A Cell instance.
   *
   * @example
   * ```typescript
   * // Using outPoint with explicit capacity
   * const cell1 = Cell.from({
   *   outPoint: { txHash: "0x...", index: 0 },
   *   cellOutput: {
   *     capacity: 1000n,
   *     lock: { codeHash: "0x...", hashType: "type", args: "0x..." }
   *   },
   *   outputData: "0x"
   * });
   *
   * // Using previousOutput with automatic capacity calculation
   * const cell2 = Cell.from({
   *   previousOutput: { txHash: "0x...", index: 0 },
   *   cellOutput: {
   *     lock: { codeHash: "0x...", hashType: "type", args: "0x..." }
   *     // capacity will be calculated automatically
   *   },
   *   outputData: "0x1234"
   * });
   * ```
   */

  static from(cell: CellLike): Cell {
    if (cell instanceof Cell) {
      return cell;
    }

    return new Cell(
      OutPoint.from("outPoint" in cell ? cell.outPoint : cell.previousOutput),
      CellOutput.from(cell.cellOutput, cell.outputData),
      hexFrom(cell.outputData),
    );
  }

  get capacityFree() {
    const occupiedSize = fixedPointFrom(
      this.cellOutput.occupiedSize + bytesFrom(this.outputData).length,
    );
    return this.cellOutput.capacity - occupiedSize;
  }

  /**
   * Occupied bytes of a cell on chain
   * It's CellOutput.occupiedSize + bytesFrom(outputData).byteLength
   */
  get occupiedSize() {
    return this.cellOutput.occupiedSize + bytesFrom(this.outputData).byteLength;
  }

  /**
   * Gets confirmed Nervos DAO profit of a Cell
   * It returns non-zero value only when the cell is in withdrawal phase 2
   * See https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0023-dao-deposit-withdraw/0023-dao-deposit-withdraw.md
   *
   * @param client - A client for searching DAO related headers
   * @returns Profit
   *
   * @example
   * ```typescript
   * const profit = await cell.getDaoProfit(client);
   * ```
   */
  async getDaoProfit(client: Client): Promise<Num> {
    if (!(await this.isNervosDao(client, "withdrew"))) {
      return Zero;
    }

    const { depositHeader, withdrawHeader } =
      await this.getNervosDaoInfo(client);
    if (!withdrawHeader || !depositHeader) {
      throw new Error(
        `Unable to get headers of a Nervos DAO cell ${this.outPoint.txHash}:${this.outPoint.index.toString()}`,
      );
    }

    return calcDaoProfit(this.capacityFree, depositHeader, withdrawHeader);
  }

  async isNervosDao(
    client: Client,
    phase?: "deposited" | "withdrew",
  ): Promise<boolean> {
    const { type } = this.cellOutput;

    const daoType = await client.getKnownScript(KnownScript.NervosDao);
    if (
      !type ||
      type.codeHash !== daoType.codeHash ||
      type.hashType !== daoType.hashType
    ) {
      // Non Nervos DAO cell
      return false;
    }

    const hasWithdrew = numFrom(this.outputData) !== Zero;
    return (
      !phase ||
      (phase === "deposited" && !hasWithdrew) ||
      (phase === "withdrew" && hasWithdrew)
    );
  }

  async getNervosDaoInfo(client: Client): Promise<
    // Non Nervos DAO cell
    | {
        depositHeader?: undefined;
        withdrawHeader?: undefined;
      }
    // Deposited Nervos DAO cell
    | {
        depositHeader: ClientBlockHeader;
        withdrawHeader?: undefined;
      }
    // Withdrew Nervos DAO cell
    | {
        depositHeader: ClientBlockHeader;
        withdrawHeader: ClientBlockHeader;
      }
  > {
    if (!(await this.isNervosDao(client))) {
      // Non Nervos DAO cell
      return {};
    }

    if (numFrom(this.outputData) === Zero) {
      // Deposited Nervos DAO cell
      const depositRes = await client.getCellWithHeader(this.outPoint);
      if (!depositRes?.header) {
        throw new Error(
          `Unable to get header of a Nervos DAO deposited cell ${this.outPoint.txHash}:${this.outPoint.index.toString()}`,
        );
      }

      return {
        depositHeader: depositRes.header,
      };
    }

    // Withdrew Nervos DAO cell
    const [depositHeader, withdrawRes] = await Promise.all([
      client.getHeaderByNumber(numFromBytes(this.outputData)),
      client.getCellWithHeader(this.outPoint),
    ]);
    if (!withdrawRes?.header || !depositHeader) {
      throw new Error(
        `Unable to get headers of a Nervos DAO withdrew cell ${this.outPoint.txHash}:${this.outPoint.index.toString()}`,
      );
    }

    return {
      depositHeader,
      withdrawHeader: withdrawRes.header,
    };
  }

  /**
   * Clone a Cell
   *
   * @returns A cloned Cell instance.
   *
   * @example
   * ```typescript
   * const cell1 = cell0.clone();
   * ```
   */
  clone(): Cell {
    return new Cell(
      this.outPoint.clone(),
      this.cellOutput.clone(),
      this.outputData,
    );
  }
}

/**
 * @public
 */
export type EpochLike = [NumLike, NumLike, NumLike];
/**
 * @public
 */
export type Epoch = [Num, Num, Num];
/**
 * @public
 */
export function epochFrom(epochLike: EpochLike): Epoch {
  return [numFrom(epochLike[0]), numFrom(epochLike[1]), numFrom(epochLike[2])];
}
/**
 * @public
 */
export function epochFromHex(hex: HexLike): Epoch {
  const num = numFrom(hexFrom(hex));

  return [
    num & numFrom("0xffffff"),
    (num >> numFrom(24)) & numFrom("0xffff"),
    (num >> numFrom(40)) & numFrom("0xffff"),
  ];
}
/**
 * @public
 */
export function epochToHex(epochLike: EpochLike): Hex {
  const epoch = epochFrom(epochLike);

  return numToHex(
    numFrom(epoch[0]) +
      (numFrom(epoch[1]) << numFrom(24)) +
      (numFrom(epoch[2]) << numFrom(40)),
  );
}

/**
 * @public
 */
export type SinceLike =
  | {
      relative: "absolute" | "relative";
      metric: "blockNumber" | "epoch" | "timestamp";
      value: NumLike;
    }
  | NumLike;
/**
 * @public
 */
@mol.codec(
  mol.Uint64.mapIn((encodable: SinceLike) => Since.from(encodable).toNum()),
)
export class Since extends mol.Entity.Base<SinceLike, Since>() {
  /**
   * Creates an instance of Since.
   *
   * @param relative - Absolute or relative
   * @param metric - The metric of since
   * @param value - The value of since
   */

  constructor(
    public relative: "absolute" | "relative",
    public metric: "blockNumber" | "epoch" | "timestamp",
    public value: Num,
  ) {
    super();
  }

  /**
   * Clone a Since.
   *
   * @returns A cloned Since instance.
   *
   * @example
   * ```typescript
   * const since1 = since0.clone();
   * ```
   */
  clone(): Since {
    return new Since(this.relative, this.metric, this.value);
  }

  /**
   * Creates a Since instance from a SinceLike object.
   *
   * @param since - A SinceLike object or an instance of Since.
   * @returns A Since instance.
   *
   * @example
   * ```typescript
   * const since = Since.from("0x1234567812345678");
   * ```
   */
  static from(since: SinceLike): Since {
    if (since instanceof Since) {
      return since;
    }

    if (typeof since === "object" && "relative" in since) {
      return new Since(since.relative, since.metric, numFrom(since.value));
    }

    return Since.fromNum(since);
  }

  /**
   * Converts the Since instance to num.
   *
   * @returns A num
   *
   * @example
   * ```typescript
   * const num = since.toNum();
   * ```
   */

  toNum(): Num {
    return (
      this.value |
      (this.relative === "absolute" ? Zero : numFrom("0x8000000000000000")) |
      {
        blockNumber: numFrom("0x0000000000000000"),
        epoch: numFrom("0x2000000000000000"),
        timestamp: numFrom("0x4000000000000000"),
      }[this.metric]
    );
  }

  /**
   * Creates a Since instance from a num-like value.
   *
   * @param numLike - The num-like value to convert.
   * @returns A Since instance.
   *
   * @example
   * ```typescript
   * const since = Since.fromNum("0x0");
   * ```
   */

  static fromNum(numLike: NumLike): Since {
    const num = numFrom(numLike);

    const relative = num >> numFrom(63) === Zero ? "absolute" : "relative";
    const metric = (["blockNumber", "epoch", "timestamp"] as Since["metric"][])[
      Number((num >> numFrom(61)) & numFrom(3))
    ];
    const value = num & numFrom("0x00ffffffffffffff");

    return new Since(relative, metric, value);
  }
}

/**
 * @public
 */
export type CellInputLike = (
  | {
      previousOutput: OutPointLike;
    }
  | { outPoint: OutPointLike }
) & {
  since?: SinceLike | NumLike | null;
  cellOutput?: CellOutputLike | null;
  outputData?: HexLike | null;
};
/**
 * @public
 */
@mol.codec(
  mol
    .struct({
      since: Since,
      previousOutput: OutPoint,
    })
    .mapIn((encodable: CellInputLike) => CellInput.from(encodable)),
)
export class CellInput extends mol.Entity.Base<CellInputLike, CellInput>() {
  /**
   * Creates an instance of CellInput.
   *
   * @param previousOutput - The previous outpoint of the cell.
   * @param since - The since value of the cell input.
   * @param cellOutput - The optional cell output associated with the cell input.
   * @param outputData - The optional output data associated with the cell input.
   */

  constructor(
    public previousOutput: OutPoint,
    public since: Num,
    public cellOutput?: CellOutput,
    public outputData?: Hex,
  ) {
    super();
  }

  /**
   * Creates a CellInput instance from a CellInputLike object.
   *
   * @param cellInput - A CellInputLike object or an instance of CellInput.
   * @returns A CellInput instance.
   *
   * @example
   * ```typescript
   * const cellInput = CellInput.from({
   *   previousOutput: { txHash: "0x...", index: 0 },
   *   since: 0n
   * });
   * ```
   */
  static from(cellInput: CellInputLike): CellInput {
    if (cellInput instanceof CellInput) {
      return cellInput;
    }

    return new CellInput(
      OutPoint.from(
        "previousOutput" in cellInput
          ? cellInput.previousOutput
          : cellInput.outPoint,
      ),
      Since.from(cellInput.since ?? 0).toNum(),
      apply(CellOutput.from, cellInput.cellOutput),
      apply(hexFrom, cellInput.outputData),
    );
  }

  async getCell(client: Client): Promise<Cell> {
    await this.completeExtraInfos(client);
    if (!this.cellOutput || !this.outputData) {
      throw new Error("Unable to complete input");
    }

    return Cell.from({
      outPoint: this.previousOutput,
      cellOutput: this.cellOutput,
      outputData: this.outputData,
    });
  }

  /**
   * Complete extra infos in the input. Including
   * - Previous cell output
   * - Previous cell data
   * The instance will be modified.
   *
   * @returns true if succeed.
   * @example
   * ```typescript
   * await cellInput.completeExtraInfos(client);
   * ```
   */
  async completeExtraInfos(client: Client): Promise<void> {
    if (this.cellOutput && this.outputData) {
      return;
    }

    const cell = await client.getCell(this.previousOutput);
    if (!cell) {
      return;
    }

    this.cellOutput = cell.cellOutput;
    this.outputData = cell.outputData;
  }

  /**
   * The extra capacity created when consume this input.
   * This is usually NervosDAO interest, see https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0023-dao-deposit-withdraw/0023-dao-deposit-withdraw.md.
   * And it can also be miners' income. (But this is not implemented yet)
   */
  async getExtraCapacity(client: Client): Promise<Num> {
    return (await this.getCell(client)).getDaoProfit(client);
  }

  clone(): CellInput {
    const cloned = super.clone();
    cloned.cellOutput = this.cellOutput?.clone();
    cloned.outputData = this.outputData;

    return cloned;
  }
}
export const CellInputVec = mol.vector(CellInput);

/**
 * @public
 */
export type CellDepLike = {
  outPoint: OutPointLike;
  depType: DepTypeLike;
};
/**
 * @public
 */
@mol.codec(
  mol.struct({
    outPoint: OutPoint,
    depType: DepTypeCodec,
  }),
)
export class CellDep extends mol.Entity.Base<CellDepLike, CellDep>() {
  /**
   * Creates an instance of CellDep.
   *
   * @param outPoint - The outpoint of the cell dependency.
   * @param depType - The dependency type.
   */

  constructor(
    public outPoint: OutPoint,
    public depType: DepType,
  ) {
    super();
  }

  /**
   * Creates a CellDep instance from a CellDepLike object.
   *
   * @param cellDep - A CellDepLike object or an instance of CellDep.
   * @returns A CellDep instance.
   *
   * @example
   * ```typescript
   * const cellDep = CellDep.from({
   *   outPoint: { txHash: "0x...", index: 0 },
   *   depType: "depGroup"
   * });
   * ```
   */

  static from(cellDep: CellDepLike): CellDep {
    if (cellDep instanceof CellDep) {
      return cellDep;
    }

    return new CellDep(
      OutPoint.from(cellDep.outPoint),
      depTypeFrom(cellDep.depType),
    );
  }
}
export const CellDepVec = mol.vector(CellDep);

/**
 * @public
 */
export type WitnessArgsLike = {
  lock?: HexLike | null;
  inputType?: HexLike | null;
  outputType?: HexLike | null;
};
/**
 * @public
 */
@mol.codec(
  mol.table({
    lock: mol.BytesOpt,
    inputType: mol.BytesOpt,
    outputType: mol.BytesOpt,
  }),
)
export class WitnessArgs extends mol.Entity.Base<
  WitnessArgsLike,
  WitnessArgs
>() {
  /**
   * Creates an instance of WitnessArgs.
   *
   * @param lock - The optional lock field of the witness.
   * @param inputType - The optional input type field of the witness.
   * @param outputType - The optional output type field of the witness.
   */

  constructor(
    public lock?: Hex,
    public inputType?: Hex,
    public outputType?: Hex,
  ) {
    super();
  }

  /**
   * Creates a WitnessArgs instance from a WitnessArgsLike object.
   *
   * @param witnessArgs - A WitnessArgsLike object or an instance of WitnessArgs.
   * @returns A WitnessArgs instance.
   *
   * @example
   * ```typescript
   * const witnessArgs = WitnessArgs.from({
   *   lock: "0x...",
   *   inputType: "0x...",
   *   outputType: "0x..."
   * });
   * ```
   */

  static from(witnessArgs: WitnessArgsLike): WitnessArgs {
    if (witnessArgs instanceof WitnessArgs) {
      return witnessArgs;
    }

    return new WitnessArgs(
      apply(hexFrom, witnessArgs.lock),
      apply(hexFrom, witnessArgs.inputType),
      apply(hexFrom, witnessArgs.outputType),
    );
  }
}

/**
 * Convert a bytes to a num.
 *
 * @public
 */
export function udtBalanceFrom(dataLike: BytesLike): Num {
  const data = bytesFrom(dataLike).slice(0, 16);
  return data.length === 0 ? Zero : numFromBytes(data);
}

export const RawTransaction = mol.table({
  version: mol.Uint32,
  cellDeps: CellDepVec,
  headerDeps: mol.Byte32Vec,
  inputs: CellInputVec,
  outputs: CellOutputVec,
  outputsData: mol.BytesVec,
});

/**
 * @public
 */
export type TransactionLike = {
  version?: NumLike | null;
  cellDeps?: CellDepLike[] | null;
  headerDeps?: HexLike[] | null;
  inputs?: CellInputLike[] | null;
  outputs?:
    | (Omit<CellOutputLike, "capacity"> &
        Partial<Pick<CellOutputLike, "capacity">>)[]
    | null;
  outputsData?: HexLike[] | null;
  witnesses?: HexLike[] | null;
};
/**
 * @public
 */
@mol.codec(
  mol
    .table({
      raw: RawTransaction,
      witnesses: mol.BytesVec,
    })
    .mapIn((txLike: TransactionLike) => {
      const tx = Transaction.from(txLike);
      return {
        raw: tx,
        witnesses: tx.witnesses,
      };
    })
    .mapOut((tx) => Transaction.from({ ...tx.raw, witnesses: tx.witnesses })),
)
export class Transaction extends mol.Entity.Base<
  TransactionLike,
  Transaction
>() {
  /**
   * Creates an instance of Transaction.
   *
   * @param version - The version of the transaction.
   * @param cellDeps - The cell dependencies of the transaction.
   * @param headerDeps - The header dependencies of the transaction.
   * @param inputs - The inputs of the transaction.
   * @param outputs - The outputs of the transaction.
   * @param outputsData - The data associated with the outputs.
   * @param witnesses - The witnesses of the transaction.
   */

  constructor(
    public version: Num,
    public cellDeps: CellDep[],
    public headerDeps: Hex[],
    public inputs: CellInput[],
    public outputs: CellOutput[],
    public outputsData: Hex[],
    public witnesses: Hex[],
  ) {
    super();
  }

  /**
   * Creates a default Transaction instance with empty fields.
   *
   * @returns A default Transaction instance.
   *
   * @example
   * ```typescript
   * const defaultTx = Transaction.default();
   * ```
   */
  static default(): Transaction {
    return new Transaction(0n, [], [], [], [], [], []);
  }

  /**
   * Copy every properties from another transaction.
   * This method replaces all properties of the current transaction with those from the provided transaction.
   *
   * @param txLike - The transaction-like object to copy properties from.
   *
   * @example
   * ```typescript
   * this.copy(Transaction.default());
   * ```
   */
  copy(txLike: TransactionLike) {
    const tx = Transaction.from(txLike);
    this.version = tx.version;
    this.cellDeps = tx.cellDeps;
    this.headerDeps = tx.headerDeps;
    this.inputs = tx.inputs;
    this.outputs = tx.outputs;
    this.outputsData = tx.outputsData;
    this.witnesses = tx.witnesses;
  }

  /**
   * Creates a deep copy of the transaction.
   * This method creates a new Transaction instance with all nested objects cloned,
   * ensuring that modifications to the cloned transaction do not affect the original.
   *
   * @returns A new Transaction instance that is a deep copy of the current transaction.
   *
   * @example
   * ```typescript
   * const originalTx = Transaction.from({
   *   version: 0,
   *   inputs: [{ previousOutput: { txHash: "0x...", index: 0 } }],
   *   outputs: [{ capacity: 1000n, lock: lockScript }],
   *   outputsData: ["0x"],
   *   witnesses: ["0x"]
   * });
   *
   * const clonedTx = originalTx.clone();
   *
   * // Modifications to clonedTx won't affect originalTx
   * clonedTx.addOutput({ capacity: 2000n, lock: anotherLockScript });
   * console.log(originalTx.outputs.length); // Still 1
   * console.log(clonedTx.outputs.length);   // Now 2
   * ```
   *
   * @remarks
   * The clone operation performs deep copying for:
   * - Cell dependencies (cellDeps) - each CellDep is cloned
   * - Inputs - each CellInput is cloned
   * - Outputs - each CellOutput is cloned
   *
   * The following are shallow copied (references to immutable data):
   * - Header dependencies (headerDeps) - Hex strings are immutable
   * - Output data (outputsData) - Hex strings are immutable
   * - Witnesses - Hex strings are immutable
   * - Version - bigint is immutable
   */
  clone(): Transaction {
    return new Transaction(
      this.version,
      this.cellDeps.map((c) => c.clone()),
      this.headerDeps.map((h) => h),
      this.inputs.map((i) => i.clone()),
      this.outputs.map((o) => o.clone()),
      this.outputsData.map((o) => o),
      this.witnesses.map((w) => w),
    );
  }

  /**
   * Creates a Transaction instance from a TransactionLike object.
   *
   * @param tx - A TransactionLike object or an instance of Transaction.
   * @returns A Transaction instance.
   *
   * @example
   * ```typescript
   * const transaction = Transaction.from({
   *   version: 0,
   *   cellDeps: [],
   *   headerDeps: [],
   *   inputs: [],
   *   outputs: [],
   *   outputsData: [],
   *   witnesses: []
   * });
   * ```
   */

  static from(tx: TransactionLike): Transaction {
    if (tx instanceof Transaction) {
      return tx;
    }
    const outputs =
      tx.outputs?.map((output, i) =>
        CellOutput.from(output, tx.outputsData?.[i] ?? []),
      ) ?? [];
    const outputsData = outputs.map((_, i) =>
      hexFrom(tx.outputsData?.[i] ?? "0x"),
    );
    if (tx.outputsData != null && outputsData.length < tx.outputsData.length) {
      outputsData.push(
        ...tx.outputsData.slice(outputsData.length).map((d) => hexFrom(d)),
      );
    }

    return new Transaction(
      numFrom(tx.version ?? 0),
      tx.cellDeps?.map((cellDep) => CellDep.from(cellDep)) ?? [],
      tx.headerDeps?.map(hexFrom) ?? [],
      tx.inputs?.map((input) => CellInput.from(input)) ?? [],
      outputs,
      outputsData,
      tx.witnesses?.map(hexFrom) ?? [],
    );
  }

  /**
   * Creates a Transaction instance from a Lumos skeleton.
   *
   * @param skeleton - The Lumos transaction skeleton.
   * @returns A Transaction instance.
   *
   * @throws Will throw an error if an input's outPoint is missing.
   *
   * @example
   * ```typescript
   * const transaction = Transaction.fromLumosSkeleton(skeleton);
   * ```
   */

  static fromLumosSkeleton(
    skeleton: LumosTransactionSkeletonType,
  ): Transaction {
    return Transaction.from({
      version: 0n,
      cellDeps: skeleton.cellDeps.toArray(),
      headerDeps: skeleton.headerDeps.toArray(),
      inputs: skeleton.inputs.toArray().map((input, i) => {
        if (!input.outPoint) {
          throw new Error("outPoint is required in input");
        }

        return CellInput.from({
          previousOutput: input.outPoint,
          since: skeleton.inputSinces.get(i, "0x0"),
          cellOutput: input.cellOutput,
          outputData: input.data,
        });
      }),
      outputs: skeleton.outputs.toArray().map((output) => output.cellOutput),
      outputsData: skeleton.outputs.toArray().map((output) => output.data),
      witnesses: skeleton.witnesses.toArray(),
    });
  }

  /**
   * @deprecated
   * Use ccc.stringify instead.
   * stringify the tx to JSON string.
   */
  stringify(): string {
    return JSON.stringify(this, (_, value) => {
      if (typeof value === "bigint") {
        return numToHex(value);
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value;
    });
  }

  /**
   * Converts the raw transaction data to bytes.
   *
   * @returns A Uint8Array containing the raw transaction bytes.
   *
   * @example
   * ```typescript
   * const rawTxBytes = transaction.rawToBytes();
   * ```
   */
  rawToBytes(): Bytes {
    return RawTransaction.encode(this);
  }

  /**
   * Calculates the hash of the transaction without witnesses. This is the transaction hash in the usual sense.
   * To calculate the hash of the whole transaction including the witnesses, use transaction.hashFull() instead.
   *
   * @returns The hash of the transaction.
   *
   * @example
   * ```typescript
   * const txHash = transaction.hash();
   * ```
   */
  hash(): Hex {
    return hashCkb(this.rawToBytes());
  }

  /**
   * Calculates the hash of the transaction with witnesses.
   *
   * @returns The hash of the transaction with witnesses.
   *
   * @example
   * ```typescript
   * const txFullHash = transaction.hashFull();
   * ```
   */
  hashFull(): Hex {
    return hashCkb(this.toBytes());
  }

  /**
   * Hashes a witness and updates the hasher.
   *
   * @param witness - The witness to hash.
   * @param hasher - The hasher instance to update.
   *
   * @example
   * ```typescript
   * Transaction.hashWitnessToHasher("0x...", hasher);
   * ```
   */

  static hashWitnessToHasher(witness: HexLike, hasher: Hasher) {
    const raw = bytesFrom(hexFrom(witness));
    hasher.update(numToBytes(raw.length, 8));
    hasher.update(raw);
  }

  /**
   * Computes the signing hash information for a given script.
   *
   * @param scriptLike - The script associated with the transaction, represented as a ScriptLike object.
   * @param client - The client for complete extra infos in the transaction.
   * @returns A promise that resolves to an object containing the signing message and the witness position,
   *          or undefined if no matching input is found.
   *
   * @example
   * ```typescript
   * const signHashInfo = await tx.getSignHashInfo(scriptLike, client);
   * if (signHashInfo) {
   *   console.log(signHashInfo.message); // Outputs the signing message
   *   console.log(signHashInfo.position); // Outputs the witness position
   * }
   * ```
   */
  async getSignHashInfo(
    scriptLike: ScriptLike,
    client: Client,
    hasher: Hasher = new HasherCkb(),
  ): Promise<{ message: Hex; position: number } | undefined> {
    const script = Script.from(scriptLike);
    let position = -1;
    hasher.update(this.hash());

    for (let i = 0; i < this.witnesses.length; i += 1) {
      const input = this.inputs[i];
      if (input) {
        const { cellOutput } = await input.getCell(client);

        if (!script.eq(cellOutput.lock)) {
          continue;
        }

        if (position === -1) {
          position = i;
        }
      }

      if (position === -1) {
        return undefined;
      }

      Transaction.hashWitnessToHasher(this.witnesses[i], hasher);
    }

    if (position === -1) {
      return undefined;
    }

    return {
      message: hasher.digest(),
      position,
    };
  }

  /**
   * Find the first occurrence of a input with the specified lock id
   *
   * @param scriptIdLike - The script associated with the transaction, represented as a ScriptLike object without args.
   * @param client - The client for complete extra infos in the transaction.
   * @returns A promise that resolves to the found index
   *
   * @example
   * ```typescript
   * const index = await tx.findInputIndexByLockId(scriptIdLike, client);
   * ```
   */
  async findInputIndexByLockId(
    scriptIdLike: Pick<ScriptLike, "codeHash" | "hashType">,
    client: Client,
  ): Promise<number | undefined> {
    const script = Script.from({ ...scriptIdLike, args: "0x" });

    for (let i = 0; i < this.inputs.length; i += 1) {
      const { cellOutput } = await this.inputs[i].getCell(client);

      if (
        script.codeHash === cellOutput.lock.codeHash &&
        script.hashType === cellOutput.lock.hashType
      ) {
        return i;
      }
    }
  }

  /**
   * Find the first occurrence of a input with the specified lock
   *
   * @param scriptLike - The script associated with the transaction, represented as a ScriptLike object.
   * @param client - The client for complete extra infos in the transaction.
   * @returns A promise that resolves to the found index, or undefined if no matching input is found.
   *
   * @example
   * ```typescript
   * const index = await tx.findInputIndexByLock(scriptLike, client);
   * ```
   */
  async findInputIndexByLock(
    scriptLike: ScriptLike,
    client: Client,
  ): Promise<number | undefined> {
    const script = Script.from(scriptLike);

    for (let i = 0; i < this.inputs.length; i += 1) {
      const { cellOutput } = await this.inputs[i].getCell(client);

      if (script.eq(cellOutput.lock)) {
        return i;
      }
    }
  }

  /**
   * Find the last occurrence of a input with the specified lock
   *
   * @param scriptLike - The script associated with the transaction, represented as a ScriptLike object.
   * @param client - The client for complete extra infos in the transaction.
   * @returns A promise that resolves to the found index, or undefined if no matching input is found.
   *
   * @example
   * ```typescript
   * const index = await tx.findLastInputIndexByLock(scriptLike, client);
   * ```
   */
  async findLastInputIndexByLock(
    scriptLike: ScriptLike,
    client: Client,
  ): Promise<number | undefined> {
    const script = Script.from(scriptLike);

    for (let i = this.inputs.length - 1; i >= 0; i -= 1) {
      const { cellOutput } = await this.inputs[i].getCell(client);

      if (script.eq(cellOutput.lock)) {
        return i;
      }
    }
  }

  /**
   * Add cell deps if they are not existed
   *
   * @param cellDepLikes - The cell deps to add
   *
   * @example
   * ```typescript
   * tx.addCellDeps(cellDep);
   * ```
   */
  addCellDeps(...cellDepLikes: (CellDepLike | CellDepLike[])[]): void {
    cellDepLikes.flat().forEach((cellDepLike) => {
      const cellDep = CellDep.from(cellDepLike);
      if (this.cellDeps.some((c) => c.eq(cellDep))) {
        return;
      }

      this.cellDeps.push(cellDep);
    });
  }

  /**
   * Add cell deps at the start if they are not existed
   *
   * @param cellDepLikes - The cell deps to add
   *
   * @example
   * ```typescript
   * tx.addCellDepsAtBegin(cellDep);
   * ```
   */
  addCellDepsAtStart(...cellDepLikes: (CellDepLike | CellDepLike[])[]): void {
    cellDepLikes.flat().forEach((cellDepLike) => {
      const cellDep = CellDep.from(cellDepLike);
      if (this.cellDeps.some((c) => c.eq(cellDep))) {
        return;
      }

      this.cellDeps.unshift(cellDep);
    });
  }

  /**
   * Add cell dep from infos if they are not existed
   *
   * @param client - A client for searching cell deps
   * @param cellDepInfoLikes - The cell dep infos to add
   *
   * @example
   * ```typescript
   * tx.addCellDepInfos(client, cellDepInfos);
   * ```
   */
  async addCellDepInfos(
    client: Client,
    ...cellDepInfoLikes: (CellDepInfoLike | CellDepInfoLike[])[]
  ): Promise<void> {
    this.addCellDeps(await client.getCellDeps(...cellDepInfoLikes));
  }

  /**
   * Add cell deps from known script
   *
   * @param client - The client for searching known script and cell deps
   * @param scripts - The known scripts to add
   *
   * @example
   * ```typescript
   * tx.addCellDepsOfKnownScripts(client, KnownScript.OmniLock);
   * ```
   */
  async addCellDepsOfKnownScripts(
    client: Client,
    ...scripts: (KnownScript | KnownScript[])[]
  ): Promise<void> {
    await Promise.all(
      scripts
        .flat()
        .map(async (script) =>
          this.addCellDepInfos(
            client,
            (await client.getKnownScript(script)).cellDeps,
          ),
        ),
    );
  }

  /**
   * Set output data at index.
   *
   * @param index - The index of the output data.
   * @param data - The data to set.
   *
   * @example
   * ```typescript
   * tx.setOutputDataAt(0, "0x00");
   * ```
   */
  setOutputDataAt(index: number, data: HexLike): void {
    if (this.outputsData.length < index) {
      this.outputsData.push(
        ...Array.from(
          new Array(index - this.outputsData.length),
          (): Hex => "0x",
        ),
      );
    }

    this.outputsData[index] = hexFrom(data);
  }

  /**
   * get input
   *
   * @param index - The cell input index
   *
   * @example
   * ```typescript
   * await tx.getInput(0);
   * ```
   */
  getInput(index: NumLike): CellInput | undefined {
    return this.inputs[Number(numFrom(index))];
  }
  /**
   * add input
   *
   * @param inputLike - The cell input.
   *
   * @example
   * ```typescript
   * await tx.addInput({ });
   * ```
   */
  addInput(inputLike: CellInputLike): number {
    if (this.witnesses.length > this.inputs.length) {
      this.witnesses.splice(this.inputs.length, 0, "0x");
    }

    return this.inputs.push(CellInput.from(inputLike));
  }

  /**
   * get output
   *
   * @param index - The cell output index
   *
   * @example
   * ```typescript
   * await tx.getOutput(0);
   * ```
   */
  getOutput(index: NumLike):
    | {
        cellOutput: CellOutput;
        outputData: Hex;
      }
    | undefined {
    const i = Number(numFrom(index));
    if (i >= this.outputs.length) {
      return;
    }
    return {
      cellOutput: this.outputs[i],
      outputData: this.outputsData[i] ?? "0x",
    };
  }
  /**
   * Add output
   *
   * @param outputLike - The cell output to add
   * @param outputData - optional output data
   *
   * @example
   * ```typescript
   * await tx.addOutput(cellOutput, "0xabcd");
   * ```
   */
  addOutput(
    outputLike: Omit<CellOutputLike, "capacity"> &
      Partial<Pick<CellOutputLike, "capacity">>,
    outputData: HexLike = "0x",
  ): number {
    const len = this.outputs.push(CellOutput.from(outputLike, outputData));
    this.setOutputDataAt(len - 1, outputData);

    return len;
  }

  /**
   * Get witness at index as WitnessArgs
   *
   * @param index - The index of the witness.
   * @returns The witness parsed as WitnessArgs.
   *
   * @example
   * ```typescript
   * const witnessArgs = await tx.getWitnessArgsAt(0);
   * ```
   */
  getWitnessArgsAt(index: number): WitnessArgs | undefined {
    const rawWitness = this.witnesses[index];
    return (rawWitness ?? "0x") !== "0x"
      ? WitnessArgs.fromBytes(rawWitness)
      : undefined;
  }

  /**
   * Set witness at index by WitnessArgs
   *
   * @param index - The index of the witness.
   * @param witness - The WitnessArgs to set.
   *
   * @example
   * ```typescript
   * await tx.setWitnessArgsAt(0, witnessArgs);
   * ```
   */
  setWitnessArgsAt(index: number, witness: WitnessArgs): void {
    this.setWitnessAt(index, witness.toBytes());
  }

  /**
   * Set witness at index
   *
   * @param index - The index of the witness.
   * @param witness - The witness to set.
   *
   * @example
   * ```typescript
   * await tx.setWitnessAt(0, witness);
   * ```
   */
  setWitnessAt(index: number, witness: HexLike): void {
    if (this.witnesses.length < index) {
      this.witnesses.push(
        ...Array.from(
          new Array(index - this.witnesses.length),
          (): Hex => "0x",
        ),
      );
    }

    this.witnesses[index] = hexFrom(witness);
  }

  /**
   * Prepare dummy witness for sighash all method
   *
   * @param scriptLike - The script associated with the transaction, represented as a ScriptLike object.
   * @param lockLen - The length of dummy lock bytes.
   * @param client - The client for complete extra infos in the transaction.
   * @returns A promise that resolves to the prepared transaction
   *
   * @example
   * ```typescript
   * await tx.prepareSighashAllWitness(scriptLike, 85, client);
   * ```
   */
  async prepareSighashAllWitness(
    scriptLike: ScriptLike,
    lockLen: number,
    client: Client,
  ): Promise<void> {
    const position = await this.findInputIndexByLock(scriptLike, client);
    if (position === undefined) {
      return;
    }

    const witness = this.getWitnessArgsAt(position) ?? WitnessArgs.from({});
    witness.lock = hexFrom(Array.from(new Array(lockLen), () => 0));
    this.setWitnessArgsAt(position, witness);
  }

  async getInputsCapacityExtra(client: Client): Promise<Num> {
    return reduceAsync(
      this.inputs,
      async (acc, input) => acc + (await input.getExtraCapacity(client)),
      numFrom(0),
    );
  }

  // This also includes extra amount
  async getInputsCapacity(client: Client): Promise<Num> {
    return (
      (await reduceAsync(
        this.inputs,
        async (acc, input) => {
          const {
            cellOutput: { capacity },
          } = await input.getCell(client);

          return acc + capacity;
        },
        numFrom(0),
      )) + (await this.getInputsCapacityExtra(client))
    );
  }

  getOutputsCapacity(): Num {
    return this.outputs.reduce(
      (acc, { capacity }) => acc + capacity,
      numFrom(0),
    );
  }

  /**
   * @deprecated Use `Udt.getInputsBalance` from `@ckb-ccc/udt` instead
   * @param client
   * @param type
   * @returns
   */
  async getInputsUdtBalance(client: Client, type: ScriptLike): Promise<Num> {
    return reduceAsync(
      this.inputs,
      async (acc, input) => {
        const { cellOutput, outputData } = await input.getCell(client);
        if (!cellOutput.type?.eq(type)) {
          return;
        }

        return acc + udtBalanceFrom(outputData);
      },
      numFrom(0),
    );
  }

  /**
   * @deprecated Use `Udt.getOutputsBalance` from `@ckb-ccc/udt` instead
   * @param type
   * @returns
   */
  getOutputsUdtBalance(type: ScriptLike): Num {
    return this.outputs.reduce((acc, output, i) => {
      if (!output.type?.eq(type)) {
        return acc;
      }

      return acc + udtBalanceFrom(this.outputsData[i]);
    }, numFrom(0));
  }

  async completeInputs<T>(
    from: Signer,
    filter: ClientCollectableSearchKeyFilterLike,
    accumulator: (
      acc: T,
      v: Cell,
      i: number,
      array: Cell[],
    ) => Promise<T | undefined> | T | undefined,
    init: T,
  ): Promise<{
    addedCount: number;
    accumulated?: T;
  }> {
    const collectedCells = [];

    let acc: T = init;
    let fulfilled = false;
    for await (const cell of from.findCells(filter, true)) {
      if (
        this.inputs.some(({ previousOutput }) =>
          previousOutput.eq(cell.outPoint),
        )
      ) {
        continue;
      }
      const i = collectedCells.push(cell);
      const next = await Promise.resolve(
        accumulator(acc, cell, i - 1, collectedCells),
      );
      if (next === undefined) {
        fulfilled = true;
        break;
      }
      acc = next;
    }

    collectedCells.forEach((cell) => this.addInput(cell));
    if (fulfilled) {
      return {
        addedCount: collectedCells.length,
      };
    }

    return {
      addedCount: collectedCells.length,
      accumulated: acc,
    };
  }

  async completeInputsByCapacity(
    from: Signer,
    capacityTweak?: NumLike,
    filter?: ClientCollectableSearchKeyFilterLike,
  ): Promise<number> {
    const expectedCapacity =
      this.getOutputsCapacity() + numFrom(capacityTweak ?? 0);
    const inputsCapacity = await this.getInputsCapacity(from.client);
    if (inputsCapacity >= expectedCapacity) {
      return 0;
    }

    const { addedCount, accumulated } = await this.completeInputs(
      from,
      filter ?? {
        scriptLenRange: [0, 1],
        outputDataLenRange: [0, 1],
      },
      (acc, { cellOutput: { capacity } }) => {
        const sum = acc + capacity;
        return sum >= expectedCapacity ? undefined : sum;
      },
      inputsCapacity,
    );

    if (accumulated === undefined) {
      return addedCount;
    }

    throw new ErrorTransactionInsufficientCapacity(
      expectedCapacity - accumulated,
    );
  }

  async completeInputsAll(
    from: Signer,
    filter?: ClientCollectableSearchKeyFilterLike,
  ): Promise<number> {
    const { addedCount } = await this.completeInputs(
      from,
      filter ?? {
        scriptLenRange: [0, 1],
        outputDataLenRange: [0, 1],
      },
      (acc, { cellOutput: { capacity } }) => acc + capacity,
      Zero,
    );

    return addedCount;
  }

  /**
   * Complete inputs by UDT balance
   *
   * This method succeeds only if enough balance is collected.
   *
   * It will try to collect at least two inputs, even when the first input already contains enough balance, to avoid extra occupation fees introduced by the change cell. An edge case: If the first cell has the same amount as the output, a new cell is not needed.
   * @deprecated Use `Udt.completeInputsByBalance` from `@ckb-ccc/udt` instead
   * @param from - The signer to complete the inputs.
   * @param type - The type script of the UDT.
   * @param balanceTweak - The tweak of the balance.
   * @returns A promise that resolves to the number of inputs added.
   */
  async completeInputsByUdt(
    from: Signer,
    type: ScriptLike,
    balanceTweak?: NumLike,
  ): Promise<number> {
    const expectedBalance =
      this.getOutputsUdtBalance(type) + numFrom(balanceTweak ?? 0);
    if (expectedBalance === numFrom(0)) {
      return 0;
    }

    const [inputsBalance, inputsCount] = await reduceAsync(
      this.inputs,
      async ([balanceAcc, countAcc], input) => {
        const { cellOutput, outputData } = await input.getCell(from.client);
        if (!cellOutput.type?.eq(type)) {
          return;
        }

        return [balanceAcc + udtBalanceFrom(outputData), countAcc + 1];
      },
      [numFrom(0), 0],
    );

    if (
      inputsBalance === expectedBalance ||
      (inputsBalance >= expectedBalance && inputsCount >= 2)
    ) {
      return 0;
    }

    const { addedCount, accumulated } = await this.completeInputs(
      from,
      {
        script: type,
        outputDataLenRange: [16, numFrom("0xffffffff")],
      },
      (acc, { outputData }, _i, collected) => {
        const balance = udtBalanceFrom(outputData);
        const sum = acc + balance;
        return sum === expectedBalance ||
          (sum >= expectedBalance && inputsCount + collected.length >= 2)
          ? undefined
          : sum;
      },
      inputsBalance,
    );

    if (accumulated === undefined || accumulated >= expectedBalance) {
      return addedCount;
    }

    throw new ErrorTransactionInsufficientCoin(
      expectedBalance - accumulated,
      type,
    );
  }

  async completeInputsAddOne(
    from: Signer,
    filter?: ClientCollectableSearchKeyFilterLike,
  ): Promise<number> {
    const { addedCount, accumulated } = await this.completeInputs(
      from,
      filter ?? {
        scriptLenRange: [0, 1],
        outputDataLenRange: [0, 1],
      },
      () => undefined,
      true,
    );

    if (accumulated === undefined) {
      return addedCount;
    }

    throw new Error(`Insufficient CKB, need at least one new cell`);
  }

  async completeInputsAtLeastOne(
    from: Signer,
    filter?: ClientCollectableSearchKeyFilterLike,
  ): Promise<number> {
    if (this.inputs.length > 0) {
      return 0;
    }

    return this.completeInputsAddOne(from, filter);
  }

  async getFee(client: Client): Promise<Num> {
    return (await this.getInputsCapacity(client)) - this.getOutputsCapacity();
  }

  async getFeeRate(client: Client): Promise<Num> {
    return (
      ((await this.getFee(client)) * numFrom(1000)) /
      numFrom(this.toBytes().length + 4)
    );
  }

  estimateFee(feeRate: NumLike): Num {
    const txSize = this.toBytes().length + 4;
    // + 999 then / 1000 to ceil the calculated fee
    return (numFrom(txSize) * numFrom(feeRate) + numFrom(999)) / numFrom(1000);
  }

  /**
   * Completes the transaction fee by adding inputs and handling change outputs.
   * This method automatically calculates the required fee based on the transaction size and fee rate,
   * adds necessary inputs to cover the fee, and handles change outputs through the provided change function.
   *
   * @param from - The signer to complete inputs from and prepare the transaction.
   * @param change - A function that handles change capacity. It receives the transaction and excess capacity,
   *                 and should return the additional capacity needed (0 if change is handled successfully,
   *                 positive number if more capacity is needed for change cell creation).
   * @param expectedFeeRate - The expected fee rate in shannons per 1000 bytes. If not provided,
   *                          it will be fetched from the client.
   * @param filter - Optional filter for selecting cells when adding inputs.
   * @param options - Optional configuration object.
   * @param options.feeRateBlockRange - Block range for fee rate calculation when expectedFeeRate is not provided.
   * @param options.maxFeeRate - Maximum allowed fee rate.
   * @param options.shouldAddInputs - Whether to add inputs automatically. Defaults to true.
   * @returns A promise that resolves to a tuple containing:
   *          - The number of inputs added during the process
   *          - A boolean indicating whether change outputs were created (true) or fee was paid without change (false)
   *
   * @throws {ErrorTransactionInsufficientCapacity} When there's not enough capacity to cover the fee.
   * @throws {Error} When the change function doesn't properly handle the available capacity.
   *
   * @example
   * ```typescript
   * const [addedInputs, hasChange] = await tx.completeFee(
   *   signer,
   *   (tx, capacity) => {
   *     if (capacity >= 61_00000000n) { // Minimum for a change cell
   *       tx.addOutput({ capacity, lock: changeScript });
   *       return 0;
   *     }
   *     return 61_00000000n; // Need more capacity for change cell
   *   },
   *   1000n // 1000 shannons per 1000 bytes
   * );
   * ```
   */
  async completeFee(
    from: Signer,
    change: (tx: Transaction, capacity: Num) => Promise<NumLike> | NumLike,
    expectedFeeRate?: NumLike,
    filter?: ClientCollectableSearchKeyFilterLike,
    options?: {
      feeRateBlockRange?: NumLike;
      maxFeeRate?: NumLike;
      shouldAddInputs?: boolean;
    },
  ): Promise<[number, boolean]> {
    const feeRate =
      expectedFeeRate ??
      (await from.client.getFeeRate(options?.feeRateBlockRange, options));

    // Complete all inputs extra infos for cache
    await this.getInputsCapacity(from.client);

    let leastFee = Zero;
    let leastExtraCapacity = Zero;

    while (true) {
      const tx = this.clone();
      const collected = await (async () => {
        if (!(options?.shouldAddInputs ?? true)) {
          const fee =
            (await tx.getFee(from.client)) - leastFee - leastExtraCapacity;
          if (fee < Zero) {
            throw new ErrorTransactionInsufficientCapacity(-fee);
          }
          return 0;
        }

        try {
          return await tx.completeInputsByCapacity(
            from,
            leastFee + leastExtraCapacity,
            filter,
          );
        } catch (err) {
          if (
            err instanceof ErrorTransactionInsufficientCapacity &&
            leastExtraCapacity !== Zero
          ) {
            throw new ErrorTransactionInsufficientCapacity(err.amount, {
              isForChange: true,
            });
          }

          throw err;
        }
      })();

      await from.prepareTransaction(tx);
      if (leastFee === Zero) {
        // The initial fee is calculated based on prepared transaction
        leastFee = tx.estimateFee(feeRate);
      }
      const fee = await tx.getFee(from.client);
      // The extra capacity paid the fee without a change
      if (fee === leastFee) {
        this.copy(tx);
        return [collected, false];
      }

      const needed = numFrom(await Promise.resolve(change(tx, fee - leastFee)));
      // No enough extra capacity to create new cells for change
      if (needed > Zero) {
        leastExtraCapacity = needed;
        continue;
      }

      if ((await tx.getFee(from.client)) !== leastFee) {
        throw new Error(
          "The change function doesn't use all available capacity",
        );
      }

      // New change cells created, update the fee
      await from.prepareTransaction(tx);
      const changedFee = tx.estimateFee(feeRate);
      if (leastFee > changedFee) {
        throw new Error("The change function removed existed transaction data");
      }
      // The fee has been paid
      if (leastFee === changedFee) {
        this.copy(tx);
        return [collected, true];
      }

      // The fee after changing is more than the original fee
      leastFee = changedFee;
    }
  }

  /**
   * Completes the transaction fee by adding inputs and creating a change output with the specified lock script.
   * This is a convenience method that automatically creates a change cell with the provided lock script
   * when there's excess capacity after paying the transaction fee.
   *
   * @param from - The signer to complete inputs from and prepare the transaction.
   * @param change - The lock script for the change output cell.
   * @param feeRate - Optional fee rate in shannons per 1000 bytes. If not provided, it will be fetched from the client.
   * @param filter - Optional filter for selecting cells when adding inputs.
   * @param options - Optional configuration object.
   * @param options.feeRateBlockRange - Block range for fee rate calculation when feeRate is not provided.
   * @param options.maxFeeRate - Maximum allowed fee rate.
   * @param options.shouldAddInputs - Whether to add inputs automatically. Defaults to true.
   * @returns A promise that resolves to a tuple containing:
   *          - The number of inputs added during the process
   *          - A boolean indicating whether change outputs were created (true) or fee was paid without change (false)
   *
   * @example
   * ```typescript
   * const changeScript = Script.from({
   *   codeHash: "0x...",
   *   hashType: "type",
   *   args: "0x..."
   * });
   *
   * const [addedInputs, hasChange] = await tx.completeFeeChangeToLock(
   *   signer,
   *   changeScript,
   *   1000n // 1000 shannons per 1000 bytes
   * );
   * ```
   */
  completeFeeChangeToLock(
    from: Signer,
    change: ScriptLike,
    feeRate?: NumLike,
    filter?: ClientCollectableSearchKeyFilterLike,
    options?: {
      feeRateBlockRange?: NumLike;
      maxFeeRate?: NumLike;
      shouldAddInputs?: boolean;
    },
  ): Promise<[number, boolean]> {
    const script = Script.from(change);

    return this.completeFee(
      from,
      (tx, capacity) => {
        const changeCell = CellOutput.from({ capacity: 0, lock: script });
        const occupiedCapacity = fixedPointFrom(changeCell.occupiedSize);
        if (capacity < occupiedCapacity) {
          return occupiedCapacity;
        }
        changeCell.capacity = capacity;
        tx.addOutput(changeCell);
        return 0;
      },
      feeRate,
      filter,
      options,
    );
  }

  /**
   * Completes the transaction fee using the signer's recommended address for change.
   * This is a convenience method that automatically uses the signer's recommended
   * address as the change destination, making it easier to complete transactions
   * without manually specifying a change address.
   *
   * @param from - The signer to complete inputs from and prepare the transaction.
   * @param feeRate - Optional fee rate in shannons per 1000 bytes. If not provided, it will be fetched from the client.
   * @param filter - Optional filter for selecting cells when adding inputs.
   * @param options - Optional configuration object.
   * @param options.feeRateBlockRange - Block range for fee rate calculation when feeRate is not provided.
   * @param options.maxFeeRate - Maximum allowed fee rate.
   * @param options.shouldAddInputs - Whether to add inputs automatically. Defaults to true.
   * @returns A promise that resolves to a tuple containing:
   *          - The number of inputs added during the process
   *          - A boolean indicating whether change outputs were created (true) or fee was paid without change (false)
   *
   * @example
   * ```typescript
   * const [addedInputs, hasChange] = await tx.completeFeeBy(
   *   signer,
   *   1000n // 1000 shannons per 1000 bytes
   * );
   *
   * // Change will automatically go to signer's recommended address
   * ```
   */
  async completeFeeBy(
    from: Signer,
    feeRate?: NumLike,
    filter?: ClientCollectableSearchKeyFilterLike,
    options?: {
      feeRateBlockRange?: NumLike;
      maxFeeRate?: NumLike;
      shouldAddInputs?: boolean;
    },
  ): Promise<[number, boolean]> {
    const { script } = await from.getRecommendedAddressObj();

    return this.completeFeeChangeToLock(from, script, feeRate, filter, options);
  }

  /**
   * Completes the transaction fee by adding excess capacity to an existing output.
   * Instead of creating a new change output, this method adds any excess capacity
   * to the specified existing output in the transaction.
   *
   * @param from - The signer to complete inputs from and prepare the transaction.
   * @param index - The index of the existing output to add excess capacity to.
   * @param feeRate - Optional fee rate in shannons per 1000 bytes. If not provided, it will be fetched from the client.
   * @param filter - Optional filter for selecting cells when adding inputs.
   * @param options - Optional configuration object.
   * @param options.feeRateBlockRange - Block range for fee rate calculation when feeRate is not provided.
   * @param options.maxFeeRate - Maximum allowed fee rate.
   * @param options.shouldAddInputs - Whether to add inputs automatically. Defaults to true.
   * @returns A promise that resolves to a tuple containing:
   *          - The number of inputs added during the process
   *          - A boolean indicating whether change was applied (true) or fee was paid without change (false)
   *
   * @throws {Error} When the specified output index doesn't exist.
   *
   * @example
   * ```typescript
   * // Add excess capacity to the first output (index 0)
   * const [addedInputs, hasChange] = await tx.completeFeeChangeToOutput(
   *   signer,
   *   0, // Output index
   *   1000n // 1000 shannons per 1000 bytes
   * );
   * ```
   */
  completeFeeChangeToOutput(
    from: Signer,
    index: NumLike,
    feeRate?: NumLike,
    filter?: ClientCollectableSearchKeyFilterLike,
    options?: {
      feeRateBlockRange?: NumLike;
      maxFeeRate?: NumLike;
      shouldAddInputs?: boolean;
    },
  ): Promise<[number, boolean]> {
    const change = Number(numFrom(index));
    if (!this.outputs[change]) {
      throw new Error("Non-existed output to change");
    }
    return this.completeFee(
      from,
      (tx, capacity) => {
        tx.outputs[change].capacity += capacity;
        return 0;
      },
      feeRate,
      filter,
      options,
    );
  }
}

/**
 * Calculate Nervos DAO profit between two blocks.
 * This function computes the profit earned from a Nervos DAO deposit
 * based on the capacity and the time period between deposit and withdrawal.
 *
 * @param profitableCapacity - The capacity that earns profit (total capacity minus occupied capacity).
 * @param depositHeaderLike - The block header when the DAO deposit was made.
 * @param withdrawHeaderLike - The block header when the DAO withdrawal is made.
 * @returns The profit amount in CKB (capacity units).
 *
 * @example
 * ```typescript
 * const profit = calcDaoProfit(
 *   ccc.fixedPointFrom(100), // 100 CKB profitable capacity
 *   depositHeader,
 *   withdrawHeader
 * );
 * console.log(`Profit: ${profit} shannons`);
 * ```
 *
 * @see {@link https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0023-dao-deposit-withdraw/0023-dao-deposit-withdraw.md | Nervos DAO RFC}
 */
export function calcDaoProfit(
  profitableCapacity: NumLike,
  depositHeaderLike: ClientBlockHeaderLike,
  withdrawHeaderLike: ClientBlockHeaderLike,
): Num {
  const depositHeader = ClientBlockHeader.from(depositHeaderLike);
  const withdrawHeader = ClientBlockHeader.from(withdrawHeaderLike);

  const profitableSize = numFrom(profitableCapacity);

  return (
    (profitableSize * withdrawHeader.dao.ar) / depositHeader.dao.ar -
    profitableSize
  );
}

/**
 * Calculate claimable epoch for Nervos DAO withdrawal.
 * This function determines the earliest epoch when a Nervos DAO withdrawal
 * can be claimed based on the deposit and withdrawal epochs.
 *
 * @param depositHeader - The block header when the DAO deposit was made.
 * @param withdrawHeader - The block header when the DAO withdrawal was initiated.
 * @returns The epoch when the withdrawal can be claimed, represented as [number, index, length].
 *
 * @example
 * ```typescript
 * const claimEpoch = calcDaoClaimEpoch(depositHeader, withdrawHeader);
 * console.log(`Can claim at epoch: ${claimEpoch[0]}, index: ${claimEpoch[1]}, length: ${claimEpoch[2]}`);
 * ```
 *
 * @remarks
 * The Nervos DAO has a minimum lock period of 180 epochs (~30 days).
 * This function calculates the exact epoch when the withdrawal becomes claimable
 * based on the deposit epoch and withdrawal epoch timing.
 *
 * @see {@link https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0023-dao-deposit-withdraw/0023-dao-deposit-withdraw.md | Nervos DAO RFC}
 */
export function calcDaoClaimEpoch(
  depositHeader: ClientBlockHeaderLike,
  withdrawHeader: ClientBlockHeaderLike,
): Epoch {
  const depositEpoch = ClientBlockHeader.from(depositHeader).epoch;
  const withdrawEpoch = ClientBlockHeader.from(withdrawHeader).epoch;
  const intDiff = withdrawEpoch[0] - depositEpoch[0];
  // deposit[1]    withdraw[1]
  // ---------- <= -----------
  // deposit[2]    withdraw[2]
  if (
    intDiff % numFrom(180) !== numFrom(0) ||
    depositEpoch[1] * withdrawEpoch[2] <= depositEpoch[2] * withdrawEpoch[1]
  ) {
    return [
      depositEpoch[0] + (intDiff / numFrom(180) + numFrom(1)) * numFrom(180),
      depositEpoch[1],
      depositEpoch[2],
    ];
  }

  return [
    depositEpoch[0] + (intDiff / numFrom(180)) * numFrom(180),
    depositEpoch[1],
    depositEpoch[2],
  ];
}
