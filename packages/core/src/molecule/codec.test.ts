/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { describe, expect, test } from "vitest";
import { bytesFrom, bytesTo } from "../bytes/index.js";
import { Codec } from "../codec/index.js";
import { mol } from "./index.js";

describe("molecule codec error messages", () => {
  const myTable = mol.table({
    optByteUnion: mol.option(
      mol.byteVec(
        mol.union({
          y: mol.fixedItemVec(
            mol.struct({
              b: mol.array(mol.Uint8, 2),
            }),
          ),
        }),
      ),
    ),
  });

  const outerCodec = mol.dynItemVec(myTable);

  test("should preserve nested error messages recursively on encode", () => {
    let error: Error | undefined;
    try {
      const invalidData: any = [
        {
          optByteUnion: {
            type: "y",
            value: [
              {
                b: [2, "invalid"],
              },
            ],
          },
        },
      ];
      outerCodec.encode(invalidData);
    } catch (e: any) {
      error = e as Error;
    }

    expect(error).toBeDefined();
    expect(error?.message).toContain(
      "dynItemVec - table.optByteUnion - option - byteVec - union.(y) - fixedItemVec - struct.b - array - Cannot convert",
    );
    expect(error?.cause).toBeDefined();
  });

  test("should preserve nested error messages recursively on decode", () => {
    const validBytes = outerCodec.encode([
      {
        optByteUnion: {
          type: "y",
          value: [
            {
              b: [2, 3],
            },
          ],
        },
      },
    ]);

    // Corrupt the fixedItemVec itemCount (at index 24) to trigger a decode error
    const corruptedBytes = new Uint8Array(validBytes);
    corruptedBytes[24] = 0x02; // Change itemCount from 1 to 2

    let error: Error | undefined;
    try {
      outerCodec.decode(corruptedBytes);
    } catch (e: any) {
      error = e as Error;
    }

    expect(error).toBeDefined();
    expect(error?.message).toContain(
      "dynItemVec - table.optByteUnion - option - byteVec - fixedItemVec: invalid buffer size",
    );
    expect(error?.cause).toBeDefined();
  });
});

