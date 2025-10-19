import { type Bytes, type BytesLike } from "../bytes/index.js";
import type { ClientBlockHeader } from "../client/clientTypes.js";
import { Zero } from "../fixedPoint/index.js";
import { type Hex, type HexLike } from "../hex/index.js";
import { mol } from "../molecule/index.js";
import {
  numBeToBytes,
  numFrom,
  NumLike,
  numToHex,
  type Num,
} from "../num/index.js";
import { gcd } from "../utils/index.js";

/**
 * EpochLike
 *
 * Union type that represents any allowed input shapes that can be converted
 * into an Epoch instance.
 *
 * - Object form: { integer, numerator, denominator } where each member is NumLike
 * - Tuple form: [integer, numerator, denominator] using NumLike values
 *
 * All numeric-like values are converted via numFrom() when creating an Epoch.
 */
export type EpochLike =
  | {
      integer: NumLike;
      numerator: NumLike;
      denominator: NumLike;
    }
  | [NumLike, NumLike, NumLike];

/**
 * Epoch
 *
 * Represents a blockchain epoch composed of a whole integer part and an optional
 * fractional part represented with numerator/denominator. This class stores
 * values using the project's Num (bigint) type and provides utilities for
 * packing/unpacking, arithmetic, normalization and conversion to an estimated
 * Unix timestamp based on a reference block header.
 *
 * Important invariants:
 * - For the canonical (non-zero) epoch the denominator must be > 0.
 * - The zero epoch is represented with integer=0, numerator=0 and denominator=0.
 * - Use normalized() to obtain a canonical representation (reduced fraction and
 *   numerator < denominator).
 *
 * @example
 * const e = new Epoch(numFrom(1), numFrom(2), numFrom(3)); // 1 + 2/3
 */
export class Epoch extends mol.Entity.Base<EpochLike, Epoch>() {
  /**
   * Construct a new Epoch instance.
   *
   * @param integer - Whole epoch units (Num).
   * @param numerator - Fractional numerator (Num).
   * @param denominator - Fractional denominator (Num). For a non-zero epoch must be > 0.
   *                      For the zero epoch, denominator can be 0 (with integer and numerator also 0).
   * @throws Error If denominator is zero while integer or numerator are non-zero.
   * @throws Error If denominator is negative.
   */
  public constructor(
    public readonly integer: Num,
    public readonly numerator: Num,
    public readonly denominator: Num,
  ) {
    // Ensure the epoch has a non zero in non-zero epoch.
    if (denominator === Zero && (integer !== Zero || numerator !== Zero)) {
      throw new Error("Zero Epoch denominator on non-zero epoch");
    }
    // Ensure the epoch has a non negative denominator.
    if (denominator < Zero) {
      throw new Error("Denominator must be non-negative.");
    }

    // If denominator is zero, then it's the zero epoch.
    super();
  }

  /**
   * Backwards-compatible array-style index 0 referencing the whole epoch integer.
   *
   * @returns integer portion (Num)
   * @deprecated Use `.integer` property instead.
   */
  get 0(): Num {
    return this.integer;
  }

  /**
   * Backwards-compatible array-style index 1 referencing the epoch fractional numerator.
   *
   * @returns numerator portion (Num)
   * @deprecated Use `.numerator` property instead.
   */
  get 1(): Num {
    return this.numerator;
  }

  /**
   * Backwards-compatible array-style index 2 referencing the epoch fractional denominator.
   *
   * @returns denominator portion (Num)
   * @deprecated Use `.denominator` property instead.
   */
  get 2(): Num {
    return this.denominator;
  }

  /**
   * Decode a packed epoch from numeric/bytes.
   *
   * The packed format encodes integer, numerator and denominator into a single
   * numeric value.
   *
   * This is the inverse of encode().
   *
   * @param v - Numeric or bytes-like value containing the packed epoch.
   * @returns Decoded Epoch instance.
   * @throws Error If the provided value cannot be converted into an Epoch by numFrom.
   */
  static override decode(v: NumLike): Epoch {
    const num = numFrom(v);

    return new Epoch(
      num & numFrom("0xffffff"),
      (num >> numFrom(24)) & numFrom("0xffff"),
      (num >> numFrom(40)) & numFrom("0xffff"),
    );
  }

