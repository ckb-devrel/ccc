/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Bytes,
  bytesConcat,
  bytesConcatTo,
  bytesFrom,
  BytesLike,
} from "../bytes/index.js";
import {
  Num,
  numBeFromBytes,
  numBeToBytes,
  numFromBytes,
  NumLike,
  numToBytes,
} from "../num/index.js";

export type CodecLike<Encodable, Decoded = Encodable> = {
  readonly encode: (encodable: Encodable) => Bytes;
  readonly decode: (decodable: BytesLike) => Decoded;
  readonly byteLength?: number;
};
export class Codec<Encodable, Decoded = Encodable> {
  constructor(
    public readonly encode: (encodable: Encodable) => Bytes,
    public readonly decode: (decodable: BytesLike) => Decoded,
    public readonly byteLength?: number, // if provided, treat codec as fixed length
  ) {}

  static from<Encodable, Decoded = Encodable>({
    encode,
    decode,
    byteLength,
  }: CodecLike<Encodable, Decoded>): Codec<Encodable, Decoded> {
    return new Codec(
      (encodable: Encodable) => {
        const encoded = encode(encodable);
        if (byteLength !== undefined && encoded.byteLength !== byteLength) {
          throw new Error(
            `Codec.encode: expected byte length ${byteLength}, got ${encoded.byteLength}`,
          );
        }
        return encoded;
      },
      (decodable) => {
        const decodableBytes = bytesFrom(decodable);
        if (
          byteLength !== undefined &&
          decodableBytes.byteLength !== byteLength
        ) {
          throw new Error(
            `Codec.decode: expected byte length ${byteLength}, got ${decodableBytes.byteLength}`,
          );
        }
        return decode(decodable);
      },
      byteLength,
    );
  }

  map<NewEncodable = Encodable, NewDecoded = Decoded>({
    inMap,
    outMap,
  }: {
    inMap?: (encodable: NewEncodable) => Encodable;
    outMap?: (decoded: Decoded) => NewDecoded;
  }): Codec<NewEncodable, NewDecoded> {
    return new Codec(
      (encodable) =>
        this.encode((inMap ? inMap(encodable) : encodable) as Encodable),
      (buffer) =>
        (outMap
          ? outMap(this.decode(buffer))
          : this.decode(buffer)) as NewDecoded,
      this.byteLength,
    );
  }

  mapIn<NewEncodable>(
    map: (encodable: NewEncodable) => Encodable,
  ): Codec<NewEncodable, Decoded> {
    return this.map({ inMap: map });
  }

  mapOut<NewDecoded>(
    map: (decoded: Decoded) => NewDecoded,
  ): Codec<Encodable, NewDecoded> {
    return this.map({ outMap: map });
  }
}

export type EncodableType<T extends CodecLike<any, any>> =
  T extends CodecLike<infer Encodable, unknown> ? Encodable : never;
export type DecodedType<T extends CodecLike<any, any>> =
  T extends CodecLike<any, infer Decoded> ? Decoded : never;

function uint32To(numLike: NumLike) {
  return numToBytes(numLike, 4);
}

function uint32From(bytesLike: BytesLike) {
  return Number(numFromBytes(bytesLike));
}

/**
 * Vector with fixed size item codec
 * @param itemCodec fixed-size vector item codec
 */
export function fixedItemVec<Encodable, Decoded>(
  itemCodec: CodecLike<Encodable, Decoded>,
): Codec<Array<Encodable>, Array<Decoded>> {
  const itemByteLength = itemCodec.byteLength;
  if (itemByteLength === undefined) {
    throw new Error("fixedItemVec: itemCodec requires a byte length");
  }

  return Codec.from({
    encode(userDefinedItems) {
      try {
        const concatted: number[] = [];
        bytesConcatTo(concatted, uint32To(userDefinedItems.length));
        for (const item of userDefinedItems) {
          bytesConcatTo(concatted, itemCodec.encode(item));
        }
        return bytesFrom(concatted);
      } catch (e: unknown) {
        throw new Error(`fixedItemVec(${e?.toString()})`);
      }
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      if (value.byteLength < 4) {
        throw new Error(
          `fixedItemVec: too short buffer, expected at least 4 bytes, but got ${value.byteLength}`,
        );
      }
      const itemCount = uint32From(value.slice(0, 4));
      const byteLength = 4 + itemCount * itemByteLength;
      if (value.byteLength !== byteLength) {
        throw new Error(
          `fixedItemVec: invalid buffer size, expected ${byteLength}, but got ${value.byteLength}`,
        );
      }

      try {
        const decodedArray: Array<Decoded> = [];
        for (let offset = 4; offset < byteLength; offset += itemByteLength) {
          decodedArray.push(
            itemCodec.decode(value.slice(offset, offset + itemByteLength)),
          );
        }
        return decodedArray;
      } catch (e) {
        throw new Error(`fixedItemVec(${e?.toString()})`);
      }
    },
  });
}

