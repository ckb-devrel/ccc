import { TransactionLike, HexLike } from "@ckb-ccc/core";
import { UDT } from "../udt/index.js";
import { isPausedNow } from "./udtPausable.advanced.js";

/**
 * Represents a pausable functionality for a UDT (User Defined Token).
 * @extends {UDT} in a composition style.
 * @public
 */
export class UDTPausable {
  udt: UDT;
  /**
   * Creates an instance of UDTPausable.
   * @param {UDT} udt - The UDT instance.
   */
  constructor(udt: UDT) {
    this.udt = udt;
  }

  /**
   * Pauses the UDT for the specified lock hashes. Pausing/Unpause without lock hashes should take effect on the global level. Note that this method is only available if the pausable UDT uses external pause list.
   * @param {TransactionLike} [tx] - The transaction to be used.
   * @param {HexLike[]} lockHashes - The array of lock hashes to be paused.
   * @returns {Promise<TransactionLike>} The transaction result.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction to be sent.
   */
  async pause(
    tx: TransactionLike | null,
    lockHashes: HexLike[],
  ): Promise<TransactionLike> {
    // TODO: implement
    throw new Error("TODO");
  }

  /**
   * Unpauses the UDT for the specified lock hashes. Pausing/Unpause without lock hashes should take effect on the global level. Note that this method is only available if the pausable UDT uses external pause list.
   * @param {TransactionLike} tx - The transaction to be used.
   * @param {HexLike[]} lockHashes - The array of lock hashes to be unpaused.
   * @returns {Promise<TransactionLike>} The transaction result.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction to be sent.
   */
  async unpause(
    tx: TransactionLike,
    lockHashes: HexLike[],
  ): Promise<TransactionLike> {
    // TODO: implement
    throw new Error("TODO");
  }

  /**
   * Checks if the UDT is paused for the specified lock hashes within a transaction. If not using external pause list, it can also be run on Code environment level.
   * @param {HexLike[]} [lockHashes] - The lock hash to check.
   * @returns {Promise<boolean>} True if any of the lock hashes are paused, false otherwise.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Transaction
   */
  async isPaused(lockHashes: HexLike[]): Promise<boolean> {
    // TODO: implement
    throw new Error("TODO");
  }

  /**
   * Enumerates all paused lock hashes within a transaction. If not using external pause list, it can also be run on Code environment level.
   * @returns {Promise<HexLike[]>} The array of paused lock hashes.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Transaction
   */
  async enumeratePaused(): Promise<HexLike[]> {
    // TODO: implement
    throw new Error("TODO");
  }

  /**
   * Check if the UDT is paused for the specified lock hashes across the chain.
   * @param {HexLike[]} [lockHashes] - The lock hash to check.
   * @returns {Promise<boolean>} True if any of the lock hashes are paused, false otherwise.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Elevated - This method is elevated with CCC and not available in raw SSRI call.
   */
  async isPausedNow(lockHashes: HexLike[]): Promise<boolean> {
    return await isPausedNow(lockHashes);
  }
}
