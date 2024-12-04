import { bytesFrom, BytesLike } from "../bytes/index.js";
import { hashTypeFromBytes, HashTypeLike, hashTypeToBytes } from "../ckb/script.js";
import { depTypeFromBytes, DepTypeLike, depTypeToBytes, Transaction as TransactionCCC } from "../ckb/transaction.js";
import { hexFrom } from "../hex/index.js";
import { Num, numFrom, NumLike } from "../num/index.js";
import {
  AnyCodec,
  BytesCodec,
  createBytesCodec,
  createFixedBytesCodec,
  FixedBytesCodec,
  PackParam,
  UnpackResult,
} from "./base.js";
import { byteVecOf, option, struct, table, vector } from "./molecule/index.js";
import { Uint128LE, Uint32LE, Uint64LE } from "./number.js";

function asHexadecimal(
  codec:
    | FixedBytesCodec<Num, NumLike>
    | FixedBytesCodec<number, NumLike>,
): FixedBytesCodec<string, NumLike> {
  return {
    ...codec,
    decode: (value) => numFrom(codec.decode(value)).toString(16),
  };
}

const HexUint32LE = asHexadecimal(Uint32LE);
const HexUint64LE = asHexadecimal(Uint64LE);
const HexUint128LE = asHexadecimal(Uint128LE);

type TransactionCodecType = PackParam<typeof BaseTransaction>;
type TransactionUnpackResultType = UnpackResult<typeof BaseTransaction>;
type RawTransactionUnpackResultType = UnpackResult<typeof RawTransaction>;
// type HeaderCodecType = PackParam<typeof BaseHeader>;
type HeaderUnpackResultType = UnpackResult<typeof BaseHeader>;
type RawHeaderUnpackResultType = UnpackResult<typeof RawHeader>;

export function createFixedHexBytesCodec(
  byteLength: number,
): FixedBytesCodec<string, BytesLike> {
  return createFixedBytesCodec({
    byteLength,
    encode: (hex) => bytesFrom(hex),
    decode: (buf) => hexFrom(buf),
  });
}

/**
 * placeholder codec, generally used as a placeholder
 * ```
 * // for example, when some BytesOpt is not used, it will be filled with this codec
 * // option BytesOpt (Bytes);
 * const UnusedBytesOpt = UnknownOpt
 * ```
 */
// export const UnusedOpt = option(Unknown);

// vector Bytes <byte>
export const Bytes = byteVecOf({ encode: bytesFrom, decode: hexFrom });

export const BytesOpt = option(Bytes);
export const BytesVec = vector(Bytes);
export const BytesOptVec = vector(BytesOpt);
export const Byte32 = createFixedHexBytesCodec(32);
export const Byte32Vec = vector(Byte32);

export function WitnessArgsOf<
  LockCodec extends AnyCodec,
  InputTypeCodec extends AnyCodec,
  OutputTypeCodec extends AnyCodec,
>(payload: {
  lock: LockCodec;
  inputType: InputTypeCodec;
  outputType: OutputTypeCodec;
}): BytesCodec<
  {
    lock?: UnpackResult<LockCodec>;
    inputType?: UnpackResult<InputTypeCodec>;
    outputType?: UnpackResult<OutputTypeCodec>;
  },
  {
    lock?: PackParam<LockCodec>;
    inputType?: PackParam<InputTypeCodec>;
    outputType?: PackParam<OutputTypeCodec>;
  }
> {
  return table(
    {
      lock: option(byteVecOf(payload.lock)),
      inputType: option(byteVecOf(payload.inputType)),
      outputType: option(byteVecOf(payload.outputType)),
    },
    ["lock", "inputType", "outputType"],
  );
}

const HexifyCodec = createBytesCodec<string, BytesLike>({
  encode: bytesFrom,
  decode: hexFrom,
});

/**
 *
 * @example
 * ```ts
 * // secp256k1 lock witness
 * WitnessArgs.pack({ lock: '0x' + '00'.repeat(65) })
 * ```
 */