/**
 * Vector with dynamic size item codec, you can create a recursive vector with this function
 * @param itemCodec the vector item codec. It can be fixed-size or dynamic-size.
 */
export function dynItemVec<Encodable, Decoded>(
  itemCodec: CodecLike<Encodable, Decoded>,
): Codec<Array<Encodable>, Array<Decoded>> {
  return Codec.from({
    encode(userDefinedItems) {
      try {
        let offset = 4 + userDefinedItems.length * 4;
        const header: number[] = [];
        const body: number[] = [];

        for (const item of userDefinedItems) {
          const encoded = itemCodec.encode(item);
          bytesConcatTo(header, uint32To(offset));
          bytesConcatTo(body, encoded);
          offset += encoded.byteLength;
        }

        const packedTotalSize = uint32To(header.length + body.length + 4);
        return bytesConcat(packedTotalSize, header, body);
      } catch (e) {
        throw new Error(`dynItemVec(${e?.toString()})`);
      }
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      if (value.byteLength < 4) {
        throw new Error(
          `dynItemVec: too short buffer, expected at least 4 bytes, but got ${value.byteLength}`,
        );
      }
      const byteLength = uint32From(value.slice(0, 4));
      if (byteLength !== value.byteLength) {
        throw new Error(
          `dynItemVec: invalid buffer size, expected ${byteLength}, but got ${value.byteLength}`,
        );
      }

      if (byteLength === 4) {
        return [];
      }

      const offset = uint32From(value.slice(4, 8));
      const itemCount = (offset - 4) / 4;
      const offsets = Array.from(new Array(itemCount), (_, index) =>
        uint32From(value.slice(4 + index * 4, 8 + index * 4)),
      );
      offsets.push(byteLength);
      try {
        const decodedArray: Array<Decoded> = [];
        for (let index = 0; index < offsets.length - 1; index++) {
          const start = offsets[index];
          const end = offsets[index + 1];
          const itemBuffer = value.slice(start, end);
          decodedArray.push(itemCodec.decode(itemBuffer));
        }
        return decodedArray;
      } catch (e) {
        throw new Error(`dynItemVec(${e?.toString()})`);
      }
    },
  });
}

/**
 * General vector codec, if `itemCodec` is fixed size type, it will create a fixvec codec, otherwise a dynvec codec will be created.
 * @param itemCodec
 */
export function vector<Encodable, Decoded>(
  itemCodec: CodecLike<Encodable, Decoded>,
): Codec<Array<Encodable>, Array<Decoded>> {
  if (itemCodec.byteLength !== undefined) {
    return fixedItemVec(itemCodec);
  }
  return dynItemVec(itemCodec);
}

/**
 * Option is a dynamic-size type.
 * Serializing an option depends on whether it is empty or not:
 * - if it's empty, there is zero bytes (the size is 0).
 * - if it's not empty, just serialize the inner item (the size is same as the inner item's size).
 * @param innerCodec
 */
export function option<Encodable, Decoded>(
  innerCodec: CodecLike<Encodable, Decoded>,
): Codec<Encodable | undefined | null, Decoded | undefined> {
  return Codec.from({
    encode(userDefinedOrNull) {
      if (!userDefinedOrNull) {
        return bytesFrom([]);
      }
      try {
        return innerCodec.encode(userDefinedOrNull);
      } catch (e) {
        throw new Error(`option(${e?.toString()})`);
      }
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      if (value.byteLength === 0) {
        return undefined;
      }
      try {
        return innerCodec.decode(buffer);
      } catch (e) {
        throw new Error(`option(${e?.toString()})`);
      }
    },
  });
}

/**
 * Wrap the encoded value with a fixed-length buffer
 * @param codec
 */
export function byteVec<Encodable, Decoded>(
  codec: CodecLike<Encodable, Decoded>,
): Codec<Encodable, Decoded> {
  return Codec.from({
    encode(userDefined) {
      try {
        const payload = bytesFrom(codec.encode(userDefined));
        const byteLength = uint32To(payload.byteLength);
        return bytesConcat(byteLength, payload);
      } catch (e) {
        throw new Error(`byteVec(${e?.toString()})`);
      }
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      if (value.byteLength < 4) {
        throw new Error(
          `byteVec: too short buffer, expected at least 4 bytes, but got ${value.byteLength}`,
        );
      }
      const byteLength = uint32From(value.slice(0, 4));
      if (byteLength !== value.byteLength - 4) {
        throw new Error(
          `byteVec: invalid buffer size, expected ${byteLength}, but got ${value.byteLength}`,
        );
      }
      try {
        return codec.decode(value.slice(4));
      } catch (e: unknown) {
        throw new Error(`byteVec(${e?.toString()})`);
      }
    },
  });
}

