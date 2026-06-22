import { Bytes, bytesFrom, BytesLike } from "../bytes/index.js";
import { Hex, hexFrom, HexLike } from "../hex/index.js";
import {
  Num,
  numBeFromBytes,
  numBeToBytes,
  numFromBytes,
  NumLike,
  numToBytes,
} from "../num/index.js";
import { Codec } from "./codec.js";

/**
 * Create a codec to deal with fixed LE or BE bytes.
 * @param byteLength
 * @param littleEndian
 */
export function codecUint(
  byteLength: number,
  littleEndian = false,
): Codec<NumLike, Num> {
  return Codec.from({
    byteLength,
    encode: (numLike) => {
      if (littleEndian) {
        return numToBytes(numLike, byteLength);
      } else {
        return numBeToBytes(numLike, byteLength);
      }
    },
    decode: (buffer) => {
      if (littleEndian) {
        return numFromBytes(buffer);
      } else {
        return numBeFromBytes(buffer);
      }
    },
  });
}

/**
 * Create a codec to deal with fixed LE or BE bytes.
 * @param byteLength
 * @param littleEndian
 */
export function codecUintNumber(
  byteLength: number,
  littleEndian = false,
): Codec<NumLike, number> {
  if (byteLength > 4) {
    throw new Error("uintNumber: byteLength must be less than or equal to 4");
  }
  return codecUint(byteLength, littleEndian).map({
    outMap: (num) => Number(num),
  });
}

/**
 * Create a codec for padding bytes.
 * The padding bytes are zero-filled when encoding and ignored when decoding.
 * @param byteLength The length of the padding in bytes.
 */
export function codecPadding(
  byteLength: number,
): Codec<void | undefined | null, void> {
  return Codec.from({
    byteLength,
    encode: () => {
      return new Uint8Array(byteLength);
    },
    decode: () => {},
  });
}

export const CodecRaw: Codec<BytesLike, Bytes> = Codec.from({
  encode: (value) => bytesFrom(value),
  decode: (buffer) => bytesFrom(buffer),
});

export const CodecBytes: Codec<HexLike, Hex> = Codec.from({
  encode: (value) => bytesFrom(value),
  decode: (buffer) => hexFrom(buffer),
});

export const CodecUint8 = codecUintNumber(1, true);

export const CodecUint16LE = codecUintNumber(2, true);
export const CodecUint16BE = codecUintNumber(2);
export const CodecUint16 = CodecUint16LE;

export const CodecUint32LE = codecUintNumber(4, true);
export const CodecUint32BE = codecUintNumber(4);
export const CodecUint32 = CodecUint32LE;

export const CodecUint64LE = codecUint(8, true);
export const CodecUint64BE = codecUint(8);
export const CodecUint64 = CodecUint64LE;

export const CodecUint128LE = codecUint(16, true);
export const CodecUint128BE = codecUint(16);
export const CodecUint128 = CodecUint128LE;

export const CodecUint256LE = codecUint(32, true);
export const CodecUint256BE = codecUint(32);
export const CodecUint256 = CodecUint256LE;

export const CodecUint512LE = codecUint(64, true);
export const CodecUint512BE = codecUint(64);
export const CodecUint512 = CodecUint512LE;

export const CodecBool: Codec<boolean> = Codec.from({
  byteLength: 1,
  encode: (value) => bytesFrom(value ? [1] : [0]),
  decode: (buffer) => bytesFrom(buffer)[0] !== 0,
});

export const CodecByte: Codec<HexLike, Hex> = Codec.from({
  byteLength: 1,
  encode: (value) => bytesFrom(value),
  decode: (buffer) => hexFrom(buffer),
});

export const CodecByte4: Codec<HexLike, Hex> = Codec.from({
  byteLength: 4,
  encode: (value) => bytesFrom(value),
  decode: (buffer) => hexFrom(buffer),
});

export const CodecByte8: Codec<HexLike, Hex> = Codec.from({
  byteLength: 8,
  encode: (value) => bytesFrom(value),
  decode: (buffer) => hexFrom(buffer),
});

export const CodecByte16: Codec<HexLike, Hex> = Codec.from({
  byteLength: 16,
  encode: (value) => bytesFrom(value),
  decode: (buffer) => hexFrom(buffer),
});

export const CodecByte32: Codec<HexLike, Hex> = Codec.from({
  byteLength: 32,
  encode: (value) => bytesFrom(value),
  decode: (buffer) => hexFrom(buffer),
});
