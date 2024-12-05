/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { bytesConcat, bytesFrom } from "../bytes/index.js";
import { Codec, EncodableType } from "./codec.js";
import { Uint32LE } from "./predefined.js";

/**
 * Vector with fixed size item codec
 * @param itemCodec fixed-size vector item codec
 */
export function fixedItemVec<Encodable>(
  itemCodec: Codec<Encodable>,
): Codec<Array<Encodable>> {
  if (itemCodec.byteLength === undefined) {
    throw new Error("fixedItemVec: itemCodec requires a byte length");
  }
  return {
    encode(userDefinedItems) {
      try {
        return userDefinedItems.reduce(
          (concated, item) => bytesConcat(concated, itemCodec.encode(item)),
          Uint32LE.encode(userDefinedItems.length),
        );
      } catch (e: any) {
        throw new Error(`fixedItemVec(${(e as Error).toString()})`);
      }
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      if (value.byteLength < 4) {
        throw new Error(
          `fixedItemVec: too short buffer, expected at least 4 bytes, but got ${value.byteLength}`,
        );
      }
      const itemCount = Uint32LE.decode(value.slice(0, 4));
      const itemByteLength = itemCodec.byteLength!;
      const byteLength = 4 + itemCount * itemByteLength;
      if (value.byteLength !== byteLength) {
        throw new Error(
          `fixedItemVec: invalid buffer size, expected ${byteLength}, but got ${value.byteLength}`,
        );
      }
      const decodedArray: Array<Encodable> = [];
      for (let offset = 0; offset < byteLength; offset += itemByteLength) {
        try {
          decodedArray.push(
            itemCodec.decode(value.slice(offset, offset + itemByteLength)),
          );
        } catch (e: any) {
          throw new Error(`fixedItemVec(${(e as Error).toString()})`);
        }
      }
      return decodedArray;
    },
  };
}

/**
 * Vector with dynamic size item codec, you can create a recursive vector with this function
 * @param itemCodec the vector item codec. It can be fixed-size or dynamic-size.
 */
export function dynItemVec<Encodable>(
  itemCodec: Codec<Encodable>,
): Codec<Array<Encodable>> {
  return {
    encode(userDefinedItems) {
      const encoded = userDefinedItems.reduce(
        (result, item) => {
          try {
            const encodedItem = itemCodec.encode(item);
            const packedHeader = Uint32LE.encode(result.offset);
            return {
              header: bytesConcat(result.header, packedHeader),
              body: bytesConcat(result.body, encodedItem),
              offset: result.offset + bytesFrom(encodedItem).byteLength,
            };
          } catch (e: any) {
            throw new Error(`dynItemVec(${(e as Error).toString()})`);
          }
        },
        {
          header: Uint8Array.from([]),
          body: Uint8Array.from([]),
          offset: 4 + userDefinedItems.length * 4,
        },
      );
      const packedTotalSize = Uint32LE.encode(
        encoded.header.byteLength + encoded.body.byteLength + 4,
      );
      return bytesConcat(packedTotalSize, encoded.header, encoded.body);
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      const byteLength = Uint32LE.decode(value.slice(0, 4));
      if (byteLength !== value.byteLength) {
        throw new Error(
          `dynItemVec: invalid buffer size, expected ${byteLength}, but got ${value.byteLength}`,
        );
      }
      const decodedArray: Array<Encodable> = [];
      if (byteLength <= 4) {
        return decodedArray;
      } else {
        const offset = Uint32LE.decode(value.slice(4, 8));
        const itemCount = (offset - 4) / 4;
        const offsets = new Array(itemCount)
          .fill(1)
          .map((_, index) =>
            Uint32LE.decode(value.slice(4 + index * 4, 8 + index * 4)),
          );
        offsets.push(byteLength);
        for (let index = 0; index < offsets.length - 1; index++) {
          const start = offsets[index];
          const end = offsets[index + 1];
          const itemBuffer = value.slice(start, end);
          try {
            decodedArray.push(itemCodec.decode(itemBuffer));
          } catch (e: any) {
            throw new Error(`dynItemVec(${(e as Error).toString()})`);
          }
        }
        return decodedArray;
      }
    },
  };
}

/**
 * General vector codec, if `itemCodec` is fixed size type, it will create a fixvec codec, otherwise a dynvec codec will be created.
 * @param itemCodec
 */