export type EncodableRecordOptionalKeys<
  T extends Record<string, CodecLike<any, any>>,
> = {
  [K in keyof T]: Extract<EncodableType<T[K]>, undefined> extends never
    ? never
    : K;
}[keyof T];
export type EncodableRecord<T extends Record<string, CodecLike<any, any>>> = {
  [key in keyof Pick<T, EncodableRecordOptionalKeys<T>>]+?: EncodableType<
    T[key]
  >;
} & {
  [key in keyof Omit<T, EncodableRecordOptionalKeys<T>>]: EncodableType<T[key]>;
};

export type DecodedRecordOptionalKeys<
  T extends Record<string, CodecLike<any, any>>,
> = {
  [K in keyof T]: Extract<DecodedType<T[K]>, undefined> extends never
    ? never
    : K;
}[keyof T];
export type DecodedRecord<T extends Record<string, CodecLike<any, any>>> = {
  [key in keyof Pick<T, DecodedRecordOptionalKeys<T>>]+?: DecodedType<T[key]>;
} & {
  [key in keyof Omit<T, DecodedRecordOptionalKeys<T>>]: DecodedType<T[key]>;
};

/**
 * Table is a dynamic-size type. It can be considered as a dynvec but the length is fixed.
 * @param codecLayout
 */
export function table<
  T extends Record<string, CodecLike<any, any>>,
  Encodable extends EncodableRecord<T>,
  Decoded extends DecodedRecord<T>,
>(codecLayout: T): Codec<Encodable, Decoded> {
  const keys = Object.keys(codecLayout);

  return Codec.from({
    encode(object) {
      let offset = 4 + keys.length * 4;
      const header: number[] = [];
      const body: number[] = [];

      for (const key of keys) {
        try {
          const encoded = codecLayout[key].encode((object as any)[key]);
          bytesConcatTo(header, uint32To(offset));
          bytesConcatTo(body, encoded);
          offset += encoded.byteLength;
        } catch (e: unknown) {
          throw new Error(`table.${key}(${e?.toString()})`);
        }
      }

      const packedTotalSize = uint32To(header.length + body.length + 4);
      return bytesConcat(packedTotalSize, header, body);
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      if (value.byteLength < 4) {
        throw new Error(
          `table: too short buffer, expected at least 4 bytes, but got ${value.byteLength}`,
        );
      }
      const byteLength = uint32From(value.slice(0, 4));
      if (byteLength !== value.byteLength) {
        throw new Error(
          `table: invalid buffer size, expected ${byteLength}, but got ${value.byteLength}`,
        );
      }
      const offsets = keys.map((_, index) =>
        uint32From(value.slice(4 + index * 4, 8 + index * 4)),
      );
      offsets.push(byteLength);
      const object = {};
      for (let i = 0; i < offsets.length - 1; i++) {
        const start = offsets[i];
        const end = offsets[i + 1];
        const field = keys[i];
        const codec = codecLayout[field];
        const payload = value.slice(start, end);
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          Object.assign(object, { [field]: codec.decode(payload) });
        } catch (e: unknown) {
          throw new Error(`table.${field}(${e?.toString()})`);
        }
      }
      return object as Decoded;
    },
  });
}

type UnionEncodable<
  T extends Record<string, CodecLike<any, any>>,
  K extends keyof T = keyof T,
> = K extends unknown
  ? {
      type: K;
      value: EncodableType<T[K]>;
    }
  : never;
type UnionDecoded<
  T extends Record<string, CodecLike<any, any>>,
  K extends keyof T = keyof T,
> = K extends unknown
  ? {
      type: K;
      value: DecodedType<T[K]>;
    }
  : never;

/**
 * Union is a dynamic-size type.
 * Serializing a union has two steps:
 * - Serialize an item type id in bytes as a 32 bit unsigned integer in little-endian. The item type id is the index of the inner items, and it's starting at 0.
 * - Serialize the inner item.
 * @param codecLayout the union item record
 * @param fields the custom item type id record
 * @example
 * // without custom id
 * union({ cafe: Uint8, bee: Uint8 })
 * // with custom id
 * union({ cafe: Uint8, bee: Uint8 }, { cafe: 0xcafe, bee: 0xbee })
 */