  /**
   * Create an Epoch from bytes. Alias to `decode`.
   *
   * @param bytes - Bytes-like or numeric-like value representing the packed epoch.
   * @returns Decoded Epoch instance.
   * @throws Error If decoding fails.
   */
  static override fromBytes(bytes: BytesLike): Epoch {
    return Epoch.decode(bytes);
  }

  /**
   * Encode the Epoch into big-endian bytes.
   *
   * The packing uses the same fixed-width layout described in decode().
   *
   * @param e - Epoch-like value (Epoch instance, tuple or object) to encode.
   * @returns Bytes containing the packed epoch in big-endian form.
   * @throws Error If the input cannot be converted to an Epoch.
   */
  static override encode(e: EpochLike): Bytes {
    const epoch = Epoch.from(e);
    return numBeToBytes(epoch.toNum());
  }

  /**
   * Convert epoch to hex string representation of the packed numeric form.
   *
   * @returns Hex string corresponding to the packed epoch.
   */
  override toHex(): Hex {
    return numToHex(this.toNum());
  }

  /**
   * Convert this Epoch into its packed numeric representation.
   *
   * @returns Packed numeric (Num) representation of this epoch.
   */
  toNum(): Num {
    return (
      this.integer +
      (this.numerator << numFrom(24)) +
      (this.denominator << numFrom(40))
    );
  }

  /**
   * Create an Epoch from an EpochLike value.
   *
   * Accepts:
   * - an Epoch instance (returned as-is)
   * - an object { integer, numerator, denominator } where each field is NumLike
   * - a tuple [integer, numerator, denominator] where each element is NumLike
   *
   * Converts inputs using numFrom to the internal Num type.
   *
   * @param epochLike - Value to convert into an Epoch.
   * @returns Epoch instance (new or the same instance if already an Epoch).
   */
  static override from(epochLike: EpochLike): Epoch {
    if (epochLike instanceof Epoch) {
      return epochLike;
    }

    const [integer, numerator, denominator] = Array.isArray(epochLike)
      ? epochLike
      : [epochLike.integer, epochLike.numerator, epochLike.denominator];

    return new Epoch(
      numFrom(integer),
      numFrom(numerator),
      numFrom(denominator),
    );
  }

  /**
   * Return a deep copy of this Epoch.
   *
   * @returns New Epoch instance with identical integer, numerator and denominator.
   */
  override clone(): Epoch {
    return new Epoch(this.integer, this.numerator, this.denominator);
  }

  /**
   * Return an Epoch representing the zero epoch (0 + 0/0).
   *
   * Use this to represent an absent or zero epoch; denominator == 0 identifies this special case.
   *
   * @returns Epoch where integer=0, numerator=0, denominator=0.
   */
  static zero(): Epoch {
    return new Epoch(Zero, Zero, Zero);
  }

  /**
   * Return an Epoch representing one Nervos DAO cycle (180 + 0/1).
   *
   * @returns Epoch equal to 180 with a denominator of 1 (explicit whole unit).
   */
  static oneNervosDaoCycle(): Epoch {
    return new Epoch(numFrom(180), Zero, numFrom(1));
  }

  /**
   * Compare this epoch to another EpochLike.
   *
   * Comparison converts both epochs to a common scaled integer:
   * (integer * denominator + numerator) scaled by the other epoch's denominator
   * so that fractions are compared accurately without losing precision.
   *
   * Special-case: exact same object returns 0.
   *
   * @param other - Epoch-like value to compare against.
   * @returns 1 if this > other, 0 if equal, -1 if this < other.
   */
  compare(other: EpochLike): 1 | 0 | -1 {
    if (this === other) {
      return 0;
    }

    const o = Epoch.from(other);

    // Performance note:
    // - Denominators are typically below 2000n
    // - Intermediate products remain reasonably small.
    // - Multiplication does not introduce significant performance overhead.
    let a = this.integer * this.denominator + this.numerator;
    let b = o.integer * o.denominator + o.numerator;

    if (
      this.denominator !== o.denominator &&
      this.denominator !== Zero &&
      o.denominator !== Zero
    ) {
      // Align denominators by scaling both totals by the opposite denominator.
      a *= o.denominator;
      b *= this.denominator;
    }

    return a > b ? 1 : a < b ? -1 : 0;
  }