export function vector<Encodable>(
  itemCodec: Codec<Encodable>,
): Codec<Array<Encodable>> {
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
export function option<Encodable>(
  innerCodec: Codec<Encodable>,
): Codec<Encodable | undefined | null> {
  return {
    encode(userDefinedOrNull) {
      if (!userDefinedOrNull) {
        return bytesFrom([]);
      }
      try {
        return innerCodec.encode(userDefinedOrNull);
      } catch (e: any) {
        throw new Error(`option(${(e as Error).toString()})`);
      }
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      if (value.byteLength === 0) {
        return undefined;
      }
      try {
        return innerCodec.decode(buffer);
      } catch (e: any) {
        throw new Error(`option(${(e as Error).toString()})`);
      }
    },
  };
}

/**
 * Wrap the encoded value with a fixed-length buffer
 * @param codec
 */
export function byteVec<Encodable>(codec: Codec<Encodable>): Codec<Encodable> {
  return {
    encode(userDefined) {
      try {
        const payload = bytesFrom(codec.encode(userDefined));
        const byteLength = Uint32LE.encode(payload.byteLength);
        return bytesConcat(byteLength, payload);
      } catch (e: any) {
        throw new Error(`byteVec(${(e as Error).toString()})`);
      }
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      if (value.byteLength < 4) {
        throw new Error(
          `byteVec: too short buffer, expected at least 4 bytes, but got ${value.byteLength}`,
        );
      }
      const byteLength = Uint32LE.decode(value.slice(0, 4));
      if (byteLength !== value.byteLength) {
        throw new Error(
          `byteVec: invalid buffer size, expected ${byteLength}, but got ${value.byteLength}`,
        );
      }
      try {
        return codec.decode(value.slice(4));
      } catch (e: any) {
        throw new Error(`byteVec(${(e as Error).toString()})`);
      }
    },
  };
}

/**
 * Table is a dynamic-size type. It can be considered as a dynvec but the length is fixed.
 * @param codecLayout
 */
export function table<
  T extends Record<string, Codec<any>>,
  R extends object = { [key in keyof T]: EncodableType<T[key]> },
>(codecLayout: T): Codec<R> {
  return {
    encode(object) {
      const keys = Object.keys(codecLayout);
      const objectKeys = Object.keys(object);
      if (JSON.stringify(keys) !== JSON.stringify(objectKeys)) {
        throw new Error(
          `table: invalid layout fields, expected ${objectKeys.toString()}, but got ${keys.toString()}`,
        );
      }
      const headerLength = 4 + keys.length * 4;
      const { header, body } = Object.entries(object).reduce(
        (result, [key, value]) => {
          try {
            const encodedItem = codecLayout[key].encode(value);
            const packedOffset = Uint32LE.encode(result.offset);
            return {
              header: bytesConcat(result.header, packedOffset),
              body: bytesConcat(result.body, encodedItem),
              offset: result.offset + bytesFrom(encodedItem).byteLength,
            };
          } catch (e: any) {
            throw new Error(`table(${(e as Error).toString()})`);
          }
        },
        {
          header: Uint8Array.from([]),
          body: Uint8Array.from([]),
          offset: headerLength,
        },
      );
      const packedTotalSize = Uint32LE.encode(
        header.byteLength + body.byteLength + 4,
      );
      return bytesConcat(packedTotalSize, header, body);
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      const byteLength = Uint32LE.decode(value.slice(0, 4));
      if (byteLength !== value.byteLength) {
        throw new Error(
          `table: invalid buffer size, expected ${byteLength}, but got ${value.byteLength}`,
        );
      }
      if (byteLength <= 4) {
        throw new Error("table: empty buffer");
      }
      const keys = Object.keys(codecLayout);
      const offsets = keys.map((_, index) =>
        Uint32LE.decode(value.slice(4 + index * 4, 8 + index * 4)),
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
          Object.assign(object, { [field]: codec.decode(payload) });
        } catch (e: any) {
          throw new Error(`table(${(e as Error).toString()})`);
        }
      }
      return object as R;
    },
  };
}

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
export function union<
  T extends Record<string, Codec<any>>,
  R extends object = { [key in keyof T]?: EncodableType<T[key]> },
