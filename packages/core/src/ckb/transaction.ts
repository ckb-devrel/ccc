import { Bytes, BytesLike, bytesFrom } from "../bytes/index.js";
import type { ClientCollectableSearchKeyFilterLike } from "../client/clientTypes.advanced.js";
import type { CellDepInfoLike, Client, KnownScript } from "../client/index.js";
import {
  Zero,
  fixedPointFrom,
  fixedPointToString,
} from "../fixedPoint/index.js";
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
   *
   * @param cellOutput - A CellOutputLike object or an instance of CellOutput.
   * @returns A CellOutput instance.
   *
   * @example
   * ```typescript
   * const cellOutput = CellOutput.from({
   *   capacity: 1000n,
   *   lock: { codeHash: "0x...", hashType: "type", args: "0x..." },
   *   type: { codeHash: "0x...", hashType: "type", args: "0x..." }
   * });
   * ```
   */
  static from(cellOutput: CellOutputLike): CellOutput {
    if (cellOutput instanceof CellOutput) {
      return cellOutput;
    }

    return new CellOutput(
      numFrom(cellOutput.capacity),
      Script.from(cellOutput.lock),
      apply(Script.from, cellOutput.type),
    );
  }
}
export const CellOutputVec = mol.vector(CellOutput);

/**
 * @public
 */
