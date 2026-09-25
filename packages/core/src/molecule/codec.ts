/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Bytes,
  bytesConcat,
  bytesConcatTo,
  bytesFrom,
  BytesLike,
} from "../bytes/index.js";
import {
  Codec,
  CodecLike,
  DecodedType,
  EncodableType,
} from "../codec/codec.js";
import { numFromBytes, NumLike, numToBytes } from "../num/index.js";

export {
  /**
   * @deprecated Use ccc.Codec instead
   */
  Codec,
  /**
   * @deprecated Use ccc.codecUint instead
   */
  codecUint as uint,
  /**
   * @deprecated Use ccc.codecUintNumber instead
   */
  codecUintNumber as uintNumber,
  /**
   * @deprecated Use ccc.CodecLike instead
   */
  type CodecLike,
  /**
   * @deprecated Use ccc.DecodedType instead
   */
  type DecodedType,
  /**
   * @deprecated Use ccc.EncodableType instead
   */
  type EncodableType,
} from "../codec/index.js";

function uint32To(numLike: NumLike) {
  return numToBytes(numLike, 4);
}

function uint32From(bytesLike: BytesLike) {
  return Number(numFromBytes(bytesLike));
}

function getMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function isPositiveSafeInteger(val: unknown): val is number {
  return typeof val === "number" && Number.isSafeInteger(val) && val > 0;
}

/**
 * Verifies a table or dynvec header and returns item boundaries.
 * For N items/fields, returns an array of length N + 1:
 * [offset_0, offset_1, ..., offset_{N-1}, totalSize].
 */
