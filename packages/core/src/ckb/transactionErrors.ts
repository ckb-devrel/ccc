import { fixedPointToString } from "../fixedPoint/index.js";
import { Num, numFrom, NumLike } from "../num/index.js";
import { Script, ScriptLike } from "./script.js";

export class ErrorTransactionInsufficientCapacity extends Error {
  public readonly amount: Num;
  public readonly isForChange: boolean;

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

/**
 * @deprecated Use `ErrorUdtInsufficientCoin` from `@ckb-ccc/udt` instead.
 */
export class ErrorTransactionInsufficientCoin extends Error {
  public readonly amount: Num;
  public readonly type: Script;

  constructor(amountLike: NumLike, typeLike: ScriptLike) {
    const amount = numFrom(amountLike);
    const type = Script.from(typeLike);
    super(`Insufficient coin, need ${amount} extra coin`);
    this.amount = amount;
    this.type = type;
  }
}
