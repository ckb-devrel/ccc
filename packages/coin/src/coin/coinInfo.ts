import { ccc } from "@ckb-ccc/core";

/**
 * Represents a Coin information-like object.
 * This is used as a flexible input for creating `CoinInfo` instances.
 *
 * @public
 * @category Coin
 */
export type CoinInfoLike =
  | {
      /** The Coin balance. */
      balance?: ccc.NumLike | null;
      /** The total CKB capacity of the Coins. */
      capacity?: ccc.NumLike | null;
      /** The number of Coins. */
      count?: number | null;
    }
  | undefined
  | null;

/**
 * Represents aggregated information about a set of Coins.
 * This class encapsulates the total balance, total CKB capacity, and the number of cells.
 *
 * @public
 * @category Coin
 */
export class CoinInfo {
  /**
   * Creates an instance of CoinInfo.
   *
   * @param balance - The total Coin balance.
   * @param capacity - The total CKB capacity of the Coins.
   * @param count - The number of Coins.
   */
  constructor(
    public balance: ccc.Num,
    public capacity: ccc.Num,
    public count: number,
  ) {}

  /**
   * Creates a `CoinInfo` instance from a `CoinInfoLike` object.
   *
   * @param infoLike - A `CoinInfoLike` object or an instance of `CoinInfo`.
   * @returns A new `CoinInfo` instance.
   */
  static from(infoLike?: CoinInfoLike) {
    if (infoLike instanceof CoinInfo) {
      return infoLike;
    }

    return new CoinInfo(
      ccc.numFrom(infoLike?.balance ?? ccc.Zero),
      ccc.numFrom(infoLike?.capacity ?? ccc.Zero),
      infoLike?.count ?? 0,
    );
  }

  /**
   * Creates a default `CoinInfo` instance with all values set to zero.
   * @returns A new `CoinInfo` instance with zero balance, capacity, and count.
   */
  static default() {
    return CoinInfo.from();
  }

  /**
   * Clones the `CoinInfo` instance.
   * @returns A new `CoinInfo` instance that is a copy of the current one.
   */
  clone() {
    return new CoinInfo(this.balance, this.capacity, this.count);
  }

  /**
   * Adds the values from another `CoinInfoLike` object to this instance (in-place).
   *
   * @param infoLike - The `CoinInfoLike` object to add.
   * @returns The current, modified `CoinInfo` instance.
   */
  addAssign(infoLike: CoinInfoLike) {
    const info = CoinInfo.from(infoLike);

    this.balance += info.balance;
    this.capacity += info.capacity;
    this.count += info.count;

    return this;
  }

  /**
   * Creates a new `CoinInfo` instance by adding the values from another `CoinInfoLike` object to the current one.
   * This method is not in-place.
   *
   * @param infoLike - The `CoinInfoLike` object to add.
   * @returns A new `CoinInfo` instance with the summed values.
   */
  add(infoLike: CoinInfoLike) {
    return this.clone().addAssign(infoLike);
  }

  /**
   * Subtracts the values from another `CoinInfoLike` object from this instance (in-place).
   *
   * @param infoLike - The `CoinInfoLike` object to subtract.
   * @returns The current, modified `CoinInfo` instance.
   */
  subAssign(infoLike: CoinInfoLike) {
    const info = CoinInfo.from(infoLike);

    this.balance -= info.balance;
    this.capacity -= info.capacity;
    this.count -= info.count;

    return this;
  }

  /**
   * Creates a new `CoinInfo` instance by subtracting the values of another `CoinInfoLike` object from the current one.
   * This method is not in-place.
   *
   * @param infoLike - The `CoinInfoLike` object to subtract.
   * @returns A new `CoinInfo` instance with the subtracted values.
   */
  sub(infoLike: CoinInfoLike) {
    return this.clone().subAssign(infoLike);
  }
}
