/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import {
  AnyCodec,
  Codec,
  PackParam,
  PackResult,
  UnpackParam,
  UnpackResult,
} from "./base.js";
import { CODEC_OPTIONAL_PATH } from "./error.js";
import { trackCodeExecuteError } from "./utils.js";

export interface NullableCodec<C extends AnyCodec = AnyCodec> extends AnyCodec {
  encode(packable?: PackParam<C>): PackResult<C>;

  decode(unpackable?: UnpackParam<C>): UnpackResult<C>;
}

export function createNullableCodec<C extends AnyCodec = AnyCodec>(
  codec: C,
): NullableCodec<C> {
  return {
    encode: (packable) => {
      if (packable == null) return packable;
      return trackCodeExecuteError(CODEC_OPTIONAL_PATH, () =>
        codec.encode(packable),
      );
    },
    decode: (unpackable) => {
      if (unpackable == null) return unpackable;
      return codec.decode(unpackable);
    },
  };
}

type ObjectCodecShape = Record<string, AnyCodec>;
export type ObjectCodec<Shape extends ObjectCodecShape = ObjectCodecShape> =
  Codec<
    { [key in keyof Shape]: PackResult<Shape[key]> },
    { [key in keyof Shape]: UnpackResult<Shape[key]> },
    { [key in keyof Shape]: PackParam<Shape[key]> },
    { [key in keyof Shape]: UnpackParam<Shape[key]> }
  >;

/**
 * a high-order codec that helps to organize multiple codecs together into a single object
 * @param codecShape
 * @example
 * ```ts
 * const codec = createObjectCodec({
 *   r: Uint8,
 *   g: Uint8,
 *   b: Uint8,
 * });
 *
 * // { r: ArrayBuffer([0xff]), g: ArrayBuffer([0x00]), b: ArrayBuffer([0x00]) }
 * codec.pack({ r: 255, g: 0, b: 0 });
 * ```
 */
export function createObjectCodec<Shape extends ObjectCodecShape>(
  codecShape: Shape,
): ObjectCodec<Shape> {
  const codecEntries = Object.entries(codecShape);

  return {
    encode: (packableObj) => {
      const result = {} as { [key in keyof Shape]: PackResult<Shape[key]> };

      codecEntries.forEach(([key, itemCodec]) => {
        Object.assign(result, {
          [key]: trackCodeExecuteError(key, () =>
            itemCodec.encode(packableObj[key]),
          ),
        });
      });

      return result;
    },
    decode: (unpackableObj) => {
      const result = {} as { [key in keyof Shape]: UnpackResult<Shape[key]> };

      codecEntries.forEach(([key, itemCodec]) => {
        Object.assign(result, { [key]: itemCodec.decode(unpackableObj[key]) });
      });

      return result;
    },
  };
}

export type ArrayCodec<C extends AnyCodec> = Codec<
  PackResult<C>[],
  UnpackResult<C>[],
  PackParam<C>[],
  UnpackParam<C>[]
>;

export function createArrayCodec<C extends AnyCodec>(codec: C): ArrayCodec<C> {
  return {
    encode: (items) =>
      items.map((item, index) =>
        trackCodeExecuteError(index, () => codec.encode(item)),
      ),
    decode: (items) => items.map((item) => codec.decode(item)),
  };
}

/**
 * @param codec
 * @param afterCodecPack
 * @param beforeCodecUnpack
 */
export function enhancePack<C extends AnyCodec, Packed>(
  codec: C,
  afterCodecPack: (arg: PackResult<C>) => Packed,
  beforeCodecUnpack: (arg: Packed) => UnpackParam<C>,
): Codec<Packed, UnpackResult<C>, PackParam<C>> {
  return {
    encode: (packable) => afterCodecPack(codec.encode(packable)),
    decode: (unpackable) => codec.decode(beforeCodecUnpack(unpackable)),
  };
}
