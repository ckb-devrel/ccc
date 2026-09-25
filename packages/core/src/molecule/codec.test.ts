/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { describe, expect, test } from "vitest";
import { bytesFrom } from "../bytes/index.js";
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
