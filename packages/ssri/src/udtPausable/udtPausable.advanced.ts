import { HexLike } from "@ckb-ccc/core";
/**
 * Check if the UDT is paused for the specified lock hashes across the chain.
 * @param {HexLike[]} [lockHashes] - The lock hash to check.
 * @returns {Promise<boolean>} True if any of the lock hashes are paused, false otherwise.
 * @throws {Error} Throws an error if the function is not yet implemented.
 * @tag Elevated - This method is elevated with CCC and not available in raw SSRI call.
 */
export async function isPausedNow(lockHashes: HexLike[]): Promise<boolean> {
  // TODO: implement
  throw new Error("TODO");
}
