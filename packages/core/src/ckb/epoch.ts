import type { ClientBlockHeader } from "../client/clientTypes.js";
import { Zero } from "../fixedPoint/index.js";
import { type Hex, type HexLike } from "../hex/index.js";
import { mol } from "../molecule/index.js";
import { numFrom, NumLike, type Num } from "../num/index.js";
import { gcd } from "../utils/index.js";

/**
 * @deprecated use `Epoch.from` instead
 * Convert an Epoch-like value into an Epoch instance.
 *
 * @param epochLike - An EpochLike value (object or tuple).
 * @returns An Epoch instance built from `epochLike`.
 */
export function epochFrom(epochLike: EpochLike): Epoch {
  return Epoch.from(epochLike);
}

/**
 * @deprecated use `Epoch.decode` instead
 * Decode an epoch from a hex-like representation.
 *
 * @param hex - A hex-like value representing an encoded epoch.
 * @returns An Epoch instance decoded from `hex`.
 */
export function epochFromHex(hex: HexLike): Epoch {
  return Epoch.decode(hex);
}

/**
 * @deprecated use `Epoch.from(epochLike).toHex` instead
 * Convert an Epoch-like value to its hex representation.
 *
 * @param epochLike - An EpochLike value (object, tuple, or Epoch).
 * @returns Hex string representing the epoch.
 */
export function epochToHex(epochLike: EpochLike): Hex {
  return Epoch.from(epochLike).toHex();
}

export type EpochLike =
  | {
      number: NumLike;
      index: NumLike;
      length: NumLike;
    }
  | [NumLike, NumLike, NumLike];

@mol.codec(
  mol
    .struct({
      length: mol.uint(2, true),
      index: mol.uint(2, true),
      number: mol.uint(3, true),
    })
    .mapIn((encodable: EpochLike) => Epoch.from(encodable)),
)
/**
 * Epoch
 *
 * Represents a timestamp-like epoch as a mixed whole number and fractional part:
 * - number: whole units
 * - index: numerator of the fractional part
 * - length: denominator of the fractional part (must be > 0)
 *
 * The fractional portion is index/length. Instances normalize fractions where
 * appropriate (e.g., reduce by GCD, carry whole units).
 */
export class Epoch extends mol.Entity.Base<EpochLike, Epoch>() {
  /**
   * Construct a new Epoch.
   *
   * The constructor enforces a positive `length` (denominator). If `length`
   * is non-positive an Error is thrown.
   *
   * @param number - Whole number portion of the epoch.
   * @param index - Fractional numerator.
   * @param length - Fractional denominator (must be > 0).
   */
  public constructor(
    public readonly number: Num,
    public readonly index: Num,
    public readonly length: Num,
  ) {
    // Ensure the epoch has a positive denominator.
    if (length <= Zero) {
      throw new Error("Non positive Epoch length");
    }
    super();
  }

  /**
   * @deprecated use `number` instead
   * Backwards-compatible array-style index 0 referencing the whole epoch number.
   */
  get 0(): Num {
    return this.number;
  }

  /**
   * @deprecated use `index` instead
   * Backwards-compatible array-style index 1 referencing the epoch fractional numerator.
   */
  get 1(): Num {
    return this.index;
  }

  /**
   * @deprecated use `length` instead
   * Backwards-compatible array-style index 2 referencing the epoch fractional denominator.
   */
  get 2(): Num {
    return this.length;
  }

  /**
   * Create an Epoch from an EpochLike value.
   *
   * Accepts:
   * - an Epoch instance (returned as-is)
   * - an object { number, index, length } where each field is NumLike
   * - a tuple [number, index, length] where each element is NumLike
   *
   * All returned fields are converted to `Num` using `numFrom`.
   *
   * @param epochLike - Value to convert into an Epoch.
   * @returns A new or existing Epoch instance.
   */
  static from(epochLike: EpochLike): Epoch {
    if (epochLike instanceof Epoch) {
      return epochLike;
    }

    let number: NumLike, index: NumLike, length: NumLike;
    if (epochLike instanceof Array) {
      [number, index, length] = epochLike;
    } else {
      ({ number, index, length } = epochLike);
    }

    return new Epoch(numFrom(number), numFrom(index), numFrom(length));
  }

  /**
   * Return an epoch representing zero (0 + 0/1).
   */
  static zero(): Epoch {
    return new Epoch(0n, 0n, numFrom(1));
  }

