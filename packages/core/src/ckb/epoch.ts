import type { ClientBlockHeader } from "../client/clientTypes.js";
import { codec, codecPadding, codecUint, Entity } from "../codec/index.js";
import { Zero } from "../fixedPoint/index.js";
import { type Hex, type HexLike } from "../hex/index.js";
import { mol } from "../molecule/index.js";
import { numFrom, NumLike, numToHex, type Num } from "../num/index.js";
import { gcd } from "../utils/index.js";

/**
 * EpochLike
 *
 * Union type that represents any allowed input shapes that can be converted
 * into an Epoch instance.
 *
 * Accepted shapes:
 * - Tuple: [integer, numerator, denominator] where each element is NumLike
 * - Object: { integer, numerator, denominator } where each field is NumLike
 * - Packed numeric form: Num (bigint) or Hex (RPC-style packed hex)
 *
 * Notes:
 * - When constructing an Epoch from a Num or Hex the packed numeric representation
 *   encodes integer (24 bits), numerator (16 bits) and denominator (16 bits).
 * - Use Epoch.from() to convert any EpochLike into an Epoch instance.
 *
 * @example
 * // From tuple
 * Epoch.from([1n, 0n, 1n]);
 */
export type EpochLike =
  | [NumLike, NumLike, NumLike]
  | {
      integer: NumLike;
      numerator: NumLike;
      denominator: NumLike;
    }
  | Num
  | Hex;

/**
 * Epoch
 *
 * Represents a blockchain epoch consisting of a whole integer part and an
 * optional fractional part represented as numerator/denominator.
 *
 * Behavior highlights:
 * - Internally stores values as Num (bigint).
 * - Provides normalization routines to canonicalize the fractional part:
 *   - normalizeBase(): fixes zero/negative denominators
 *   - normalizeCanonical(): reduces fraction, borrows/carries whole units
 * - Supports arithmetic (add/sub), comparison and conversion utilities.
 *
 * @example
 * const e = new Epoch(1n, 1n, 2n); // 1 + 1/2
 *
 * @remarks
 * This class is primarily a thin value-object; operations return new Epoch instances.
 */
@codec(
  mol.struct({
    padding: codecPadding(1),
    denominator: codecUint(2),
    numerator: codecUint(2),
    integer: codecUint(3),
  }),
)
export class Epoch extends Entity.Base<EpochLike, Epoch>() {
  /**
   * Construct a new Epoch instance.
   *
   * @param integer - Whole epoch units (Num/bigint)
   * @param numerator - Fractional numerator (Num).
   * @param denominator - Fractional denominator (Num).
   */
  public constructor(
    public readonly integer: Num,
    public readonly numerator: Num,
    public readonly denominator: Num,
  ) {
    super();
  }

  /**
   * Normalize simpler base invariants:
   * - If denominator === 0, set denominator to 1 and numerator to 0 for arithmetic convenience.
   * - If denominator is negative flip signs of numerator and denominator to keep denominator positive.
   *
   * This is a minimal correction used before arithmetic or canonical normalization.
   *
   * @returns New Epoch with denominator corrected (but fraction not reduced).
   */
  normalizeBase(): Epoch {
    if (this.denominator === Zero) {
      return new Epoch(this.integer, Zero, numFrom(1));
    }

    if (this.denominator < Zero) {
      return new Epoch(this.integer, -this.numerator, -this.denominator);
    }

    return this;
  }