describe("Molecule Table and DynVec header and offset validation", () => {
  const dynVec = mol.dynItemVec(mol.Uint8);

  test("should decode valid empty dynvec", () => {
    const raw = bytesFrom("04000000", "hex");
    expect(dynVec.decode(raw)).toEqual([]);
    expect(dynVec.encode([])).toEqual(raw);
  });

  test("should decode valid dynvec with one empty item", () => {
    const optVec = mol.dynItemVec(mol.option(mol.Uint8));
    // total_size = 8, offset_0 = 8, payload = 0 bytes
    const raw = bytesFrom("0800000008000000", "hex");
    expect(optVec.decode(raw)).toEqual([undefined]);
    expect(optVec.encode([undefined])).toEqual(raw);
  });

  test("should decode valid table with adjacent equal offsets", () => {
    const myTable = mol.table({
      opt: mol.option(mol.Uint8),
      val: mol.Uint8,
    });
    // total_size = 13 (0x0d), offset_0 = 12 (0x0c), offset_1 = 12 (0x0c), payload for opt is empty, payload for val is [0x2a]
    const raw = bytesFrom("0d0000000c0000000c0000002a", "hex");
    expect(myTable.decode(raw)).toEqual({ opt: undefined, val: 0x2a });
    expect(myTable.encode({ opt: undefined, val: 0x2a })).toEqual(raw);
  });

  test("should decode compatible table with structurally valid extra fields", () => {
    const table1 = mol.table({ a: mol.Uint8 });
    // total_size = 13, offset_0 = 12, offset_1 = 13.
    // field 0: [12, 13) = [0x42], field 1: [13, 13) = []
    const raw = bytesFrom("0d0000000c0000000d00000042", "hex");
    expect(table1.decode(raw, { isExtraFieldIgnored: true })).toEqual({
      a: 0x42,
    });
    // Without isExtraFieldIgnored, should throw
    expect(() => table1.decode(raw)).toThrow(
      "table: invalid field count, expected 1, but got 2",
    );
  });

  test("should reject excessive strict-table fields before validating trailing offsets", () => {
    const table1 = mol.table({ a: mol.Uint8 });
    // total_size = 16, offsets = [16, 16, 15]. The trailing offset is invalid,
    // but strict mode can reject the inferred field count without traversing it.
    const raw = bytesFrom("1000000010000000100000000f000000", "hex");
    expect(() => table1.decode(raw)).toThrow(
      "table: invalid field count, expected 1, but got 3",
    );
  });

  test("should reject backwards offset", () => {
    // total_size = 16 (0x10), offset_0 = 12, offset_1 = 11, offset_2 = 16
    const raw = bytesFrom("100000000c0000000b00000010000000", "hex");
    expect(() => dynVec.decode(raw)).toThrow("invalid offset order");
  });

  test("should reject offset exceeding totalSize", () => {
    // total_size = 12 (0x0c), offset_0 = 12 (0x0c), offset_1 = 13 (exceeds 12)
    const raw = bytesFrom("0c0000000c0000000d000000", "hex");
    expect(() => dynVec.decode(raw)).toThrow("exceeds total size");
  });

  test("should reject firstOffset = 4 when totalSize > 4", () => {
    // total_size = 8, firstOffset = 4
    const raw = bytesFrom("0800000004000000", "hex");
    expect(() => dynVec.decode(raw)).toThrow(
      "invalid first offset, expected at least 8, but got 4",
    );
  });

  test("should reject misaligned firstOffset", () => {
    // total_size = 9, firstOffset = 9
    const raw = bytesFrom("090000000900000000", "hex");
    expect(() => dynVec.decode(raw)).toThrow(
      "invalid first offset alignment, expected multiple of 4, but got 9",
    );
  });

  test("should reject firstOffset > totalSize", () => {
    // total_size = 8, firstOffset = 12
    const raw = bytesFrom("080000000c000000", "hex");
    expect(() => dynVec.decode(raw)).toThrow("exceeds total size");
  });

  test("should reject truncated firstOffset/header (e.g. 05 00 00 00 04)", () => {
    const raw = bytesFrom("0500000004", "hex");
    expect(() => dynVec.decode(raw)).toThrow(
      "buffer too short for first offset",
    );
  });

  test("should reject malformed extra-field offsets even when extra fields are ignored", () => {
    const table1 = mol.table({ a: mol.Uint8 });
    // total_size = 16, offsets = [16, 16, 15] (offset_0 = 16, offset_1 = 16, offset_2 = 15)
    // Here offset_2 < offset_1 (backwards offset in extra fields)
    const raw = bytesFrom("1000000010000000100000000f000000", "hex");
    expect(() => table1.decode(raw, { isExtraFieldIgnored: true })).toThrow(
      "invalid offset order",
    );
  });
});

describe("Fix empty Table decoding", () => {
  test("empty table schema must decode 04 00 00 00 to empty object {}", () => {
    const EmptyTable = mol.table({});
    const raw = bytesFrom("04000000", "hex");
    expect(EmptyTable.decode(raw)).toEqual({});
    expect(EmptyTable.encode({})).toEqual(raw);
  });

  test("non-empty table schema must reject 04 00 00 00", () => {
    const NonEmptyTable = mol.table({ a: mol.Uint8 });
    const raw = bytesFrom("04000000", "hex");
    expect(() => NonEmptyTable.decode(raw)).toThrow(
      "table: invalid field count, expected 1, but got 0",
    );
  });
});

