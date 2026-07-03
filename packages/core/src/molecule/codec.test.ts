/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { describe, expect, test } from "vitest";
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
