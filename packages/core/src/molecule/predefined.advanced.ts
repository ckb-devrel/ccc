import {
  bytesFrom,
  BytesLike,
  bytesTo,
  CellDepLike,
  CellInputLike,
  CellOutputLike,
  depTypeFromBytes,
  DepTypeLike,
  depTypeToBytes,
  hashTypeFromBytes,
  HashTypeLike,
  hashTypeToBytes,
  OutPointLike,
  ScriptLike,
  TransactionLike,
} from "../barrel.js";
import { byteVec, option, struct, table, vector } from "./codec.advanced.js";
import { Codec } from "./codec.js";
import {
  Uint128,
  Uint16,
  Uint256,
  Uint32,
  Uint512,
  Uint64,
  Uint8,
} from "./predefined.js";

export const Uint8Opt = option(Uint8);
export const Uint16Opt = option(Uint16);
export const Uint32Opt = option(Uint32);
export const Uint64Opt = option(Uint64);
export const Uint128Opt = option(Uint128);
export const Uint256Opt = option(Uint256);
export const Uint512Opt = option(Uint512);

export const Bytes: Codec<BytesLike> = byteVec({
  encode: (value) => {
    return bytesFrom(value);
  },
  decode: (buffer) => {
    return bytesFrom(buffer);
  },
});
export const BytesOpt = option(Bytes);
export const BytesVec = vector(Bytes);

export const Byte32: Codec<BytesLike> = {
  byteLength: 32,
  encode: (value) => {
    return bytesFrom(value);
  },
  decode: (buffer) => {
    return bytesFrom(buffer);
  },
};
export const Byte32Opt = option(Byte32);
export const Byte32Vec = vector(Byte32);

export const String = byteVec({
  encode: (value: string) => bytesFrom(value, "utf8"),
  decode: (buffer) => bytesTo(buffer, "utf8"),
});
export const StringVec = vector(String);
export const StringOpt = option(String);

export const Hash = Byte32;
export const HashType: Codec<HashTypeLike> = {
  byteLength: 1,
  encode: hashTypeToBytes,
  decode: hashTypeFromBytes,
};
export const Script: Codec<ScriptLike> = table({
  codeHash: Hash,
  hashType: HashType,
  args: Bytes,
});
export const ScriptOpt = option(Script);

export const OutPoint: Codec<OutPointLike> = struct({
  txHash: Hash,
  index: Uint32,
});
export const CellInput: Codec<CellInputLike> = struct({
  previousOutput: OutPoint,
  since: Uint64,
});
export const CellInputVec = vector(CellInput);

export const CellOutput: Codec<CellOutputLike> = table({
  capacity: Uint64,
  lock: Script,
  type: ScriptOpt,
});
export const CellOutputVec = vector(CellOutput);

export const DepType: Codec<DepTypeLike> = {
  byteLength: 1,
  encode: depTypeToBytes,
  decode: depTypeFromBytes,
};
export const CellDep: Codec<CellDepLike> = struct({
  outPoint: OutPoint,
  depType: DepType,
});
export const CellDepVec = vector(CellDep);

export const Transaction: Codec<TransactionLike> = table({
  version: Uint32,
  cellDeps: CellDepVec,
  headerDeps: Byte32Vec,
  inputs: CellInputVec,
  outputs: CellOutputVec,
  outputsData: BytesVec,
  witnesses: BytesVec,
});