describe("Reject truncated Union tags", () => {
  const U = mol.union({
    a: mol.option(mol.Uint8),
  });

  test("should reject union inputs shorter than 4 bytes", () => {
    expect(() => U.decode(bytesFrom("", "hex"))).toThrow(
      "union: too short buffer, expected at least 4 bytes for union tag, but got 0",
    );
    expect(() => U.decode(bytesFrom("00", "hex"))).toThrow(
      "union: too short buffer, expected at least 4 bytes for union tag, but got 1",
    );
    expect(() => U.decode(bytesFrom("0000", "hex"))).toThrow(
      "union: too short buffer, expected at least 4 bytes for union tag, but got 2",
    );
    expect(() => U.decode(bytesFrom("000000", "hex"))).toThrow(
      "union: too short buffer, expected at least 4 bytes for union tag, but got 3",
    );
  });

  test("should accept 4-byte union tag with empty payload", () => {
    const EmptyOptionUnion = mol.union({
      opt: mol.option(mol.Uint8),
    });
    expect(EmptyOptionUnion.decode(bytesFrom("00000000", "hex"))).toEqual({
      type: "opt",
      value: undefined,
    });
  });
});

describe("Union schema and custom ID mapping validation", () => {
  test("union rejects empty layout", () => {
    expect(() => mol.union({})).toThrow(
      "union: must have at least one variant",
    );
  });

  test("should reject duplicate custom field ids", () => {
    expect(() =>
      mol.union(
        {
          a: mol.Uint8,
          b: mol.Uint8,
        },
        {
          a: 0,
          b: 0,
        },
      ),
    ).toThrow("union: duplicate field id 0 for keys 'a' and 'b'");
  });

  test("should reject negative or out-of-range custom field ids", () => {
    expect(() =>
      mol.union(
        {
          a: mol.Uint8,
        },
        {
          a: -1,
        },
      ),
    ).toThrow("union: invalid field id -1 for key 'a'");

    expect(() =>
      mol.union(
        {
          a: mol.Uint8,
        },
        {
          a: 0x100000000,
        },
      ),
    ).toThrow("union: invalid field id 4294967296 for key 'a'");
  });

  test("should reject missing custom field ids", () => {
    expect(() =>
      mol.union(
        {
          a: mol.Uint8,
          b: mol.Uint8,
        },
        {
          a: 0,
        } as any,
      ),
    ).toThrow("union: missing field id for key 'b'");
  });

  test("union rejects non-enumerable custom field IDs", () => {
    const ids = { a: 0, b: 0 };
    Object.defineProperty(ids, "b", { enumerable: false });
    expect(() => mol.union({ a: mol.Uint8, b: mol.Uint8 }, ids)).toThrow(
      "union: missing field id for key 'b'",
    );
  });

  test("union rejects prototype-inherited custom field IDs", () => {
    const protoIds = Object.create({ a: 0 }) as Record<string, number>;
    expect(() => mol.union({ a: mol.Uint8 }, protoIds)).toThrow(
      "union: missing field id for key 'a'",
    );
  });

  test("should reject unexpected extra keys in fields mapping", () => {
    expect(() =>
      mol.union({ a: mol.Uint8 }, { a: 0, extra: 1 } as any),
    ).toThrow("union: unexpected field id for unknown key 'extra'");
  });

  test("should support valid non-consecutive custom IDs", () => {
    const U = mol.union({ a: mol.Uint8, b: mol.Uint16 }, { a: 10, b: 20 });
    const encA = U.encode({ type: "a", value: 0x42 });
    expect(bytesTo(encA, "hex")).toBe("0a00000042");
    expect(U.decode(encA)).toEqual({ type: "a", value: 0x42 });

    const encB = U.encode({ type: "b", value: 0x1234 });
    expect(bytesTo(encB, "hex")).toBe("140000003412");
    expect(U.decode(encB)).toEqual({ type: "b", value: 0x1234 });
  });

  test("should produce controlled errors for unknown IDs on decode", () => {
    const U = mol.union({ a: mol.Uint8 }, { a: 10 });
    expect(() => U.decode(bytesFrom("6300000042", "hex"))).toThrow(
      "union: unknown union field index 99, only a are allowed",
    );
  });
});

