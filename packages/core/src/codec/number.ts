import { Num, numBeFromBytes, numBeToBytes, numFromBytes, NumLike, numToBytes } from "../num/index.js";
import { createFixedBytesCodec, FixedBytesCodec } from "./base.js";

function createUintNumberCodec(
  byteLength: number,
  littleEndian = false,
): FixedBytesCodec<number, NumLike> {
  const codec = createUintBICodec(byteLength, littleEndian);
  return {
    __isFixedCodec__: true,
    byteLength,
    pack: (packable) => codec.pack(packable),
    unpack: (unpackable) => Number(codec.unpack(unpackable)),
  };
}

const createUintBICodec = (byteLength: number, littleEndian = false) => {
  return createFixedBytesCodec<Num, NumLike>({
    byteLength,
    pack: (biIsh) => {
      if (littleEndian) {
        return numToBytes(biIsh, byteLength);
      } else {
        return numBeToBytes(biIsh, byteLength);
      }
    },
    unpack: (buf) => {
      if (littleEndian) {
        return numFromBytes(buf);
      } else {
        return numBeFromBytes(buf);
      }
    }
  });
};

export const Uint8 = createUintNumberCodec(1);

export const Uint16LE = createUintNumberCodec(2, true);
export const Uint16BE = createUintNumberCodec(2);
/**
 * @alias Uint16LE
 */
export const Uint16 = Uint16LE;

export const Uint32LE = createUintNumberCodec(4, true);
export const Uint32BE = createUintNumberCodec(4);
/**
 * @alias Uint32LE
 */
export const Uint32 = Uint32LE;

export const Uint64LE = createUintBICodec(8, true);
export const Uint64BE = createUintBICodec(8);
/**
 * @alias Uint64LE
 */
export const Uint64 = Uint64LE;

export const Uint128LE = createUintBICodec(16, true);
export const Uint128BE = createUintBICodec(16);
/**
 * @alias Uint128LE
 */
export const Uint128 = Uint128LE;

export const Uint256LE = createUintBICodec(32, true);
export const Uint256BE = createUintBICodec(32);
/**
 * @alias Uint256LE
 */
export const Uint256 = Uint256LE;

export const Uint512LE = createUintBICodec(64, true);
export const Uint512BE = createUintBICodec(64);
/**
 * @alias Uint512LE
 */
export const Uint512 = Uint512LE;