export const WitnessArgs = WitnessArgsOf({
  lock: HexifyCodec,
  inputType: HexifyCodec,
  outputType: HexifyCodec,
});

/**
 * <pre>
 *  0b0000000 0
 *    ───┬─── │
 *       │    ▼
 *       │   type - use the default vm version
 *       │
 *       ▼
 * data* - use a particular vm version
 * </pre>
 *
 * Implementation of blockchain.mol
 * https://github.com/nervosnetwork/ckb/blob/5a7efe7a0b720de79ff3761dc6e8424b8d5b22ea/util/types/schemas/blockchain.mol
 */
export const HashType = createFixedBytesCodec<HashTypeLike>({
  byteLength: 1,
  encode: hashTypeToBytes,
  decode: hashTypeFromBytes,
});

export const DepType = createFixedBytesCodec<DepTypeLike>({
  byteLength: 1,
  encode: depTypeToBytes,
  decode: depTypeFromBytes,
});

export const Script = table(
  {
    codeHash: Byte32,
    hashType: HashType,
    args: Bytes,
  },
  ["codeHash", "hashType", "args"],
);

export const ScriptOpt = option(Script);

export const OutPoint = struct(
  {
    txHash: Byte32,
    index: HexUint32LE,
  },
  ["txHash", "index"],
);

export const CellInput = struct(
  {
    since: HexUint64LE,
    previousOutput: OutPoint,
  },
  ["since", "previousOutput"],
);

export const CellInputVec = vector(CellInput);

export const CellOutput = table(
  {
    capacity: HexUint64LE,
    lock: Script,
    type: ScriptOpt,
  },
  ["capacity", "lock", "type"],
);

export const CellOutputVec = vector(CellOutput);

export const CellDep = struct(
  {
    outPoint: OutPoint,
    depType: DepType,
  },
  ["outPoint", "depType"],
);

export const CellDepVec = vector(CellDep);

export const RawTransaction = table(
  {
    version: HexUint32LE,
    cellDeps: CellDepVec,
    headerDeps: Byte32Vec,
    inputs: CellInputVec,
    outputs: CellOutputVec,
    outputsData: BytesVec,
  },
  ["version", "cellDeps", "headerDeps", "inputs", "outputs", "outputsData"],
);

const BaseTransaction = table(
  {
    raw: RawTransaction,
    witnesses: BytesVec,
  },
  ["raw", "witnesses"],
);

export const Transaction = createBytesCodec({
  encode: (tx: TransactionCCC) =>
    BaseTransaction.encode(transformTransactionCodecType(tx)),
  decode: (buf) => deTransformTransactionCodecType(BaseTransaction.decode(buf)),
});

export const TransactionVec = vector(Transaction);

export const RawHeader = struct(
  {
    version: HexUint32LE,
    compactTarget: HexUint32LE,
    timestamp: HexUint64LE,
    number: HexUint64LE,
    epoch: HexUint64LE,
    parentHash: Byte32,
    transactionsRoot: Byte32,
    proposalsHash: Byte32,
    extraHash: Byte32,
    dao: Byte32,
  },
  [
    "version",
    "compactTarget",
    "timestamp",
    "number",
    "epoch",
    "parentHash",
    "transactionsRoot",
    "proposalsHash",
    "extraHash",
    "dao",
  ],
);

export const BaseHeader = struct(
  {
    raw: RawHeader,
    nonce: HexUint128LE,
  },
  ["raw", "nonce"],
);

// export const Header = createBytesCodec({
//   pack: (header: ccc.Header) =>
//     BaseHeader.pack(transformHeaderCodecType(header)),
//   unpack: (buf) => deTransformHeaderCodecType(BaseHeader.unpack(buf)),
// });

export const ProposalShortId = createFixedHexBytesCodec(10);

export const ProposalShortIdVec = vector(ProposalShortId);

// export const UncleBlock = table(
//   {
//     header: Header,
//     proposals: ProposalShortIdVec,
//   },
//   ["header", "proposals"]
// );

// export const UncleBlockVec = vector(UncleBlock);