describe("Molecule type classification for Union", () => {
  const U = mol.union({
    a: mol.Uint8,
    b: mol.Uint8,
  });

  test("union should have byteLength undefined", () => {
    expect(U.byteLength).toBeUndefined();
  });

  test("vector(union) must use DynVec representation matching upstream Molecule reference", () => {
    const VecU = mol.vector(U);
    const encoded = VecU.encode([
      { type: "a", value: 1 },
      { type: "b", value: 2 },
    ]);

    // DynVec format:
    // full_byte_size (4 bytes) = 22 (0x16, 0x00, 0x00, 0x00)
    // offset_0 (4 bytes) = 12 (0x0c, 0x00, 0x00, 0x00)
    // offset_1 (4 bytes) = 17 (0x11, 0x00, 0x00, 0x00)
    // item_0 (5 bytes) = 00 00 00 00 01
    // item_1 (5 bytes) = 01 00 00 00 02
    // Total size = 4 + 4 + 4 + 5 + 5 = 22 bytes.
    const expected = bytesFrom(
      "160000000c0000001100000000000000010100000002",
      "hex",
    );
    expect(encoded).toEqual(expected);

    const decoded = VecU.decode(encoded);
    expect(decoded).toEqual([
      { type: "a", value: 1 },
      { type: "b", value: 2 },
    ]);
  });

  test("vector(union) canonical reference DynVec golden wire format", () => {
    const layout = { a: mol.Uint8, b: mol.Uint16 };
    const Canonical = mol.vector(mol.union(layout));
    const items = [
      { type: "a" as const, value: 0x42 },
      { type: "b" as const, value: 0x1234 },
    ];
    const encoded = Canonical.encode(items);
    // DynVec format:
    // full_byte_size (4 bytes) = 23 (0x17, 0x00, 0x00, 0x00)
    // offset_0 (4 bytes) = 12 (0x0c, 0x00, 0x00, 0x00)
    // offset_1 (4 bytes) = 17 (0x11, 0x00, 0x00, 0x00)
    // item_0 (union 'a', 5 bytes): tag=0 (0x00, 0x00, 0x00, 0x00) + value=0x42
    // item_1 (union 'b', 6 bytes): tag=1 (0x01, 0x00, 0x00, 0x00) + value=0x3412
    const expectedHex = "170000000c000000110000000000000042010000003412";
    expect(bytesTo(encoded, "hex")).toBe(expectedHex);
    expect(Canonical.decode(encoded)).toEqual(items);
  });

  test("struct must reject union fields even when variants have equal length", () => {
    expect(() =>
      mol.struct({
        u: U,
      }),
    ).toThrow("struct: field 'u' must be fixed-size");
  });

  test("array must reject union items even when variants have equal length", () => {
    expect(() => mol.array(U, 2)).toThrow(
      "array: itemCodec requires a byte length",
    );
  });

  test("fixedItemVec must reject union items even when variants have equal length", () => {
    expect(() => mol.fixedItemVec(U)).toThrow(
      "fixedItemVec: itemCodec requires a byte length",
    );
  });
});

