import { bytesFrom, bytesTo } from "../bytes/index.js";
import { Codec, CodecBytes } from "../codec/index.js";
import { Hex, HexLike } from "../hex/index.js";
import { byteVec, option, vector } from "./codec.js";

import {
  CodecBool as Bool,
  CodecByte as Byte,
  CodecByte16 as Byte16,
  CodecByte32 as Byte32,
  CodecByte4 as Byte4,
  CodecByte8 as Byte8,
  CodecUint128 as Uint128,
  CodecUint128BE as Uint128BE,
  CodecUint128LE as Uint128LE,
  CodecUint16 as Uint16,
  CodecUint16BE as Uint16BE,
  CodecUint16LE as Uint16LE,
  CodecUint256 as Uint256,
  CodecUint256BE as Uint256BE,
  CodecUint256LE as Uint256LE,
  CodecUint32 as Uint32,
  CodecUint32BE as Uint32BE,
  CodecUint32LE as Uint32LE,
  CodecUint512 as Uint512,
  CodecUint512BE as Uint512BE,
  CodecUint512LE as Uint512LE,
  CodecUint64 as Uint64,
  CodecUint64BE as Uint64BE,
  CodecUint64LE as Uint64LE,
  CodecUint8 as Uint8,
} from "../codec/index.js";

export {
  Bool,
  Byte,
  Byte16,
  Byte32,
  Byte4,
  Byte8,
  Uint128,
  Uint128BE,
  Uint128LE,
  Uint16,
  Uint16BE,
  Uint16LE,
  Uint256,
  Uint256BE,
  Uint256LE,
  Uint32,
  Uint32BE,
  Uint32LE,
  Uint512,
  Uint512BE,
  Uint512LE,
  Uint64,
  Uint64BE,
  Uint64LE,
  Uint8,
};

export const Uint8Opt = option(Uint8);
export const Uint8Vec = vector(Uint8);

export const Uint16Opt = option(Uint16);
export const Uint16Vec = vector(Uint16);

export const Uint32Opt = option(Uint32);
export const Uint32Vec = vector(Uint32);

export const Uint64Opt = option(Uint64);
export const Uint64Vec = vector(Uint64);

export const Uint128Opt = option(Uint128);
export const Uint128Vec = vector(Uint128);

export const Uint256Opt = option(Uint256);
export const Uint256Vec = vector(Uint256);

export const Uint512Opt = option(Uint512);
export const Uint512Vec = vector(Uint512);

export const Bytes: Codec<HexLike, Hex> = byteVec(CodecBytes);
export const BytesOpt = option(Bytes);
export const BytesVec = vector(Bytes);

export const BoolOpt = option(Bool);
export const BoolVec = vector(Bool);

export const ByteOpt = option(Byte);
export const ByteVec = vector(Byte);

export const Byte4Opt = option(Byte4);
export const Byte4Vec = vector(Byte4);

export const Byte8Opt = option(Byte8);
export const Byte8Vec = vector(Byte8);

export const Byte16Opt = option(Byte16);
export const Byte16Vec = vector(Byte16);

export const Byte32Opt = option(Byte32);
export const Byte32Vec = vector(Byte32);

export const String = byteVec({
  encode: (value: string) => bytesFrom(value, "utf8"),
  decode: (buffer) => bytesTo(buffer, "utf8"),
});
export const StringVec = vector(String);
export const StringOpt = option(String);