  /**
   * Check whether this epoch is less than another EpochLike.
   *
   * @param other - EpochLike to compare against.
   * @returns true if this < other.
   */
  lt(other: EpochLike): boolean {
    return this.compare(other) < 0;
  }

  /**
   * Check whether this epoch is less than or equal to another EpochLike.
   *
   * @param other - EpochLike to compare against.
   * @returns true if this <= other.
   */
  le(other: EpochLike): boolean {
    return this.compare(other) <= 0;
  }

  /**
   * Check whether this epoch equals another EpochLike.
   *
   * @param other - EpochLike to compare against.
   * @returns true if equal.
   */
  eq(other: EpochLike): boolean {
    return this.compare(other) === 0;
  }

  /**
   * Check whether this epoch is greater than or equal to another EpochLike.
   *
   * @param other - EpochLike to compare against.
   * @returns true if this >= other.
   */
  ge(other: EpochLike): boolean {
    return this.compare(other) >= 0;
  }

  /**
   * Check whether this epoch is greater than another EpochLike.
   *
   * @param other - EpochLike to compare against.
   * @returns true if this > other.
   */
  gt(other: EpochLike): boolean {
    return this.compare(other) > 0;
  }

  /**
   * Return a normalized Epoch.
   *
   * Normalization performs the following steps:
   * 1. If denominator === 0 the epoch is the special zero epoch and is returned unchanged.
   * 2. If numerator is negative, borrow whole units from integer until numerator >= 0.
   *    - This ensures the fractional part is non-negative even if the original fraction was negative.
   * 3. Reduce numerator/denominator by their greatest common divisor (gcd) so the fraction is in lowest terms.
   * 4. Extract any whole units encoded in the fractional part (numerator / denominator) and add them to integer.
   * 5. Keep only the residual numerator (numerator % denominator) so numerator < denominator.
   *
   * Edge cases:
   * - If numerator becomes equal to denominator during step 4, it will be carried into integer and numerator becomes 0.
   *
   * @returns New Epoch in canonical normalized form (reduced fraction and numerator < denominator).
   */
  normalized(): Epoch {
    let { integer, numerator, denominator } = this;

    if (denominator === Zero) {
      // Zero epoch is already canonical; no normalization applies.
      return this;
    }

    // If numerator is negative, determine how many whole denominators to borrow
    // from the integer part so that numerator becomes non-negative.
    if (numerator < Zero) {
      // n is the minimal positive integer such that numerator + n * denominator >= 0
      const n = (-numerator + denominator - 1n) / denominator;
      integer -= n;
      numerator += denominator * n;
    }

    // Reduce the fractional part to lowest terms to avoid overflow and keep canonical form.
    const g = gcd(numerator, denominator);
    numerator /= g;
    denominator /= g;

    // Convert any full units contained in the fraction into integer (e.g., 5/2 => +2 integer, remainder 1/2).
    integer += numerator / denominator;

    // Remainder numerator after removing whole units; ensures numerator < denominator.
    numerator %= denominator;

    return new Epoch(integer, numerator, denominator);
  }