function verifyAndExtractOffsets(
  value: Bytes,
  prefix: string,
  fieldCountConstraint?: {
    expected: number;
    allowExtra: boolean;
  },
): number[] {
  if (value.byteLength < 4) {
    throw new Error(
      `${prefix}: too short buffer, expected at least 4 bytes, but got ${value.byteLength}`,
    );
  }
  const totalSize = uint32From(value.subarray(0, 4));
  if (totalSize !== value.byteLength) {
    throw new Error(
      `${prefix}: invalid buffer size, expected ${totalSize}, but got ${value.byteLength}`,
    );
  }

  if (totalSize !== 4 && totalSize < 8) {
    throw new Error(
      `${prefix}: invalid header, buffer too short for first offset, got ${totalSize} bytes`,
    );
  }

  const firstOffset = totalSize === 4 ? 4 : uint32From(value.subarray(4, 8));
  if (totalSize !== 4) {
    if (firstOffset < 8) {
      throw new Error(
        `${prefix}: invalid first offset, expected at least 8, but got ${firstOffset}`,
      );
    }
    if (firstOffset % 4 !== 0) {
      throw new Error(
        `${prefix}: invalid first offset alignment, expected multiple of 4, but got ${firstOffset}`,
      );
    }
    if (firstOffset > totalSize) {
      throw new Error(
        `${prefix}: invalid first offset, offset ${firstOffset} exceeds total size ${totalSize}`,
      );
    }
  }

  const fieldCount = (firstOffset - 4) / 4;
  if (
    fieldCountConstraint &&
    (fieldCount < fieldCountConstraint.expected ||
      (fieldCount > fieldCountConstraint.expected &&
        !fieldCountConstraint.allowExtra))
  ) {
    throw new Error(
      `${prefix}: invalid field count, expected ${fieldCountConstraint.expected}, but got ${fieldCount}`,
    );
  }
  if (fieldCount === 0) {
    return [totalSize];
  }

  const offsets = [firstOffset];
  let previous = firstOffset;
  for (let i = 1; i < fieldCount; i++) {
    const current = uint32From(value.subarray(4 + i * 4, 8 + i * 4));
    if (current > totalSize) {
      throw new Error(
        `${prefix}: invalid offset, offset[${i}] = ${current} exceeds total size ${totalSize}`,
      );
    }
    if (current < previous) {
      throw new Error(
        `${prefix}: invalid offset order, offset[${i}] (${current}) is less than offset[${i - 1}] (${previous})`,
      );
    }
    offsets.push(current);
    previous = current;
  }

  offsets.push(totalSize);
  return offsets;
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
  if (!isPositiveSafeInteger(itemByteLength)) {
    throw new Error(
      `fixedItemVec: itemCodec byteLength must be a positive safe integer, but got ${String(itemByteLength)}`,
    );
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
        throw new Error(`fixedItemVec - ${getMessage(e)}`, { cause: e });
      }
    },
    decode(buffer, config) {
      const value = bytesFrom(buffer);
      if (value.byteLength < 4) {
        throw new Error(
          `fixedItemVec: too short buffer, expected at least 4 bytes, but got ${value.byteLength}`,
        );
      }
      const itemCount = uint32From(value.subarray(0, 4));
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
            itemCodec.decode(
              value.subarray(offset, offset + itemByteLength),
              config,
            ),
          );
        }
        return decodedArray;
      } catch (e) {
        throw new Error(`fixedItemVec - ${getMessage(e)}`, { cause: e });
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
        throw new Error(`dynItemVec - ${getMessage(e)}`, { cause: e });
      }
    },
    decode(buffer, config) {
      const value = bytesFrom(buffer);
      const offsets = verifyAndExtractOffsets(value, "dynItemVec");

      try {
        const decodedArray: Array<Decoded> = [];
        for (let index = 0; index < offsets.length - 1; index++) {
          const start = offsets[index];
          const end = offsets[index + 1];
          const itemBuffer = value.subarray(start, end);
          decodedArray.push(itemCodec.decode(itemBuffer, config));
        }
        return decodedArray;
      } catch (e) {
        throw new Error(`dynItemVec - ${getMessage(e)}`, { cause: e });
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
      if (userDefinedOrNull == null) {
        return bytesFrom([]);
      }
      try {
        return innerCodec.encode(userDefinedOrNull);
      } catch (e) {
        throw new Error(`option - ${getMessage(e)}`, { cause: e });
      }
    },
    decode(buffer, config) {
      const value = bytesFrom(buffer);
      if (value.byteLength === 0) {
        return undefined;
      }
      try {
        return innerCodec.decode(buffer, config);
      } catch (e) {
        throw new Error(`option - ${getMessage(e)}`, { cause: e });
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
        throw new Error(`byteVec - ${getMessage(e)}`, { cause: e });
      }
    },
    decode(buffer, config) {
      const value = bytesFrom(buffer);
      if (value.byteLength < 4) {
        throw new Error(
          `byteVec: too short buffer, expected at least 4 bytes, but got ${value.byteLength}`,
        );
      }
      const byteLength = uint32From(value.subarray(0, 4));
      if (byteLength !== value.byteLength - 4) {
        throw new Error(
          `byteVec: invalid buffer size, expected ${byteLength}, but got ${value.byteLength}`,
        );
      }
      try {
        return codec.decode(value.subarray(4), config);
      } catch (e: unknown) {
        throw new Error(`byteVec - ${getMessage(e)}`, { cause: e });
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
          throw new Error(`table.${key} - ${getMessage(e)}`, { cause: e });
        }
      }

      const packedTotalSize = uint32To(header.length + body.length + 4);
      return bytesConcat(packedTotalSize, header, body);
    },
    decode(buffer, config) {
      const value = bytesFrom(buffer);
      const schemaKeyCount = keys.length;
      const offsets = verifyAndExtractOffsets(value, "table", {
        expected: schemaKeyCount,
        allowExtra: config?.isExtraFieldIgnored === true,
      });
      const result: Record<string, unknown> = {};

      for (let i = 0; i < schemaKeyCount; i++) {
        const key = keys[i];
        const start = offsets[i];
        const end = offsets[i + 1];
        const itemBuffer = value.subarray(start, end);
        try {
          result[key] = codecLayout[key].decode(itemBuffer, config);
        } catch (e: unknown) {
          throw new Error(`table.${key} - ${getMessage(e)}`, { cause: e });
        }
      }

      return result as Decoded;
    },
  });
}

export type UnionEncodable<
  T extends Record<string, CodecLike<any, any>>,
  K extends keyof T = keyof T,
> = K extends unknown
  ? {
      type: K;
      value: EncodableType<T[K]>;
    }
  : never;
export type UnionDecoded<
  T extends Record<string, CodecLike<any, any>>,
  K extends keyof T = keyof T,
> = K extends unknown
  ? {
      type: K;
      value: DecodedType<T[K]>;
    }
  : never;

