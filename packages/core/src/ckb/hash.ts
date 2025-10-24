import { hashCkb } from "../hasher/hasherCkb.js";
import { Hex } from "../hex/index.js";
import { NumLike, numLeToBytes } from "../num/index.js";
import { CellInput, CellInputLike } from "./transaction.js";

/**
 * Computes the Type ID hash of the given data.
 * @public
 *
 * @param cellInputLike - The first cell input of the transaction.
 * @param outputIndex - The output index of the Type ID cell.
 * @returns The hexadecimal string representation of the hash.
 *
 * @example
 * ```typescript
 * const hash = hashTypeId(cellInput, outputIndex); // Outputs something like "0x..."
 * ```
 */

export function hashTypeId(
  cellInputLike: CellInputLike,
  outputIndex: NumLike,
): Hex {
  return hashCkb(
    CellInput.from(cellInputLike).toBytes(),
    numLeToBytes(outputIndex, 8),
  );
}
