import { fixedPointToString } from "../fixedPoint/index.js";
import { Num, numFrom, NumLike } from "../num/index.js";

/**
 * Error thrown when a fee payer has insufficient capacity to complete a transaction.
 * @public
 */
export class ErrorFeePayerInsufficientCapacity extends Error {
  /**
   * The amount of extra capacity needed.
   */
  public readonly amount: Num;
  /**
   * Whether the extra capacity is needed for a change cell.
   */
  public readonly isForChange: boolean;

  /**
   * Creates an instance of ErrorFeePayerInsufficientCapacity.
   * @param amountLike - The amount of extra capacity needed.
   * @param reason - Optional reason object.
   * @param reason.isForChange - Whether the extra capacity is needed for a change cell.
   */
  constructor(
    amountLike: NumLike,
    reason?: {
      isForChange?: boolean;
    },
  ) {
    const amount = numFrom(amountLike);
    const isForChange = reason?.isForChange ?? false;
    super(
      `Insufficient CKB, need ${fixedPointToString(amount)} extra CKB${isForChange ? " for the change cell" : ""}`,
    );
    this.amount = amount;
    this.isForChange = isForChange;
  }
}
