/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { bytesConcat, bytesFrom, BytesLike } from "../bytes/index.js";
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
      const encodedArray = userDefinedItems.map((item) =>
        itemCodec.encode(item),
      );
      return bytesConcat(
        Uint32LE.encode(BigInt(userDefinedItems.length)),
        encodedArray.reduce(
          (concated, item) => bytesConcat(concated, item),
          new ArrayBuffer(0),
        ),
      );
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      if (value.byteLength < 4) {
        throw new Error(
          `fixedItemVec: too short buffer, expected at least 4 bytes, but got ${value.byteLength}`,
        );
      }
      const itemCount = Number(Uint32LE.decode(value.slice(0, 4)));
      const itemByteLength = itemCodec.byteLength!;
      const byteLength = 4 + itemCount * itemByteLength;
      if (value.byteLength !== byteLength) {
        throw new Error(
          `fixedItemVec: invalid buffer size, expected ${byteLength}, but got ${value.byteLength}`,
        );
      }
      const decodedArray: Array<Encodable> = [];
      for (let offset = 0; offset < byteLength; offset += itemByteLength) {
        decodedArray.push(
          itemCodec.decode(value.slice(offset, offset + itemByteLength)),
        );
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
      const encodedArray = userDefinedItems.map((item) =>
        itemCodec.encode(item),
      );
      const packed = encodedArray.reduce(
        (result, item) => {
          const packedHeader = Uint32LE.encode(BigInt(result.offset));
          return {
            header: bytesConcat(result.header, packedHeader),
            body: bytesConcat(result.body, item),
            offset: result.offset + bytesFrom(item).byteLength,
          };
        },
        {
          header: new ArrayBuffer(0),
          body: new ArrayBuffer(0),
          offset: 4 + userDefinedItems.length * 4,
        },
      );
      const packedTotalSize = Uint32LE.encode(
        BigInt(packed.header.byteLength + packed.body.byteLength + 4),
      );
      return bytesConcat(packedTotalSize, packed.header, packed.body);
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      const byteLength = Uint32LE.decode(value.slice(0, 4));
      if (byteLength !== BigInt(value.byteLength)) {
        throw new Error(
          `dynItemVec: invalid buffer size, expected ${byteLength}, but got ${value.byteLength}`,
        );
      }
      const decodedArray: Array<Encodable> = [];
      if (byteLength <= 4) {
        return decodedArray;
      } else {
        const offset = Number(Uint32LE.decode(value.slice(4, 8)));
        const itemCount = (offset - 4) / 4;
        const offsets = new Array(itemCount)
          .fill(1)
          .map((_, index) =>
            Uint32LE.decode(value.slice(4 + index * 4, 8 + index * 4)),
          );
        offsets.push(byteLength);
        for (let index = 0; index < offsets.length - 1; index++) {
          const start = Number(offsets[index]);
          const end = Number(offsets[index + 1]);
          const itemBuffer = value.slice(start, end);
          decodedArray.push(itemCodec.decode(itemBuffer));
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
): Codec<Encodable | undefined> {
  return {
    encode(userDefinedOrNull) {
      if (userDefinedOrNull === undefined) {
        return Uint8Array.from([]);
      }
      return innerCodec.encode(userDefinedOrNull);
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      if (value.byteLength === 0) {
        return undefined;
      }
      return innerCodec.decode(buffer);
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
      const payload = bytesFrom(codec.encode(userDefined));
      const byteLength = Uint32LE.encode(BigInt(payload.byteLength));
      return bytesConcat(byteLength, payload);
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      if (value.byteLength < 4) {
        throw new Error(
          `byteVec: too short buffer, expected at least 4 bytes, but got ${value.byteLength}`,
        );
      }
      const byteLength = Uint32LE.decode(value.slice(0, 4));
      if (byteLength !== BigInt(value.byteLength)) {
        throw new Error(
          `byteVec: invalid buffer size, expected ${byteLength}, but got ${value.byteLength}`,
        );
      }
      return codec.decode(value.slice(4));
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
      const encodedArray = Object.entries(object).map(([key, value]) =>
        codecLayout[key].encode(value),
      );
      const { header, body } = encodedArray.reduce(
        (result, encodedItem) => {
          const packedOffset = Uint32LE.encode(BigInt(result.offset));
          return {
            header: bytesConcat(result.header, packedOffset),
            body: bytesConcat(result.body, encodedItem),
            offset: result.offset + bytesFrom(encodedItem).byteLength,
          };
        },
        {
          header: new ArrayBuffer(0),
          body: new ArrayBuffer(0),
          offset: headerLength,
        },
      );
      const packedTotalSize = Uint32LE.encode(
        BigInt(header.byteLength + body.byteLength + 4),
      );
      return bytesConcat(packedTotalSize, header, body);
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      const byteLength = Number(Uint32LE.decode(value.slice(0, 4)));
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
        Number(Uint32LE.decode(value.slice(4 + index * 4, 8 + index * 4))),
      );
      offsets.push(byteLength);
      const object = {};
      for (let i = 0; i < offsets.length - 1; i++) {
        const start = offsets[i];
        const end = offsets[i + 1];
        const field = keys[i];
        const codec = codecLayout[field];
        const payload = value.slice(start, end);
        Object.assign(object, { [field]: codec.decode(payload) });
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
>(codecLayout: T, fields?: Record<keyof T, number>): Codec<R, BytesLike> {
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
      const header = Uint32LE.encode(BigInt(fieldIndex));
      const body = codecLayout[objectKey].encode(Object.values(object)[0]);
      return bytesConcat(header, body);
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      const fieldIndex = Number(Uint32LE.decode(value.slice(0, 4)));
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
      Object.assign(object, { [field]: codec.decode(payload) });
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
  if (codecArray.find((codec) => codec.byteLength === undefined)) {
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
      const encodedArray = Object.entries(object).map(([field, value]) =>
        codecLayout[field].encode(value),
      );
      return encodedArray.reduce((result, encoded) => {
        return bytesConcat(result, encoded);
      }, Uint8Array.from([]));
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      const object = {};
      let offset = 0;
      Object.entries(codecLayout).forEach(([field, codec]) => {
        const payload = value.slice(offset, offset + codec.byteLength!);
        Object.assign(object, { [field]: codec.decode(payload) });
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
      const encodedArray = items.map((item) => itemCodec.encode(item));
      return bytesConcat(...encodedArray);
    },
    decode(buffer) {
      const value = bytesFrom(buffer);
      if (value.byteLength != byteLength) {
        throw new Error(
          `array: invalid buffer size, expected ${byteLength}, but got ${value.byteLength}`,
        );
      }
      const result: Encodable[] = [];
      for (
        let offset = 0;
        offset < value.byteLength;
        offset += itemCodec.byteLength!
      ) {
        result.push(
          itemCodec.decode(value.slice(offset, offset + itemCodec.byteLength!)),
        );
      }
      return result;
    },
  };
}
