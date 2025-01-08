import { bytesFrom, bytesTo } from "../bytes/index.js";
import { Hex, hexFrom, HexLike } from "../hex/index.js";
import { byteVec, Codec, option, uint, uintNumber, vector } from "./codec.js";

export const Uint8 = uintNumber(1, true);
export const Uint8Opt = option(Uint8);
export const Uint8Vec = vector(Uint8);

export const Uint16LE = uintNumber(2, true);
export const Uint16BE = uintNumber(2);
export const Uint16 = Uint16LE;
export const Uint16Opt = option(Uint16);
export const Uint16Vec = vector(Uint16);

export const Uint32LE = uintNumber(4, true);
export const Uint32BE = uintNumber(4);
export const Uint32 = Uint32LE;
export const Uint32Opt = option(Uint32);
export const Uint32Vec = vector(Uint32);

export const Uint64LE = uint(8, true);
export const Uint64BE = uint(8);
export const Uint64 = Uint64LE;
export const Uint64Opt = option(Uint64);
export const Uint64Vec = vector(Uint64);

export const Uint128LE = uint(16, true);
export const Uint128BE = uint(16);
export const Uint128 = Uint128LE;
export const Uint128Opt = option(Uint128);
export const Uint128Vec = vector(Uint128);

export const Uint256LE = uint(32, true);
export const Uint256BE = uint(32);
export const Uint256 = Uint256LE;
export const Uint256Opt = option(Uint256);
export const Uint256Vec = vector(Uint256);

export const Uint512LE = uint(64, true);
export const Uint512BE = uint(64);
export const Uint512 = Uint512LE;
export const Uint512Opt = option(Uint512);
export const Uint512Vec = vector(Uint512);

export const Bytes: Codec<HexLike, Hex> = byteVec({
  encode: (value) => bytesFrom(value),
  decode: (buffer) => hexFrom(buffer),
});
export const BytesOpt = option(Bytes);
export const BytesVec = vector(Bytes);

export const Bool: Codec<boolean> = Codec.from({
  byteLength: 1,
  encode: (value) => bytesFrom(value ? [1] : [0]),
  decode: (buffer) => bytesFrom(buffer)[0] !== 0,
});
export const BoolOpt = option(Bool);
export const BoolVec = vector(Bool);

export const Byte4: Codec<HexLike, Hex> = Codec.from({
  byteLength: 4,
  encode: (value) => bytesFrom(value),
  decode: (buffer) => hexFrom(buffer),
});
export const Byte4Opt = option(Byte4);
export const Byte4Vec = vector(Byte4);

export const Byte8: Codec<HexLike, Hex> = Codec.from({
  byteLength: 8,
  encode: (value) => bytesFrom(value),
  decode: (buffer) => hexFrom(buffer),
});
export const Byte8Opt = option(Byte8);
export const Byte8Vec = vector(Byte8);

export const Byte16: Codec<HexLike, Hex> = Codec.from({
  byteLength: 16,
  encode: (value) => bytesFrom(value),
  decode: (buffer) => hexFrom(buffer),
});
export const Byte16Opt = option(Byte16);
export const Byte16Vec = vector(Byte16);

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
