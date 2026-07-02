import { describe, expect, it } from "vitest";
import { hashCkb } from "../hasher/index.js";
import { hexFrom } from "../hex/index.js";
import { mol } from "../molecule/index.js";
import { DecodedType, EncodableType } from "./codec.js";
import { codec, Entity } from "./entity.js";

/**
 * A simple entity with no custom `from`. Its constructor accepts the decoded
 * shape directly, so `codec()` should be able to auto-generate `from`,
 * `encode`, `decode` and `fromBytes` without any extra code.
 */
const PointCodec = mol.struct({
  x: mol.Uint32,
  y: mol.Uint32,
});
type PointLike = EncodableType<typeof PointCodec>;

@codec(PointCodec)
class Point extends Entity.Base<PointLike, Point>() {
  public x: number;
  public y: number;

  constructor({ x, y }: DecodedType<typeof PointCodec>) {
    super();

    this.x = x;
    this.y = y;
  }
}

/**
 * An entity with a custom `from` that accepts multiple input shapes
 * (a bare bigint/number, or the canonical decoded object) and delegates
 * the canonical-shape case to `super.from(...)`, which is the
 * auto-generated implementation installed on the private `Impl` base
 * class by `codec()`.
 */
const MoneyCodec = mol.struct({
  amount: mol.Uint64,
});
type MoneyLike = EncodableType<typeof MoneyCodec> | bigint | number;

@codec(MoneyCodec)
class Money extends Entity.Base<MoneyLike, Money>() {
  public amount: bigint;

  constructor({ amount }: DecodedType<typeof MoneyCodec>) {
    super();

    this.amount = amount;
  }

  static from(input: MoneyLike): Money {
    if (input instanceof Money) {
      return input;
    }

    if (typeof input === "bigint" || typeof input === "number") {
      return super.from({ amount: BigInt(input) });
    }

    return super.from(input);
  }
}

describe("Entity + codec", () => {
  describe("auto-generated from/encode/decode (Point)", () => {
    it("exposes the fixed byteLength from the underlying codec", () => {
      expect(Point.byteLength).toBe(8); // 4 bytes for x + 4 bytes for y
    });

    it("auto-generates from() to construct instances from the decoded shape", () => {
      const p = Point.from({ x: 1, y: 2 });
      expect(p).toBeInstanceOf(Point);
      expect(p.x).toBe(1);
      expect(p.y).toBe(2);
    });

    it("returns the same reference when from() is called with an existing instance", () => {
      const p = Point.from({ x: 1, y: 2 });
      expect(Point.from(p)).toBe(p);
    });

    it("round-trips through encode/decode and fromBytes", () => {
      const p = Point.from({ x: 0x11223344, y: 0x55667788 });
      const bytes = Point.encode(p);
      expect(bytes.byteLength).toBe(8);

      const decoded = Point.decode(bytes);
      expect(decoded.x).toBe(p.x);
      expect(decoded.y).toBe(p.y);

      const fromBytes = Point.fromBytes(bytes);
      expect(fromBytes.x).toBe(p.x);
      expect(fromBytes.y).toBe(p.y);
    });

    it("toBytes/toHex/hash are consistent with each other", () => {
      const p = Point.from({ x: 7, y: 9 });
      const bytes = p.toBytes();
      expect(p.toHex()).toBe(hexFrom(bytes));
      expect(p.hash()).toBe(hashCkb(bytes));
    });

    it("eq() compares by value, not by reference", () => {
      const a = Point.from({ x: 3, y: 4 });
      const b = Point.from({ x: 3, y: 4 });
      const c = Point.from({ x: 3, y: 5 });

      expect(a).not.toBe(b);
      expect(a.eq(b)).toBe(true);
      expect(a.eq(c)).toBe(false);
      // eq() also accepts a Like value, not just an instance
      expect(a.eq({ x: 3, y: 4 })).toBe(true);
    });

    it("clone() returns an equal but distinct instance", () => {
      const a = Point.from({ x: 3, y: 4 });
      const b = a.clone();

      expect(b).not.toBe(a);
      expect(b).toBeInstanceOf(Point);
      expect(b.eq(a)).toBe(true);
    });
  });

  describe("custom from() delegating to super.from() (Money)", () => {
    it("normalizes a bigint/number input via super.from()", () => {
      const a = Money.from(5n);
      const b = Money.from(5);

      expect(a.amount).toBe(5n);
      expect(b.amount).toBe(5n);
    });

    it("accepts the canonical decoded shape directly via super.from()", () => {
      const m = Money.from({ amount: 42n });
      expect(m.amount).toBe(42n);
    });

    it("returns the same reference for an existing instance", () => {
      const m = Money.from(1n);
      expect(Money.from(m)).toBe(m);
    });

    it("round-trips through encode/decode using the overridden from()", () => {
      const m = Money.from(123456789n);
      const bytes = Money.encode(m);
      const decoded = Money.decode(bytes);

      expect(decoded).toBeInstanceOf(Money);
      expect(decoded.amount).toBe(m.amount);
    });
  });
});
