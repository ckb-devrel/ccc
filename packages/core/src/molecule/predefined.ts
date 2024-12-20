import { bytesFrom, bytesTo } from "../bytes/index.js";
import * as ckb from "../ckb/index.js";
import { Hex, hexFrom, HexLike } from "../hex/index.js";
import {
  byteVec,
  Codec,
  option,
  struct,
  table,
  uint,
  uintNumber,
  vector,
} from "./codec.js";

export const Uint8 = uintNumber(1, true);
export const Uint16LE = uintNumber(2, true);
export const Uint16BE = uintNumber(2);
export const Uint16 = Uint16LE;
export const Uint32LE = uintNumber(4, true);
export const Uint32BE = uintNumber(4);
export const Uint32 = Uint32LE;
export const Uint64LE = uint(8, true);
export const Uint64BE = uint(8);
export const Uint64 = Uint64LE;
export const Uint128LE = uint(16, true);
export const Uint128BE = uint(16);
export const Uint128 = Uint128LE;
export const Uint256LE = uint(32, true);
export const Uint256BE = uint(32);
export const Uint256 = Uint256LE;
export const Uint512LE = uint(64, true);
export const Uint512BE = uint(64);
export const Uint512 = Uint512LE;

export const Uint8Opt = option(Uint8);
export const Uint16Opt = option(Uint16);
export const Uint32Opt = option(Uint32);
export const Uint64Opt = option(Uint64);
export const Uint128Opt = option(Uint128);
export const Uint256Opt = option(Uint256);
export const Uint512Opt = option(Uint512);

export const Bytes: Codec<HexLike, Hex> = byteVec({
  encode: (value) => bytesFrom(value),
  decode: (buffer) => hexFrom(buffer),
});
export const BytesOpt = option(Bytes);
export const BytesVec = vector(Bytes);

export const Byte32: Codec<HexLike, Hex> = Codec.from({
  byteLength: 32,
  encode: (value) => bytesFrom(value),
  decode: (buffer) => hexFrom(buffer),
});
export const Byte32Opt = option(Byte32);
export const Byte32Vec = vector(Byte32);

export const String = byteVec({
  encode: (value: string) => bytesFrom(value, "utf8"),
  decode: (buffer) => bytesTo(buffer, "utf8"),
});
export const StringVec = vector(String);
export const StringOpt = option(String);

export const Hash = Byte32;
export const HashType: Codec<ckb.HashTypeLike, ckb.HashType> = Codec.from({
  byteLength: 1,
  encode: ckb.hashTypeToBytes,
  decode: ckb.hashTypeFromBytes,
});
export const Script: Codec<ckb.ScriptLike, ckb.Script> = table({
  codeHash: Hash,
  hashType: HashType,
  args: Bytes,
}).map({ outMap: ckb.Script.from });
export const ScriptOpt = option(Script);

export const OutPoint: Codec<ckb.OutPointLike, ckb.OutPoint> = struct({
  txHash: Hash,
  index: Uint32,
}).map({ outMap: ckb.OutPoint.from });
export const CellInput: Codec<ckb.CellInputLike, ckb.CellInput> = struct({
  previousOutput: OutPoint,
  since: Uint64,
}).map({ outMap: ckb.CellInput.from });
export const CellInputVec = vector(CellInput);

export const CellOutput: Codec<ckb.CellOutputLike, ckb.CellOutput> = table({
  capacity: Uint64,
  lock: Script,
  type: ScriptOpt,
}).map({ outMap: ckb.CellOutput.from });
export const CellOutputVec = vector(CellOutput);

export const DepType: Codec<ckb.DepTypeLike, ckb.DepType> = Codec.from({
  byteLength: 1,
  encode: ckb.depTypeToBytes,
  decode: ckb.depTypeFromBytes,
});
export const CellDep: Codec<ckb.CellDepLike, ckb.CellDep> = struct({
  outPoint: OutPoint,
  depType: DepType,
}).map({ outMap: ckb.CellDep.from });
export const CellDepVec = vector(CellDep);

export const RawTransaction = table({
  version: Uint32,
  cellDeps: CellDepVec,
  headerDeps: Byte32Vec,
  inputs: CellInputVec,
  outputs: CellOutputVec,
  outputsData: BytesVec,
}).map({ outMap: ckb.Transaction.from });

export const Transaction: Codec<ckb.TransactionLike, ckb.Transaction> = table({
  raw: RawTransaction,
  witnesses: BytesVec,
}).map({
  inMap: (txLike: ckb.TransactionLike) => {
    const tx = ckb.Transaction.from(txLike);
    return {
      raw: tx,
      witnesses: tx.witnesses,
    };
  },
  outMap: (tx) => ckb.Transaction.from({ ...tx.raw, witnesses: tx.witnesses }),
});
