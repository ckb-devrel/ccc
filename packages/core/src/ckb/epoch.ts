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
      integer: NumLike;
      numerator: NumLike;
      denominator: NumLike;
    }
  | [NumLike, NumLike, NumLike];

@mol.codec(
  mol
    .struct({
      denominator: mol.uint(2, true),
      numerator: mol.uint(2, true),
      integer: mol.uint(3, true),
    })
    .mapIn((encodable: EpochLike) => Epoch.from(encodable)),
)
/**
 * Epoch
 *
 * Represents a timestamp-like epoch as a mixed whole integer and fractional part:
 * - integer: whole units
 * - numerator: numerator of the fractional part
 * - denominator: denominator of the fractional part (must be > 0)
 *
 * The fractional portion is numerator/denominator. Instances normalize fractions where
 * appropriate (e.g., reduce by GCD, carry whole units).
 */
export class Epoch extends mol.Entity.Base<EpochLike, Epoch>() {
  /**
   * Construct a new Epoch.
   *
   * The constructor enforces a positive `denominator`. If `denominator`
   * is non-positive an Error is thrown.
   *
   * @param integer - Whole number portion of the epoch.
   * @param numerator - Fractional numerator.
   * @param denominator - Fractional denominator (must be > 0).
   */
  public constructor(
    public readonly integer: Num,
    public readonly numerator: Num,
    public readonly denominator: Num,
  ) {
    // Ensure the epoch has a positive denominator.
    if (denominator <= Zero) {
      throw new Error("Non positive Epoch denominator");
    }
    super();
  }

  /**
   * @deprecated use `integer` instead
   * Backwards-compatible array-style index 0 referencing the whole epoch integer.
   */
  get 0(): Num {
    return this.integer;
  }

  /**
   * @deprecated use `numerator` instead
   * Backwards-compatible array-style index 1 referencing the epoch fractional numerator.
   */
  get 1(): Num {
    return this.numerator;
  }

  /**
   * @deprecated use `denominator` instead
   * Backwards-compatible array-style index 2 referencing the epoch fractional denominator.
   */
  get 2(): Num {
    return this.denominator;
  }

  /**
   * Create an Epoch from an EpochLike value.
   *
   * Accepts:
   * - an Epoch instance (returned as-is)
   * - an object { integer, numerator, denominator } where each field is NumLike
   * - a tuple [integer, numerator, denominator] where each element is NumLike
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

    let integer: NumLike, numerator: NumLike, denominator: NumLike;
    if (Array.isArray(epochLike)) {
      [integer, numerator, denominator] = epochLike;
    } else {
      ({ integer, numerator, denominator } = epochLike);
    }

    return new Epoch(
      numFrom(integer),
      numFrom(numerator),
      numFrom(denominator),
    );
  }

  /**
   * Return an epoch representing zero (0 + 0/1).
   */
  static zero(): Epoch {
    return new Epoch(0n, 0n, numFrom(1));
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
   * representation: (integer * denominator + numerator) scaled by the other's denominator.
   *
   * @param other - EpochLike value to compare against.
   * @returns 1 if this > other, 0 if equal, -1 if this < other.
   */
  compare(other: EpochLike): 1 | 0 | -1 {
    if (this === other) {
      return 0;
    }

    const o = Epoch.from(other);
    const a =
      (this.integer * this.denominator + this.numerator) * o.denominator;
    const b = (o.integer * o.denominator + o.numerator) * this.denominator;

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
   * - Ensures numerator is non-negative by borrowing from `integer` if needed.
   * - Reduces the fraction (numerator/denominator) by their GCD.
   * - Carries any whole units from the fraction into `integer`.
   *
   * @returns A new, normalized Epoch instance.
   */
  normalized(): Epoch {
    let { integer, numerator, denominator } = this;

    // Normalize negative numerator values by borrowing from the whole integer.
    if (numerator < Zero) {
      // Calculate how many whole units to borrow.
      const n = (-numerator + denominator - 1n) / denominator;
      integer -= n;
      numerator += denominator * n;
    }

    // Reduce the fraction (numerator / denominator) to its simplest form using the greatest common divisor.
    const g = gcd(numerator, denominator);
    numerator /= g;
    denominator /= g;

    // Add any whole integer overflow from the fraction.
    integer += numerator / denominator;

    // Calculate the leftover numerator after accounting for the whole integer part from the fraction.
    numerator %= denominator;

    return new Epoch(integer, numerator, denominator);
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
    const o = Epoch.from(other);

    // Sum the whole integer parts.
    const integer = this.integer + o.integer;
    let numerator: Num;
    let denominator: Num;

    // If the epochs have different denominators, align them to a common denominator.
    if (this.denominator !== o.denominator) {
      numerator =
        o.numerator * this.denominator + this.numerator * o.denominator;
      denominator = this.denominator * o.denominator;
    } else {
      // If denominators are equal, simply add the numerators.
      numerator = this.numerator + o.numerator;
      denominator = this.denominator;
    }

    return new Epoch(integer, numerator, denominator).normalized();
  }

  /**
   * Subtract an epoch from this epoch.
   *
   * @param other - EpochLike to subtract.
   * @returns New Epoch equal to this - other.
   */
  sub(other: EpochLike): Epoch {
    const { integer, numerator, denominator } = Epoch.from(other);
    return this.add(new Epoch(-integer, -numerator, denominator));
  }

  /**
   * Convert this epoch to an estimated Unix timestamp in milliseconds using as reference the block header.
   *
   * @param reference - ClientBlockHeader providing a reference epoch and timestamp.
   * @returns Unix timestamp in milliseconds as bigint.
   */
  toUnix(reference: ClientBlockHeader): bigint {
    // Calculate the difference between the provided epoch and the reference epoch.
    const { integer, numerator, denominator } = this.sub(reference.epoch);

    return (
      reference.timestamp +
      EPOCH_IN_MILLISECONDS * integer +
      (EPOCH_IN_MILLISECONDS * numerator) / denominator
    );
  }
}

/**
 * A constant representing the epoch duration in milliseconds.
 *
 * Calculated as 4 hours in milliseconds:
 * 4 hours * 60 minutes per hour * 60 seconds per minute * 1000 milliseconds per second.
 */
const EPOCH_IN_MILLISECONDS = numFrom(4 * 60 * 60 * 1000);
