import { bytesConcat } from "../../bytes/index.js";
import {
  BytesCodec,
  createBytesCodec,
  createFixedBytesCodec,
  FixedBytesCodec,
} from "../base.js";
import { Uint32LE } from "../number.js";
import { assertBufferLength, assertMinBufferLength } from "../utils.js";

/**
 * a helper function to create custom codec of `array SomeType [byte; n]`
 * @param codec
 */
export function byteArrayOf<Packed, Packable = Packed>(
  codec: BytesCodec<Packed, Packable> & { byteLength: number },
): FixedBytesCodec<Packed, Packable> {
  const byteLength = codec.byteLength;
  return createFixedBytesCodec({
    byteLength,
    encode: (packable) => codec.encode(packable),
    decode: (buf) => codec.decode(buf),
  });
}

/**
 * a helper function to create custom codec of `byte`
 * @param codec
 */
export function byteOf<Packed, Packable = Packed>(
  codec: BytesCodec<Packed, Packable>,
): FixedBytesCodec<Packed, Packable> {
  return byteArrayOf({ ...codec, byteLength: 1 });
}

/**
 * a helper function to create custom codec of `vector Bytes <byte>`
 * @param codec
 */
export function byteVecOf<Packed, Packable = Packed>(
  codec: BytesCodec<Packed, Packable>,
): BytesCodec<Packed, Packable> {
  return createBytesCodec({
    encode(unpacked) {
      const payload = codec.encode(unpacked);
      const header = Uint32LE.encode(payload.byteLength);

      return bytesConcat(header, payload);
    },
    decode(packed) {
      assertMinBufferLength(packed, 4);
      const header = Uint32LE.decode(packed.slice(0, 4));
      assertBufferLength(packed.slice(4), header);
      return codec.decode(packed.slice(4));
    },
  });
}