>(codecLayout: T, fields?: Record<keyof T, number>): Codec<R> {
  return {
    encode(object) {
      const keys = Object.keys(codecLayout);
      const objectKey = Object.keys(object)[0];
      if (!keys.includes(objectKey)) {
        throw new Error(
          `union: invalid object key, expected ${keys.toString()}, but got ${objectKey.toString()}`,
        );
      }
      const fieldIndex = fields
        ? (fields[objectKey] ?? -1)
        : keys.indexOf(objectKey);
      if (fieldIndex < 0) {
        throw new Error(`union: invalid field id of ${objectKey}`);
      }
      const header = Uint32LE.encode(fieldIndex);
      try {
        const body = codecLayout[objectKey].encode(Object.values(object)[0]);
        return bytesConcat(header, body);
      } catch (e: any) {
        throw new Error(`union(${(e as Error).toString()})`);
      }
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      const fieldIndex = Uint32LE.decode(value.slice(0, 4));
      const keys = Object.keys(codecLayout);
      const field = (() => {
        if (fields) {
          const entry = Object.entries(fields).find(
            ([, id]) => id === fieldIndex,
          );
          return entry?.[0];
        }
        return keys[fieldIndex];
      })();
      if (!field) {
        if (fields) {
          const fieldKeys = Object.keys(fields);
          throw new Error(
            `union: unknown union field index ${fieldIndex}, only ${fieldKeys.toString()} are allowed`,
          );
        } else {
          throw new Error(
            `union: unknown union field index ${fieldIndex}, only ${keys.toString()} are allowed`,
          );
        }
      }
      const payload = value.slice(4);
      const codec = codecLayout[field];
      const object = {};
      try {
        Object.assign(object, { [field]: codec.decode(payload) });
      } catch (e: any) {
        throw new Error(`union(${(e as Error).toString()})`);
      }
      return object as R;
    },
  };
}

/**
 * Struct is a fixed-size type: all fields in struct are fixed-size and it has a fixed quantity of fields.
 * The size of a struct is the sum of all fields' size.
 * @param codecLayout a object contains all fields' codec
 */
export function struct<
  T extends Record<string, Codec<any>>,
  R extends object = { [key in keyof T]: EncodableType<T[key]> },
>(codecLayout: T): Codec<R> {
  const codecArray = Object.values(codecLayout);
  if (codecArray.some((codec) => codec.byteLength === undefined)) {
    throw new Error("struct: all fields must be fixed-size");
  }
  return {
    byteLength: codecArray.reduce((sum, codec) => sum + codec.byteLength!, 0),
    encode(object) {
      const keys = Object.keys(codecLayout);
      const objectKeys = Object.keys(object);
      if (JSON.stringify(keys) !== JSON.stringify(objectKeys)) {
        throw new Error(
          `struct: invalid layout fields, expected ${objectKeys.toString()}, but got ${keys.toString()}`,
        );
      }
      try {
        return Object.entries(object).reduce((result, [key, value]) => {
          const encodedItem = codecLayout[key].encode(value);
          return bytesConcat(result, encodedItem);
        }, Uint8Array.from([]));
      } catch (e: any) {
        throw new Error(`struct(${(e as Error).toString()})`);
      }
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      const object = {};
      let offset = 0;
      Object.entries(codecLayout).forEach(([key, codec]) => {
        const payload = value.slice(offset, offset + codec.byteLength!);
        try {
          Object.assign(object, { [key]: codec.decode(payload) });
        } catch (e: any) {
          throw new Error(`struct(${(e as Error).toString()})`);
        }
        offset = offset + codec.byteLength!;
      });
      return object as R;
    },
  };
}

/**
 * The array is a fixed-size type: it has a fixed-size inner type and a fixed length.
 * The size of an array is the size of inner type times the length.
 * @param itemCodec the fixed-size array item codec
 * @param itemCount
 */
export function array<Encodable>(
  itemCodec: Codec<Encodable>,
  itemCount: number,
): Codec<Array<Encodable>> {
  if (itemCodec.byteLength === undefined) {
    throw new Error("array: itemCodec requires a byte length");
  }
  const byteLength = itemCodec.byteLength * itemCount;
  return {
    byteLength,
    encode(items) {
      try {
        return items.reduce(
          (concated, item) => bytesConcat(concated, itemCodec.encode(item)),
          Uint8Array.from([]),
        );
      } catch (e: any) {
        throw new Error(`array(${(e as Error).toString()})`);
      }
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      if (value.byteLength != byteLength) {
        throw new Error(
          `array: invalid buffer size, expected ${byteLength}, but got ${value.byteLength}`,
        );
      }
      const result: Array<Encodable> = [];
      for (let i = 0; i < value.byteLength; i += itemCodec.byteLength!) {
        try {
          result.push(
            itemCodec.decode(value.slice(i, i + itemCodec.byteLength!)),
          );
        } catch (e: any) {
          throw new Error(`array(${(e as Error).toString()})`);
        }
      }
      return result;
    },
  };
}