export type UnionMatchHandlers<
  CodecType extends CodecLike<any, UnionDecoded<any, any>>,
  Result,
> = {
  [T in DecodedType<CodecType>["type"]]: (
    value: Extract<DecodedType<CodecType>, { type: T }>["value"],
  ) => Result;
};

function validateUnionFields<T extends Record<string, CodecLike<any, any>>>(
  prefix: string,
  codecLayout: T,
  fields?: Record<keyof T, number | undefined | null>,
): void {
  if (!fields) {
    return;
  }
  const layoutKeys = new Set(Object.keys(codecLayout));
  const fieldKeys = new Set(Object.keys(fields));
  for (const key of fieldKeys) {
    if (!layoutKeys.has(key)) {
      throw new Error(
        `${prefix}: unexpected field id for unknown key '${key}'`,
      );
    }
  }
  const seenIds = new Map<number, string>();
  for (const [key, id] of Object.entries(fields)) {
    if (id === undefined || id === null) {
      throw new Error(`${prefix}: field id for '${key}' is required`);
    }
    if (
      typeof id !== "number" ||
      !Number.isInteger(id) ||
      id < 0 ||
      id > 0xffffffff
    ) {
      throw new Error(`${prefix}: invalid field id ${id} for key '${key}'`);
    }
    if (seenIds.has(id)) {
      throw new Error(
        `${prefix}: duplicate field id ${id} for keys '${seenIds.get(id)}' and '${key}'`,
      );
    }
    seenIds.set(id, key);
  }
  for (const key of layoutKeys) {
    if (!fieldKeys.has(key)) {
      throw new Error(`${prefix}: missing field id for key '${key}'`);
    }
  }
}

function extractUnionEncodable<T extends Record<string, CodecLike<any, any>>>(
  encodable: UnionEncodable<T> | { inner: UnionEncodable<T> },
): UnionEncodable<T> {
  if ("type" in encodable && "value" in encodable) {
    return encodable;
  }

  return encodable.inner;
}

function resolveUnionField<T extends Record<string, CodecLike<any, any>>>(
  prefix: string,
  codecLayout: T,
  fields: Record<keyof T, number | undefined | null> | undefined,
  fieldIndex: number,
): string {
  const keys = Object.keys(codecLayout);
  const field = (() => {
    if (!fields) {
      return keys[fieldIndex];
    }
    const entry = Object.entries(fields).find(([, id]) => id === fieldIndex);
    return entry?.[0];
  })();

  if (!field || !(field in codecLayout)) {
    if (!fields) {
      throw new Error(
        `${prefix}: unknown union field index ${fieldIndex}, only ${keys.toString()} are allowed`,
      );
    }
    const fieldKeys = Object.keys(fields);
    throw new Error(
      `${prefix}: unknown union field index ${fieldIndex}, only ${fieldKeys.toString()} are allowed`,
    );
  }
  return field;
}

/**
 * Constructs a union codec that can serialize and deserialize values tagged with a type identifier.
 *
 * In accordance with the Molecule specification, `union` is always a dynamic-size type,
 * regardless of whether its variants have identical fixed lengths.
 *
 * Serialization format:
 * 1. 4-byte little-endian unsigned integer for the variant ItemId (tag).
 * 2. Encoded bytes of the selected variant.
 *
 * @typeParam T
 *   A record mapping variant names to codecs.
 * @param codecLayout
 *   An object whose keys are variant names and values are codecs for each variant.
 * @param fields
 *   Optional mapping from variant names to custom numeric IDs. If omitted, the index
 *   of each variant in `codecLayout` is used as its ID.
 *
 * @example
 * // Union without custom numeric IDs
 * union({ cafe: Uint8, bee: Uint16 });
 *
 * // Union with custom numeric IDs
 * union({ cafe: Uint8, bee: Uint16 }, { cafe: 0xcafe, bee: 0xbee });
 */