  /**
   * Perform full canonical normalization of the epoch value.
   *
   * Steps:
   * 1. Apply base normalization (normalizeBase).
   * 2. If numerator is negative, borrow whole denominator(s) from the integer part
   *    so numerator becomes non-negative. This ensures 0 <= numerator < denominator whenever possible.
   * 3. Reduce numerator/denominator by their greatest common divisor (gcd).
   * 4. Carry any whole units from the reduced numerator into the integer part.
   * 5. Ensure numerator is the strict remainder (numerator < denominator).
   *
   * @returns Canonicalized Epoch with a non-negative, reduced fractional part and integer adjusted accordingly.
   */
  normalizeCanonical(): Epoch {
    let { integer, numerator, denominator } = this.normalizeBase();

    // If numerator is negative, borrow enough whole denominators from integer so numerator >= 0.
    if (numerator < Zero) {
      // n is the minimal non-negative integer such that numerator + n * denominator >= 0
      const n = (-numerator + denominator - 1n) / denominator;
      integer -= n;
      numerator += denominator * n;
    }

    // Reduce the fractional part to lowest terms to keep canonical form and avoid unnecessarily large multiples.
    const g = gcd(numerator, denominator);
    numerator /= g;
    denominator /= g;

    // Move any full units contained in the fraction into integer (e.g., 5/2 => +2 integer, remainder 1/2).
    integer += numerator / denominator;

    // Remainder numerator after removing whole units; ensures numerator < denominator.
    numerator %= denominator;

    return new Epoch(integer, numerator, denominator);
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
   * Convert this Epoch into its RPC-style packed numeric representation (Num).
   *
   * Packing layout (little-endian style fields):
   * - integer: lower 24 bits
   * - numerator: next 16 bits
   * - denominator: next 16 bits
   *
   * Throws if any component is negative since packed representation assumes non-negative components.
   *
   * @throws {Error} If integer, numerator or denominator are negative.
   * @throws {Error} If integer, numerator or denominator overflow the packing limits.
   * @returns Packed numeric representation (Num) suitable for RPC packing.
   */
  toNum(): Num {
    if (
      this.integer < Zero ||
      this.numerator < Zero ||
      this.denominator < Zero
    ) {
      throw Error("Negative values in Epoch to Num conversion");
    }

    if (
      this.integer >= numFrom("0x1000000") || // 24-bit limit
      this.numerator >= numFrom("0x10000") || // 16-bit limit
      this.denominator >= numFrom("0x10000") // 16-bit limit
    ) {
      throw Error(
        "Integer must be < 2^24, numerator and denominator must be < 2^16",
      );
    }

    return (
      this.integer +
      (this.numerator << numFrom(24)) +
      (this.denominator << numFrom(40))
    );
  }

  /**
   * Convert epoch to hex string representation of the RPC-style packed numeric form.
   *
   * Returns the same representation used by CKB RPC responses where the
   * packed numeric bytes may be trimmed of leading zeros, see {@link numToHex}
   *
   * @returns Hex string corresponding to the packed epoch.
   */
  toPackedHex(): Hex {
    return numToHex(this.toNum());
  }

  /**
   * Construct an Epoch by unpacking a RPC-style packed numeric form.
   *
   * @param v - NumLike packed epoch (like Num and Hex)
   * @returns Epoch whose integer, numerator and denominator are extracted from the packed layout.
   */
  static fromNum(v: NumLike): Epoch {
    const num = numFrom(v);

    return new Epoch(
      num & numFrom("0xffffff"),
      (num >> numFrom(24)) & numFrom("0xffff"),
      (num >> numFrom(40)) & numFrom("0xffff"),
    );
  }

  /**
   * Create an Epoch from an EpochLike value.
   *
   * Accepts:
   * - an Epoch instance (returned as-is)
   * - an array [integer, numerator, denominator] where each element is NumLike
   * - an object { integer, numerator, denominator } where each field is NumLike
   * - a packed numeric-like value handled by fromNum
   *
   * All numeric-like inputs are converted with numFrom() to produce internal Num values.
   *
   * @param e - Value convertible to Epoch
   * @returns Epoch instance
   */
  static override from(e: EpochLike): Epoch {
    if (e instanceof Epoch) {
      return e;
    }

    if (Array.isArray(e)) {
      return new Epoch(numFrom(e[0]), numFrom(e[1]), numFrom(e[2]));
    }

    if (typeof e === "object") {
      return new Epoch(
        numFrom(e.integer),
        numFrom(e.numerator),
        numFrom(e.denominator),
      );
    }

    return Epoch.fromNum(e);
  }

  /**
   * Return a deep copy of this Epoch.
   *
   * @returns New Epoch instance with identical components.
   */
  override clone(): Epoch {
    return new Epoch(this.integer, this.numerator, this.denominator);
  }

  /**
   * Return the genesis epoch.
   *
   * Note: for historical reasons the genesis epoch is represented with all-zero
   * fields, no other epoch instance should use a zero denominator.
   *
   * @returns Epoch with integer = 0, numerator = 0, denominator = 0.
   */
  static get Genesis(): Epoch {
    return new Epoch(Zero, Zero, Zero);
  }

  /**
   * Return an Epoch representing one Nervos DAO cycle (180 epochs exactly).
   *
   * @returns Epoch equal to 180 with denominator set to 1 to represent an exact whole unit.
   */
  static get OneNervosDaoCycle(): Epoch {
    return new Epoch(numFrom(180), Zero, numFrom(1));
  }

  /**
   * Compare this epoch to another EpochLike.
   *
   * The comparison computes scaled integer values so fractions are compared without precision loss:
   *   scaled = (integer * denominator + numerator) * other.denominator
   *
   * Special-case: identical object references return equality immediately.
   *
   * @param other - Epoch-like value to compare against.
   * @returns 1 if this > other, 0 if equal, -1 if this < other.
   *
   * @example
   * epochA.compare(epochB); // -1|0|1
   */
  compare(other: EpochLike): 1 | 0 | -1 {
    if (this === other) {
      return 0;
    }

    const t = this.normalizeBase();
    const o = Epoch.from(other).normalizeBase();

    // Compute scaled representations to compare fractions without floating-point arithmetic.
    const a = (t.integer * t.denominator + t.numerator) * o.denominator;
    const b = (o.integer * o.denominator + o.numerator) * t.denominator;

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
   * Add another EpochLike to this epoch and return the normalized result.
   *
   * Rules and edge-cases:
   * - Whole parts are added directly; fractional parts are aligned to a common denominator and added.
   * - Final result is canonicalized to reduce the fraction and carry any overflow to the integer part.
   *
   * @param other - Epoch-like value to add.
   * @returns Normalized Epoch representing the sum.
   */
  add(other: EpochLike): Epoch {
    const t = this.normalizeBase();
    const o = Epoch.from(other).normalizeBase();

    // Sum whole integer parts.
    const integer = t.integer + o.integer;
    let numerator: Num;
    let denominator: Num;

    // Align denominators if they differ; use multiplication to obtain a common denominator.
    if (t.denominator !== o.denominator) {
      // Numerators & Denominators are generally small (<= 2000n); multiplication produces a safe common denominator.
      numerator = t.numerator * o.denominator + o.numerator * t.denominator;
      denominator = t.denominator * o.denominator;
    } else {
      numerator = t.numerator + o.numerator;
      denominator = t.denominator;
    }

    // Normalize to reduce fraction and carry whole units into integer.
    return new Epoch(integer, numerator, denominator).normalizeCanonical();
  }

  /**
   * Subtract an EpochLike from this epoch and return the normalized result.
   *
   * Implementation notes:
   * - Delegates to add by negating the other epoch's integer and numerator while preserving denominator.
   * - normalizeCanonical will handle negative numerators by borrowing from integer as necessary.
   *
   * @param other - Epoch-like value to subtract.
   * @returns Normalized Epoch representing this - other.
   */
  sub(other: EpochLike): Epoch {
    const { integer, numerator, denominator } = Epoch.from(other);
    return this.add(new Epoch(-integer, -numerator, denominator));
  }

  /**
   * Convert this epoch to an estimated Unix timestamp in milliseconds using a reference header.
   *
   * Note: This is an estimation that assumes a constant epoch duration.
   *
   * @param reference - Object providing `epoch` (Epoch) and `timestamp` (Num) fields, such as a ClientBlockHeader.
   * @param epochInMilliseconds - Duration of a single epoch in milliseconds. Defaults to 4 hours.
   * @returns Estimated Unix timestamp in milliseconds as bigint.
   */
  toUnix(
    reference: Pick<ClientBlockHeader, "epoch" | "timestamp">,
    epochInMilliseconds: Num = numFrom(4 * 60 * 60 * 1000),
  ): bigint {
    // Compute relative epoch difference against the reference header.
    const { integer, numerator, denominator } = this.sub(reference.epoch);

    // Add whole epoch duration and fractional epoch duration to the reference timestamp.
    return (
      reference.timestamp +
      epochInMilliseconds * integer +
      (epochInMilliseconds * numerator) / denominator
    );
  }
}

/**
 * epochFrom
 *
 * @deprecated prefer using Epoch.from() directly.
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
 * @deprecated use Epoch.fromNum() with numeric input instead.
 *
 * @param hex - Hex-like or numeric-like value encoding a packed epoch.
 * @returns Decoded Epoch instance.
 */
export function epochFromHex(hex: HexLike): Epoch {
  return Epoch.fromNum(hex);
}

/**
 * epochToHex
 *
 * @deprecated use Epoch.from(epochLike).toPackedHex() instead.
 *
 * @param epochLike - Value convertible to an Epoch (object, tuple or Epoch).
 * @returns Hex string representing the packed epoch encoding.
 */
export function epochToHex(epochLike: EpochLike): Hex {
  return Epoch.from(epochLike).toPackedHex();
}
