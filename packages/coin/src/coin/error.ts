import { ccc } from "@ckb-ccc/core";

/**
 * Error thrown when there are insufficient Coin to complete a transaction.
 * This error provides detailed information about the shortfall, including the
 * exact amount needed, the Coin type script, and an optional custom reason.
 *
 * @public
 * @category Error
 * @category Coin
 *
 * @example
 * ```typescript
 * // This error is typically thrown automatically by Coin methods
 * try {
 *   await coin.completeInputsByBalance(tx, signer);
 * } catch (error) {
 *   if (error instanceof ErrorCoinInsufficient) {
 *     console.log(`Error: ${error.message}`);
 *     console.log(`Shortfall: ${error.amount} Coin tokens`);
 *     console.log(`Coin type script: ${error.type.toHex()}`);
 *   }
 * }
 * ```
 */
export class ErrorCoinInsufficient extends Error {
  /**
   * The amount of Coin that is insufficient (shortfall amount).
   * This represents how many more Coin tokens are needed to complete the operation.
   */
  public readonly amount: ccc.Num;

  /**
   * The type script of the Coin that has insufficient balance.
   * This identifies which specific Coin token is lacking sufficient funds.
   */
  public readonly type: ccc.Script;

  /**
   * Creates a new ErrorCoinInsufficient instance.
   *
   * @param info - Configuration object for the error
   * @param info.amount - The amount of Coin that is insufficient (shortfall amount)
   * @param info.type - The type script of the Coin that has insufficient balance
   * @param info.reason - Optional custom reason message. If not provided, a default message will be generated
   *
   * @example
   * ```typescript
   * // Manual creation (typically not needed as the error is thrown automatically)
   * const error = new ErrorCoinInsufficient({
   *   amount: ccc.numFrom(1000),
   *   type: coinScript,
   *   reason: "Custom insufficient balance message"
   * });
   *
   * // More commonly, catch the error when it's thrown by Coin methods
   * try {
   *   const result = await coin.completeInputsByBalance(tx, signer);
   * } catch (error) {
   *   if (error instanceof ErrorCoinInsufficient) {
   *     // Handle the insufficient balance error
   *     console.error(`Insufficient Coin: need ${error.amount} more tokens`);
   *   }
   * }
   * ```
   *
   * @remarks
   * The error message format depends on whether a custom reason is provided:
   * - With custom reason: "Insufficient coin, {custom reason}"
   * - Without custom reason: "Insufficient coin, need {amount} extra coin"
   */
  constructor(info: {
    amount: ccc.NumLike;
    type: ccc.ScriptLike;
    reason?: string;
  }) {
    const amount = ccc.numFrom(info.amount);
    const type = ccc.Script.from(info.type);
    super(`Insufficient coin, ${info.reason ?? `need ${amount} extra coin`}`);
    this.amount = amount;
    this.type = type;
  }
}