  /**
   * Add another EpochLike to this epoch and return the normalized result.
   *
   * Addition rules:
   * - If either epoch is the zero epoch (denominator == 0) the other epoch is returned.
   * - Whole integer parts are added directly.
   * - Fractional parts are added using a common denominator (lcm reduced to multiplication here).
   * - The result is normalized to ensure fraction is in canonical form.
   *
   * @param other - Epoch-like value to add.
   * @returns Normalized sum of this and other (Epoch).
   */
  add(other: EpochLike): Epoch {
    const o = Epoch.from(other);
    if (this.denominator === Zero) {
      return o;
    }
    if (o.denominator === Zero) {
      return this;
    }

    // Sum whole integer parts.
    const integer = this.integer + o.integer;
    let numerator: Num;
    let denominator: Num;

    // Align denominators if they differ; use multiplication to get a common denominator.
    if (this.denominator !== o.denominator) {
      // Performance note:
      // - Denominators are typically below 2000n
      // - Intermediate products remain reasonably small.
      // - Multiplication does not introduce significant performance overhead.
      numerator =
        o.numerator * this.denominator + this.numerator * o.denominator;
      denominator = this.denominator * o.denominator;
    } else {
      // Denominators equal — simple numerator addition.
      numerator = this.numerator + o.numerator;
      denominator = this.denominator;
    }

    // Return normalized to reduce fraction and carry overflow to integer.
    return new Epoch(integer, numerator, denominator).normalized();
  }

  /**
   * Subtract an EpochLike from this epoch and return the normalized result.
   *
   * This implementation delegates to add by negating the other epoch's integer
   * and numerator. The denominator is preserved so that normalization can handle
   * negative numerators by borrowing from integer if necessary.
   *
   * @param other - Epoch-like value to subtract.
   * @returns Normalized difference this - other.
   */
  sub(other: EpochLike): Epoch {
    const { integer, numerator, denominator } = Epoch.from(other);
    return this.add(new Epoch(-integer, -numerator, denominator));
  }

  /**
   * Convert this epoch to an estimated Unix timestamp in milliseconds
   * using a reference block header.
   *
   * Calculation:
   * - Compute delta = this - reference.epoch
   * - If delta.denominator === 0: this or reference epoch is zero — return reference.timestamp.
   * - Otherwise: return reference.timestamp + delta.integer * EPOCH_IN_MILLISECONDS + (delta.numerator * EPOCH_IN_MILLISECONDS) / delta.denominator
   *
   * Note: This is an estimation that assumes each epoch has constant duration EPOCH_IN_MILLISECONDS.
   *
   * @param reference - Block header providing `epoch` and `timestamp` fields.
   * @returns Estimated Unix timestamp in milliseconds (Num / bigint).
   */
  toUnix(reference: ClientBlockHeader): bigint {
    // Compute relative epoch difference against the reference header.
    const { integer, numerator, denominator } = this.sub(reference.epoch);

    if (denominator === Zero) {
      // If denominator == 0 the difference leads to the zero epoch case — return the reference timestamp unchanged.
      return reference.timestamp;
    }

    // Add whole epoch duration and fractional epoch duration to the reference timestamp.
    return (
      reference.timestamp +
      EPOCH_IN_MILLISECONDS * integer +
      (EPOCH_IN_MILLISECONDS * numerator) / denominator
    );
  }
}

/**
 * EPOCH_IN_MILLISECONDS
 *
 * Constant duration of a single epoch expressed in milliseconds.
 * Defined as 4 hours = 4 * 60 * 60 * 1000 ms.
 *
 * Stored as Num (bigint) to avoid precision loss in arithmetic with other Num values.
 */
const EPOCH_IN_MILLISECONDS = numFrom(4 * 60 * 60 * 1000);

/**
 * epochFrom
 *
 * Deprecated compatibility helper — use Epoch.from instead.
 *
 * @param epochLike - Epoch-like value to convert.
 * @returns Epoch instance corresponding to the input.
 */
export function epochFrom(epochLike: EpochLike): Epoch {
  return Epoch.from(epochLike);
}

/**
 * epochFromHex
 *
 * Deprecated helper — use Epoch.decode instead.
 *
 * @param hex - Hex-like or numeric-like value encoding a packed epoch.
 * @returns Decoded Epoch instance.
 */
export function epochFromHex(hex: HexLike): Epoch {
  return Epoch.decode(hex);
}

/**
 * epochToHex
 *
 * Deprecated helper — use Epoch.from(epochLike).toHex() instead.
 *
 * @param epochLike - Value convertible to an Epoch (object, tuple or Epoch).
 * @returns Hex string representing the packed epoch encoding.
 */
export function epochToHex(epochLike: EpochLike): Hex {
  return Epoch.from(epochLike).toHex();
}