// export const Block = table(
//   {
//     header: Header,
//     uncles: UncleBlockVec,
//     transactions: TransactionVec,
//     proposals: ProposalShortIdVec,
//   },
//   ["header", "uncles", "transactions", "proposals"]
// );

// export const BlockV1 = table(
//   {
//     header: Header,
//     uncles: UncleBlockVec,
//     transactions: TransactionVec,
//     proposals: ProposalShortIdVec,
//     extension: Bytes,
//   },
//   ["header", "uncles", "transactions", "proposals", "extension"]
// );

export const CellbaseWitness = table(
  {
    lock: Script,
    message: Bytes,
  },
  ["lock", "message"],
);

// TODO make an enhancer for number codecs
/**
 * from Transantion defined in  @ckb-lumos/base/lib/api.d.ts
 * ```
 * export interface Transaction {
 *  cellDeps: CellDep[];
 *  hash?: Hash;
 *  headerDeps: Hash[];
 *  inputs: Input[];
 *  outputs: Output[];
 *  outputsData: HexString[];
 *  version: HexNumber;
 *  witnesses: HexString[];
 *}
 * to :
 * interface TransactionCodecType {
 *   raw: {
 *     version: Uint32LE;
 *     cellDeps: DeCellDepVec;
 *     headerDeps: Byte32Vec;
 *     inputs: CellInputVec;
 *     outputs: CellOutputVec;
 *     outputsData: BytesVec;
 *   };
 *   witnesses: BytesVec;
 * }
 * ```
 * @param data Transantion defined in @ckb-lumos/base/lib/api.d.ts
 * @returns TransactionCodecType
 */
export function transformTransactionCodecType(
  data: TransactionCCC,
): TransactionCodecType {
  return {
    raw: {
      version: data.version,
      cellDeps: data.cellDeps,
      headerDeps: data.headerDeps,
      inputs: data.inputs,
      outputs: data.outputs,
      outputsData: data.outputsData,
    },
    witnesses: data.witnesses,
  };
}

export function deTransformTransactionCodecType(
  data: TransactionUnpackResultType,
): RawTransactionUnpackResultType & { witnesses: string[] } {
  return {
    cellDeps: data.raw.cellDeps.map((cellDep) => {
      return {
        outPoint: {
          txHash: cellDep.outPoint.txHash,
          index: cellDep.outPoint.index,
        },
        depType: cellDep.depType,
      };
    }),
    headerDeps: data.raw.headerDeps,
    inputs: data.raw.inputs.map((input) => {
      return {
        previousOutput: {
          txHash: input.previousOutput.txHash,
          index: input.previousOutput.index,
        },
        since: input.since,
      };
    }),
    outputs: data.raw.outputs.map((output) => {
      return {
        capacity: output.capacity,
        lock: output.lock,
        type: output.type,
      };
    }),
    outputsData: data.raw.outputsData,
    version: data.raw.version,
    witnesses: data.witnesses,
  };
}

// export function transformHeaderCodecType(data: api.Header): HeaderCodecType {
//   return {
//     raw: {
//       timestamp: data.timestamp,
//       number: data.number,
//       epoch: data.epoch,
//       compactTarget: Number(data.compactTarget),
//       dao: data.dao,
//       parentHash: data.parentHash,
//       proposalsHash: data.proposalsHash,
//       transactionsRoot: data.transactionsRoot,
//       extraHash: data.extraHash,
//       version: data.version,
//     },
//     nonce: data.nonce,
//   };
// }

export function deTransformHeaderCodecType(
  data: HeaderUnpackResultType,
): RawHeaderUnpackResultType & { nonce: string; hash: string } {
  return {
    timestamp: data.raw.timestamp,
    number: data.raw.number,
    epoch: data.raw.epoch,
    compactTarget: data.raw.compactTarget,
    dao: data.raw.dao,
    parentHash: data.raw.parentHash,
    proposalsHash: data.raw.proposalsHash,
    transactionsRoot: data.raw.transactionsRoot,
    extraHash: data.raw.extraHash,
    version: data.raw.version,
    nonce: data.nonce,
    hash: "",
  };
}