describe("Molecule fixed-size constructor validation", () => {
  const dummyEncode = () => bytesFrom([]);
  const dummyDecode = () => ({});

  test("generic zero-length Codec can still be created and used", () => {
    const zeroCodec = Codec.from({
      byteLength: 0,
      encode: () => bytesFrom([]),
      decode: () => "zero",
    });
    expect(zeroCodec.byteLength).toBe(0);
    expect(bytesTo(zeroCodec.encode({}), "hex")).toBe("");
    expect(zeroCodec.decode(bytesFrom([]))).toBe("zero");
  });

  test("struct rejects empty layouts", () => {
    expect(() => mol.struct({})).toThrow(
      "struct: must have at least one field",
    );
  });

  test("array validates itemCount strictly", () => {
    for (const invalidCount of [
      0,
      -1,
      -5,
      0.5,
      1.5,
      NaN,
      Infinity,
      -Infinity,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(() => mol.array(mol.Uint8, invalidCount)).toThrow(
        `array: itemCount must be a positive safe integer, but got ${String(invalidCount)}`,
      );
    }
  });

  test("array validates itemCodec byteLength strictly", () => {
    for (const invalidLen of [
      0,
      -1,
      1.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      const badCodec = Codec.from({
        byteLength: invalidLen,
        encode: dummyEncode,
        decode: dummyDecode,
      });
      expect(() => mol.array(badCodec, 2)).toThrow(
        `array: itemCodec byteLength must be a positive safe integer, but got ${String(invalidLen)}`,
      );
    }
  });

  test("array rejects total byteLength exceeding safe integer limit", () => {
    const hugeCodec = Codec.from({
      byteLength: Number.MAX_SAFE_INTEGER,
      encode: dummyEncode,
      decode: dummyDecode,
    });
    expect(() => mol.array(hugeCodec, 2)).toThrow(
      "array: total byteLength exceeds safe integer limit",
    );
  });

  test("fixedItemVec validates itemCodec byteLength strictly", () => {
    for (const invalidLen of [
      0,
      -1,
      -10,
      0.5,
      2.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      const badCodec = Codec.from({
        byteLength: invalidLen,
        encode: dummyEncode,
        decode: dummyDecode,
      });
      expect(() => mol.fixedItemVec(badCodec)).toThrow(
        `fixedItemVec: itemCodec byteLength must be a positive safe integer, but got ${String(invalidLen)}`,
      );
    }
  });

  test("vector dispatches zero-size codec to fixedItemVec and rejects it at construction", () => {
    const zeroCodec = Codec.from({
      byteLength: 0,
      encode: dummyEncode,
      decode: dummyDecode,
    });
    expect(() => mol.vector(zeroCodec)).toThrow(
      "fixedItemVec: itemCodec byteLength must be a positive safe integer, but got 0",
    );
  });

  test("struct validates each field's byteLength individually", () => {
    const zeroCodec = Codec.from({
      byteLength: 0,
      encode: dummyEncode,
      decode: dummyDecode,
    });
    // struct with a 0-byte field inside positive length struct
    expect(() =>
      mol.struct({
        zero: zeroCodec,
        value: mol.Uint8,
      }),
    ).toThrow(
      "struct: field 'zero' byteLength must be a positive safe integer, but got 0",
    );

    // float byte length on a field
    const floatCodec = Codec.from({
      byteLength: 1.5,
      encode: dummyEncode,
      decode: dummyDecode,
    });
    expect(() =>
      mol.struct({
        f: floatCodec,
      }),
    ).toThrow(
      "struct: field 'f' byteLength must be a positive safe integer, but got 1.5",
    );
  });

  test("struct rejects total byteLength exceeding safe integer limit", () => {
    const hugeCodec = Codec.from({
      byteLength: Number.MAX_SAFE_INTEGER,
      encode: dummyEncode,
      decode: dummyDecode,
    });
    expect(() =>
      mol.struct({
        a: hugeCodec,
        b: mol.Uint8,
      }),
    ).toThrow("struct: total byteLength exceeds safe integer limit");
  });
});

describe("Molecule valid zero-length values", () => {
  test("empty option encodes to zero bytes and decodes to undefined", () => {
    const Opt = mol.option(mol.Uint8);
    const enc = Opt.encode(null);
    expect(bytesTo(enc, "hex")).toBe("");
    expect(Opt.decode(bytesFrom([]))).toBeUndefined();
  });

  test("dynItemVec supports multiple consecutive empty items with equal adjacent offsets", () => {
    const VecOpt = mol.dynItemVec(mol.option(mol.Uint8));
    const enc = VecOpt.encode([null, null]);
    // 2 items: fullSize(4) + offset0(4) + offset1(4) = 12 bytes (0x0c)
    // offset0 = 12, offset1 = 12
    expect(bytesTo(enc, "hex")).toBe("0c0000000c0000000c000000");
    expect(VecOpt.decode(enc)).toEqual([undefined, undefined]);
  });
});