  /**
   * Return an epoch representing one (1 + 0/1).
   */
  static one(): Epoch {
    return new Epoch(numFrom(1), 0n, numFrom(1));
  }

  /**
   * Return an epoch representing one cycle (180 + 0/1).
   *
   * This is a NervosDAO convenience constant.
   */
  static oneCycle(): Epoch {
    return new Epoch(numFrom(180), 0n, numFrom(1));
  }

  /**
   * Compare this epoch to another EpochLike.
   *
   * Comparison is performed by converting both epochs to a common integer
   * representation: (number * length + index) scaled by the other's length.
   *
   * @param other - EpochLike value to compare against.
   * @returns 1 if this > other, 0 if equal, -1 if this < other.
   */
  compare(other: EpochLike): 1 | 0 | -1 {
    if (this === other) {
      return 0;
    }

    const other_ = Epoch.from(other);
    const a = (this.number * this.length + this.index) * other_.length;
    const b = (other_.number * other_.length + other_.index) * this.length;

    return a > b ? 1 : a < b ? -1 : 0;
  }

  /**
   * Check equality with another EpochLike.
   *
   * @param other - EpochLike to test equality against.
   * @returns true if both epochs represent the same value.
   */
  eq(other: EpochLike): boolean {
    return this.compare(other) === 0;
  }

  /**
   * Return a normalized epoch:
   * - Ensures index is non-negative by borrowing from `number` if needed.
   * - Reduces the fraction (index/length) by their GCD.
   * - Carries any whole units from the fraction into `number`.
   *
   * @returns A new, normalized Epoch instance.
   */
  normalized(): Epoch {
    let { number, index, length } = this;

    // Normalize negative index values by borrowing from the whole number.
    if (index < Zero) {
      // Calculate how many whole units to borrow.
      const n = (-index + length - 1n) / length;
      number -= n;
      index += length * n;
    }

    // Reduce the fraction (index / length) to its simplest form using the greatest common divisor.
    const g = gcd(index, length);
    index /= g;
    length /= g;

    // Add any whole number overflow from the fraction.
    number += index / length;

    // Calculate the leftover index after accounting for the whole number part from the fraction.
    index %= length;

    return new Epoch(number, index, length);
  }

  /**
   * Add another epoch to this one.
   *
   * If denominators differ, the method aligns to a common denominator before
   * adding the fractional numerators, then returns a normalized Epoch.
   *
   * @param other - EpochLike to add.
   * @returns New Epoch equal to this + other.
   */
  add(other: EpochLike): Epoch {
    const other_ = Epoch.from(other);

    // Sum the whole number parts.
    const number = this.number + other_.number;
    let index: Num;
    let length: Num;

    // If the epochs have different denominators (lengths), align them to a common denominator.
    if (this.length !== other_.length) {
      index = other_.index * this.length + this.index * other_.length;
      length = this.length * other_.length;
    } else {
      // If denominators are equal, simply add the indices.
      index = this.index + other_.index;
      length = this.length;
    }

    return new Epoch(number, index, length).normalized();
  }

  /**
   * Subtract an epoch from this epoch.
   *
   * @param other - EpochLike to subtract.
   * @returns New Epoch equal to this - other.
   */
  sub(other: EpochLike): Epoch {
    const { number, index, length } = Epoch.from(other);
    return this.add(new Epoch(-number, -index, length));
  }

  /**
   * Convert this epoch to an estimated Unix timestamp in milliseconds using as reference the block header.
   *
   * @param reference - ClientBlockHeader providing a reference epoch and timestamp.
   * @returns Unix timestamp in milliseconds as bigint.
   */
  toUnix(reference: ClientBlockHeader): bigint {
    // Calculate the difference between the provided epoch and the reference epoch.
    const { number, index, length } = this.sub(reference.epoch);

    return (
      reference.timestamp +
      epochInMilliseconds * number +
      (epochInMilliseconds * index) / length
    );
  }
}

/**
 * A constant representing the epoch duration in milliseconds.
 *
 * Calculated as 4 hours in milliseconds:
 * 4 hours * 60 minutes per hour * 60 seconds per minute * 1000 milliseconds per second.
 */
const epochInMilliseconds = numFrom(14400000); // (Number.isSafeInteger(14400000) === true)
