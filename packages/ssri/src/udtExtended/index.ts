import { ScriptLike } from "../../../core/src/ckb/script";
import { Transaction, TransactionLike } from "../../../core/src/ckb/transaction";
import { HexLike } from "../../../core/src/hex";
import { UDT } from "../udt/index";

/**
 * Represents extended functionality for a UDT (User Defined Token).
 * @extends {UDT} in a composition style.
 */
export class UDTExtended {
  udt: UDT;

  /**
   * Creates an instance of UDTExtended.
   * @param {UDT} udt - The UDT instance.
   */
  constructor(udt: UDT) {
    this.udt = udt;
  }
  /**
   * Mints new tokens.
   * @param {TransactionLike} [tx] - Transfer on the basis of an existing transaction to achieve combined actions. If not provided, a new transaction will be created.
   * @param {ScriptLike[]} toLockVec - The array of lock scripts for the recipients.
   * @param {bigint[]} toAmountVec - The array of amounts to be minted.
   * @returns {Promise<Transaction | null>} The transaction result.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction to be sent.
   */
  async mint(
    tx: TransactionLike | null,
    toLockVec: ScriptLike[],
    toAmountVec: bigint[],
  ): Promise<Transaction | null> {
    // TODO: implement
    throw new Error("TODO");
  }

  /**
   * Approves a spender to spend tokens on behalf of the owner.
   * @param {TransactionLike} [tx] - Transfer on the basis of an existing transaction to achieve combined actions. If not provided, a new transaction will be created.
   * @param {ccc.Hex} spenderLockHash - The lock hash of the spender.
   * @param {bigint} amount - The amount to be approved.
   * @returns {Promise<void>}
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction to be sent.
   */
  async approve(
    tx: TransactionLike | null,
    spenderLockHash: HexLike,
    amount: bigint,
  ): Promise<void> {
    // TODO: implement
    throw new Error("TODO");
  }

  /**
   * Retrieves the allowance of a spender for a specific owner.
   * @param {ScriptLike} owner - The lock script of the owner.
   * @param {HexLike} spenderLockHash - The lock hash of the spender.
   * @returns {Promise<bigint>} The allowance amount.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Transaction
   */
  async allowance(
    owner: ScriptLike,
    spenderLockHash: HexLike,
  ): Promise<bigint> {
    // TODO: implement
    throw new Error("TODO");
  }

  /**
   * Increases the allowance of a spender.
   * @param {TransactionLike} [tx] - Transfer on the basis of an existing transaction to achieve combined actions. If not provided, a new transaction will be created.
   * @param {HexLike} spenderLockHash - The lock hash of the spender.
   * @param {bigint} addedValue - The amount to be added to the allowance.
   * @returns {Promise<void>}
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction to be sent.
   */
  async increaseAllowance(
    tx: TransactionLike | null,
    spenderLockHash: HexLike,
    addedValue: bigint,
  ): Promise<void> {
    // TODO: implement
    throw new Error("TODO");
  }
  /**
   * Decreases the allowance of a spender.
   * @param {TransactionLike} [tx] - The transaction to be used.
   * @param {HexLike} spenderLockHash - The lock hash of the spender.
   * @param {bigint} subtractedValue - The amount to be subtracted from the allowance.
   * @returns {Promise<void>}
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction to be sent.
   */
  async decreaseAllowance(
    tx: TransactionLike | null,
    spenderLockHash: HexLike,
    subtractedValue: bigint,
  ): Promise<void> {
    // TODO: implement
    throw new Error("TODO");
  }
}