export function union<T extends Record<string, CodecLike<any, any>>>(
  codecLayout: T,
  fields?: Record<keyof T, number | undefined | null>,
): Codec<UnionEncodable<T>, UnionDecoded<T>> {
  const keys = Object.keys(codecLayout);

  return Codec.from({
    encode({ type, value }) {
      const typeStr = type.toString();
      const codec = codecLayout[typeStr];
      if (!codec) {
        throw new Error(
          `union: invalid type, expected ${keys.toString()}, but got ${typeStr}`,
        );
      }
      const fieldId = fields ? (fields[typeStr] ?? -1) : keys.indexOf(typeStr);
      if (fieldId < 0) {
        throw new Error(`union: invalid field id ${fieldId} of ${typeStr}`);
      }
      const header = uint32To(fieldId);
      try {
        const body = codec.encode(value);
        return bytesConcat(header, body);
      } catch (e: unknown) {
        throw new Error(`union.(${typeStr})(${e?.toString()})`);
      }
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      const fieldIndex = uint32From(value.slice(0, 4));
      const keys = Object.keys(codecLayout);

      const field = (() => {
        if (!fields) {
          return keys[fieldIndex];
        }
        const entry = Object.entries(fields).find(
          ([, id]) => id === fieldIndex,
        );
        return entry?.[0];
      })();

      if (!field) {
        if (!fields) {
          throw new Error(
            `union: unknown union field index ${fieldIndex}, only ${keys.toString()} are allowed`,
          );
        }
        const fieldKeys = Object.keys(fields);
        throw new Error(
          `union: unknown union field index ${fieldIndex}, only ${fieldKeys.toString()} and ${keys.toString()} are allowed`,
        );
      }

      return {
        type: field,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        value: codecLayout[field].decode(value.slice(4)),
      } as UnionDecoded<T>;
    },
  });
}

/**
 * Struct is a fixed-size type: all fields in struct are fixed-size and it has a fixed quantity of fields.
 * The size of a struct is the sum of all fields' size.
 * @param codecLayout a object contains all fields' codec
 */
export function struct<
  T extends Record<string, CodecLike<any, any>>,
  Encodable extends EncodableRecord<T>,
  Decoded extends DecodedRecord<T>,
>(codecLayout: T): Codec<Encodable, Decoded> {
  const codecArray = Object.values(codecLayout);
  const keys = Object.keys(codecLayout);

  return Codec.from({
    byteLength: codecArray.reduce((acc, codec) => {
      if (codec.byteLength === undefined) {
        throw new Error("struct: all fields must be fixed-size");
      }
      return acc + codec.byteLength;
    }, 0),
    encode(object) {
      const bytes: number[] = [];
      for (const key of keys) {
        try {
          const encoded = codecLayout[key].encode((object as any)[key]);
          bytesConcatTo(bytes, encoded);
        } catch (e: unknown) {
          throw new Error(`struct.${key}(${e?.toString()})`);
        }
      }

      return bytesFrom(bytes);
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      const object = {};
      let offset = 0;
      Object.entries(codecLayout).forEach(([key, codec]) => {
        const payload = value.slice(offset, offset + codec.byteLength!);
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          Object.assign(object, { [key]: codec.decode(payload) });
        } catch (e: unknown) {
          throw new Error(`struct.${key}(${(e as Error).toString()})`);
        }
        offset = offset + codec.byteLength!;
      });
      return object as Decoded;
    },
  });
}

/**
 * The array is a fixed-size type: it has a fixed-size inner type and a fixed length.
 * The size of an array is the size of inner type times the length.
 * @param itemCodec the fixed-size array item codec
 * @param itemCount
 */
export function array<Encodable, Decoded>(
  itemCodec: CodecLike<Encodable, Decoded>,
  itemCount: number,
): Codec<Array<Encodable>, Array<Decoded>> {
  if (itemCodec.byteLength === undefined) {
    throw new Error("array: itemCodec requires a byte length");
  }
  const byteLength = itemCodec.byteLength * itemCount;

  return Codec.from({
    byteLength,
    encode(items) {
      try {
        const bytes: number[] = [];
        for (const item of items) {
          bytesConcatTo(bytes, itemCodec.encode(item));
        }

        return bytesFrom(bytes);
      } catch (e: unknown) {
        throw new Error(`array(${e?.toString()})`);
      }
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      if (value.byteLength != byteLength) {
        throw new Error(
          `array: invalid buffer size, expected ${byteLength}, but got ${value.byteLength}`,
        );
      }
      try {
        const result: Array<Decoded> = [];
        for (let i = 0; i < value.byteLength; i += itemCodec.byteLength!) {
          result.push(
            itemCodec.decode(value.slice(i, i + itemCodec.byteLength!)),
          );
        }
        return result;
      } catch (e: unknown) {
        throw new Error(`array(${e?.toString()})`);
      }
    },
  });
}

/**
 * Create a codec to deal with fixed LE or BE bytes.
 * @param byteLength
 * @param littleEndian
 */
export function uint(
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
export function uintNumber(
  byteLength: number,
  littleEndian = false,
): Codec<NumLike, number> {
  if (byteLength > 4) {
    throw new Error("uintNumber: byteLength must be less than or equal to 4");
  }
  return uint(byteLength, littleEndian).map({
    outMap: (num) => Number(num),
  });
}