export type CellLike = {
  outPoint: OutPointLike;
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
   *
   * @param cell - A CellLike object or an instance of Cell.
   * @returns A Cell instance.
   */

  static from(cell: CellLike): Cell {
    if (cell instanceof Cell) {
      return cell;
    }

    return new Cell(
      OutPoint.from(cell.outPoint),
      CellOutput.from(cell.cellOutput),
      hexFrom(cell.outputData),
    );
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
export type CellInputLike = {
  previousOutput: OutPointLike;
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
    .mapIn((encodable: CellInputLike) => ({
      ...encodable,
      since: encodable.since ?? 0,
    })),
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
      OutPoint.from(cellInput.previousOutput),
      Since.from(cellInput.since ?? 0).toNum(),
      apply(CellOutput.from, cellInput.cellOutput),
      apply(hexFrom, cellInput.outputData),
    );
  }

  /**
   * Complete extra infos in the input. Like the output of the out point.
   * The instance will be modified.
   *
   * @returns true if succeed.
   * @example
   * ```typescript
   * await cellInput.completeExtraInfos();
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
   * Clone a CellDep.
   *
   * @returns A cloned CellDep instance.
   *
   * @example
   * ```typescript
   * const cellDep1 = cellDep0.clone();
   * ```
   */

  clone(): CellDep {
    return new CellDep(this.outPoint.clone(), this.depType);
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
 * @public
 */
export function udtBalanceFrom(dataLike: BytesLike): Num {
  const data = bytesFrom(dataLike).slice(0, 16);
  return numFromBytes(data);
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
      tx.outputs?.map((output, i) => {
        const o = CellOutput.from({
          ...output,
          capacity: output.capacity ?? 0,
        });
        if (o.capacity === Zero) {
          o.capacity = fixedPointFrom(
            o.occupiedSize +
              (apply(bytesFrom, tx.outputsData?.[i])?.length ?? 0),
          );
        }
        return o;
      }) ?? [];
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
        await input.completeExtraInfos(client);

        if (!input.cellOutput) {
          throw new Error("Unable to complete input");
        }

        if (!script.eq(input.cellOutput.lock)) {
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
      const input = this.inputs[i];
      await input.completeExtraInfos(client);
      if (!input.cellOutput) {
        throw new Error("Unable to complete input");
      }

      if (
        script.codeHash === input.cellOutput.lock.codeHash &&
        script.hashType === input.cellOutput.lock.hashType
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
   * @returns A promise that resolves to the prepared transaction
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
      const input = this.inputs[i];
      await input.completeExtraInfos(client);
      if (!input.cellOutput) {
        throw new Error("Unable to complete input");
      }

      if (script.eq(input.cellOutput.lock)) {
        return i;
      }
    }
  }

  /**
   * Find the last occurrence of a input with the specified lock
   *
   * @param scriptLike - The script associated with the transaction, represented as a ScriptLike object.
   * @param client - The client for complete extra infos in the transaction.
   * @returns A promise that resolves to the prepared transaction
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
      const input = this.inputs[i];
      await input.completeExtraInfos(client);
      if (!input.cellOutput) {
        throw new Error("Unable to complete input");
      }

      if (script.eq(input.cellOutput.lock)) {
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
   * @param witness - The data to set.
   *
   * @example
   * ```typescript
   * await tx.setOutputDataAt(0, "0x00");
   * ```
   */
  setOutputDataAt(index: number, witness: HexLike): void {
    if (this.outputsData.length < index) {
      this.outputsData.push(
        ...Array.from(
          new Array(index - this.outputsData.length),
          (): Hex => "0x",
        ),
      );
    }

    this.outputsData[index] = hexFrom(witness);
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
  ): void {
    const output = CellOutput.from({
      ...outputLike,
      capacity: outputLike.capacity ?? 0,
    });
    if (output.capacity === Zero) {
      output.capacity = fixedPointFrom(
        output.occupiedSize + bytesFrom(outputData).length,
      );
    }
    const i = this.outputs.push(output) - 1;
    this.setOutputDataAt(i, outputData);
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
    if (this.witnesses.length < index) {
      this.witnesses.push(
        ...Array.from(
          new Array(index - this.witnesses.length),
          (): Hex => "0x",
        ),
      );
    }

    this.witnesses[index] = hexFrom(witness.toBytes());
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

  async getInputsCapacity(client: Client): Promise<Num> {
    return reduceAsync(
      this.inputs,
      async (acc, input) => {
        await input.completeExtraInfos(client);
        if (!input.cellOutput) {
          throw new Error("Unable to complete input");
        }
        return acc + input.cellOutput.capacity;
      },
      numFrom(0),
    );
  }

  getOutputsCapacity(): Num {
    return this.outputs.reduce(
      (acc, { capacity }) => acc + capacity,
      numFrom(0),
    );
  }

  async getInputsUdtBalance(client: Client, type: ScriptLike): Promise<Num> {
    return reduceAsync(
      this.inputs,
      async (acc, input) => {
        await input.completeExtraInfos(client);
        if (!input.cellOutput || !input.outputData) {
          throw new Error("Unable to complete input");
        }
        if (!input.cellOutput.type?.eq(type)) {
          return;
        }

        return acc + udtBalanceFrom(input.outputData);
      },
      numFrom(0),
    );
  }

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

    this.inputs.push(
      ...collectedCells.map(({ outPoint, outputData, cellOutput }) =>
        CellInput.from({
          previousOutput: outPoint,
          outputData,
          cellOutput,
        }),
      ),
    );
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
    const exceptedCapacity =
      this.getOutputsCapacity() + numFrom(capacityTweak ?? 0);
    const inputsCapacity = await this.getInputsCapacity(from.client);
    if (inputsCapacity >= exceptedCapacity) {
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
        return sum >= exceptedCapacity ? undefined : sum;
      },
      inputsCapacity,
    );

    if (accumulated === undefined) {
      return addedCount;
    }

    throw new Error(
      `Insufficient CKB, need ${fixedPointToString(exceptedCapacity - accumulated)} extra CKB`,
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

  async completeInputsByUdt(
    from: Signer,
    type: ScriptLike,
    balanceTweak?: NumLike,
  ): Promise<number> {
    const exceptedBalance =
      this.getOutputsUdtBalance(type) + numFrom(balanceTweak ?? 0);
    const inputsBalance = await this.getInputsUdtBalance(from.client, type);
    if (inputsBalance >= exceptedBalance) {
      return 0;
    }

    const { addedCount, accumulated } = await this.completeInputs(
      from,
      {
        script: type,
        outputDataLenRange: [16, numFrom("0xffffffff")],
      },
      (acc, { outputData }) => {
        const balance = udtBalanceFrom(outputData);
        const sum = acc + balance;
        return sum >= exceptedBalance ? undefined : sum;
      },
      inputsBalance,
    );

    if (accumulated === undefined) {
      return addedCount;
    }

    throw new Error(
      `Insufficient coin, need ${exceptedBalance - accumulated} extra coin`,
    );
  }

  async completeInputsAddOne(
    from: Signer,
    filter?: ClientCollectableSearchKeyFilterLike,
  ): Promise<number> {
    for await (const cell of from.findCells(
      filter ?? {
        scriptLenRange: [0, 1],
        outputDataLenRange: [0, 1],
      },
      true,
      undefined,
      1,
    )) {
      if (
        this.inputs.some(({ previousOutput }) =>
          previousOutput.eq(cell.outPoint),
        )
      ) {
        continue;
      }

      this.inputs.push(
        CellInput.from({
          previousOutput: cell.outPoint,
          outputData: cell.outputData,
          cellOutput: cell.cellOutput,
        }),
      );
      return 1;
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

  estimateFee(feeRate: NumLike): Num {
    const txSize = this.toBytes().length + 4;
    return (numFrom(txSize) * numFrom(feeRate) + numFrom(1000)) / numFrom(1000);
  }

  async completeFee(
    from: Signer,
    change: (tx: Transaction, capacity: Num) => Promise<NumLike> | NumLike,
    expectedFeeRate?: NumLike,
    filter?: ClientCollectableSearchKeyFilterLike,
  ): Promise<[number, boolean]> {
    const feeRate = expectedFeeRate ?? (await from.client.getFeeRate());

    // Complete all inputs extra infos for cache
    await this.getInputsCapacity(from.client);

    let leastFee = Zero;
    let leastExtraCapacity = Zero;

    while (true) {
      const tx = this.clone();
      const collected = await (async () => {
        try {
          return await tx.completeInputsByCapacity(
            from,
            leastFee + leastExtraCapacity,
            filter,
          );
        } catch (err) {
          if (leastExtraCapacity !== Zero) {
            throw new Error("Not enough capacity for the change cell");
          }

          throw err;
        }
      })();

      await from.prepareTransaction(tx);
      if (leastFee === Zero) {
        // The initial fee is calculated based on prepared transaction
        leastFee = tx.estimateFee(feeRate);
      }
      const extraCapacity =
        (await tx.getInputsCapacity(from.client)) - tx.getOutputsCapacity();
      // The extra capacity paid the fee without a change
      if (extraCapacity === leastFee) {
        this.copy(tx);
        return [collected, false];
      }

      const needed = numFrom(
        await Promise.resolve(change(tx, extraCapacity - leastFee)),
      );
      // No enough extra capacity to create new cells for change
      if (needed > Zero) {
        leastExtraCapacity = needed;
        continue;
      }

      if (
        (await tx.getInputsCapacity(from.client)) - tx.getOutputsCapacity() !==
        leastFee
      ) {
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

  completeFeeChangeToLock(
    from: Signer,
    change: ScriptLike,
    feeRate?: NumLike,
    filter?: ClientCollectableSearchKeyFilterLike,
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
    );
  }

  async completeFeeBy(
    from: Signer,
    feeRate?: NumLike,
    filter?: ClientCollectableSearchKeyFilterLike,
  ): Promise<[number, boolean]> {
    const { script } = await from.getRecommendedAddressObj();

    return this.completeFeeChangeToLock(from, script, feeRate, filter);
  }

  completeFeeChangeToOutput(
    from: Signer,
    index: NumLike,
    feeRate?: NumLike,
    filter?: ClientCollectableSearchKeyFilterLike,
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
    );
  }
}