export function union<T extends Record<string, CodecLike<any, any>>>(
  codecLayout: T,
  fields?: Record<keyof T, number | undefined | null>,
): Codec<UnionEncodable<T> | { inner: UnionEncodable<T> }, UnionDecoded<T>> {
  const entries = Object.entries(codecLayout);
  if (entries.length === 0) {
    throw new Error("union: must have at least one variant");
  }

  validateUnionFields("union", codecLayout, fields);

  return Codec.from({
    encode(encodable) {
      const { type, value } = extractUnionEncodable(encodable);
      const typeStr = type.toString();
      const codec = codecLayout[typeStr];
      if (!codec) {
        throw new Error(
          `union: invalid type, expected ${entries.map((e) => e[0]).toString()}, but got ${typeStr}`,
        );
      }
      const fieldId = fields
        ? (fields[typeStr] ?? -1)
        : entries.findIndex((e) => e[0] === typeStr);
      if (fieldId < 0) {
        throw new Error(`union: invalid field id ${fieldId} of ${typeStr}`);
      }
      const header = uint32To(fieldId);
      try {
        const body = codec.encode(value);
        return bytesConcat(header, body);
      } catch (e: unknown) {
        throw new Error(`union.(${typeStr}) - ${getMessage(e)}`, { cause: e });
      }
    },
    decode(buffer, config) {
      const value = bytesFrom(buffer);
      if (value.byteLength < 4) {
        throw new Error(
          `union: too short buffer, expected at least 4 bytes for union tag, but got ${value.byteLength}`,
        );
      }
      const fieldIndex = uint32From(value.subarray(0, 4));
      const field = resolveUnionField("union", codecLayout, fields, fieldIndex);

      return {
        type: field,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        value: codecLayout[field].decode(value.subarray(4), config),
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
  const keys = Object.keys(codecLayout);
  if (keys.length === 0) {
    throw new Error("struct: must have at least one field");
  }

  let byteLength = 0;
  for (const [key, codec] of Object.entries(codecLayout)) {
    if (codec.byteLength === undefined) {
      throw new Error(`struct: field '${key}' must be fixed-size`);
    }
    if (!isPositiveSafeInteger(codec.byteLength)) {
      throw new Error(
        `struct: field '${key}' byteLength must be a positive safe integer, but got ${String(codec.byteLength)}`,
      );
    }
    byteLength += codec.byteLength;
    if (!Number.isSafeInteger(byteLength)) {
      throw new Error("struct: total byteLength exceeds safe integer limit");
    }
  }

  return Codec.from({
    byteLength,
    encode(object) {
      const bytes: number[] = [];
      for (const key of keys) {
        try {
          const encoded = codecLayout[key].encode((object as any)[key]);
          bytesConcatTo(bytes, encoded);
        } catch (e: unknown) {
          throw new Error(`struct.${key} - ${getMessage(e)}`, { cause: e });
        }
      }

      return bytesFrom(bytes);
    },
    decode(buffer, config) {
      const value = bytesFrom(buffer);
      const object = {};
      let offset = 0;
      Object.entries(codecLayout).forEach(([key, codec]) => {
        const payload = value.subarray(offset, offset + codec.byteLength!);
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          Object.assign(object, { [key]: codec.decode(payload, config) });
        } catch (e: unknown) {
          throw new Error(`struct.${key} - ${getMessage(e)}`, { cause: e });
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
  if (!isPositiveSafeInteger(itemCodec.byteLength)) {
    throw new Error(
      `array: itemCodec byteLength must be a positive safe integer, but got ${String(itemCodec.byteLength)}`,
    );
  }
  if (!isPositiveSafeInteger(itemCount)) {
    throw new Error(
      `array: itemCount must be a positive safe integer, but got ${String(itemCount)}`,
    );
  }
  const byteLength = itemCodec.byteLength * itemCount;
  if (!Number.isSafeInteger(byteLength)) {
    throw new Error(
      `array: total byteLength exceeds safe integer limit, got ${String(byteLength)}`,
    );
  }

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
        throw new Error(`array - ${getMessage(e)}`, { cause: e });
      }
    },
    decode(buffer, config) {
      const value = bytesFrom(buffer);
      if (value.byteLength !== byteLength) {
        throw new Error(
          `array: invalid buffer size, expected ${byteLength}, but got ${value.byteLength}`,
        );
      }

      try {
        const result: Array<Decoded> = [];
        for (let i = 0; i < value.byteLength; i += itemCodec.byteLength!) {
          result.push(
            itemCodec.decode(
              value.subarray(i, i + itemCodec.byteLength!),
              config,
            ),
          );
        }
        return result;
      } catch (e: unknown) {
        throw new Error(`array - ${getMessage(e)}`, { cause: e });
      }
    },
  });
}
