import { describe, expect, it, test } from "vitest";
import { bytesFrom } from "../bytes/index.js";
import { hashCkb } from "../hasher/index.js";
import { hexFrom } from "../hex/index.js";
import { mol } from "../molecule/index.js";
import { Codec, DecodedType, EncodableType } from "./codec.js";
import { codec, Entity } from "./entity.js";

interface FooLike {
  v: number;
}

/**
 * A minimal entity decorated with `@codec`, used as the base class for the
 * dispatch tests below. `Foo.from` marks values it produces with `via: "Foo"`
 * so tests can assert which class' `from` actually ran.
 */
@codec(mol.table({ v: mol.Uint8 }))
class Foo extends Entity.Base<FooLike, Foo>() {
  public readonly v: number;
  public readonly via: string;

  constructor({ v }: { v: number }, via: string) {
    super();
    this.v = v;
    this.via = via;
  }

  static override from(fooLike: FooLike | Foo): Foo {
    if (fooLike instanceof Foo) {
      return fooLike;
    }
    return new Foo({ v: fooLike.v }, "Foo");
  }

  override clone(): Foo {
    return new Foo({ v: this.v }, this.via);
  }
}

/** A subclass of `Foo` that overrides `from` with distinguishable behavior. */
class Bar extends Foo {
  static override from(fooLike: FooLike | Foo): Foo {
    if (fooLike instanceof Foo) {
      return fooLike;
    }
    return new Foo({ v: fooLike.v }, "Bar");
  }
}

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

describe("codec decorator static method dispatch", () => {
  test("Foo.encode/decode/fromBytes dispatch to Foo.from", () => {
    const bytes = Foo.encode({ v: 1 });
    expect(Foo.decode(bytes).via).toBe("Foo");
    expect(Foo.fromBytes(bytes).via).toBe("Foo");
  });

  test("Bar.encode/decode/fromBytes dispatch to Bar.from, not the inherited Foo.from", () => {
    // Bar does not redefine encode/decode/fromBytes; it inherits them from the
    // shared Base installed by the `@codec` decorator on `Foo`. Calling them
    // through `Bar` must still resolve `from` against `Bar`, since `this` is
    // bound to the receiver of the call (`Bar`), not the class that was
    // originally decorated (`Foo`).
    const bytes = Bar.encode({ v: 1 });
    expect(Bar.decode(bytes).via).toBe("Bar");
    expect(Bar.fromBytes(bytes).via).toBe("Bar");
  });

  test("Bar used as a nested field codec dispatches to Bar.from, not Foo.from", () => {
    // `mol.table` builds its field codec via `Codec.from(Bar)`, which reads
    // `Bar.encode`/`Bar.decode`/`Bar.from` off `Bar` without ever detaching
    // them from their receiver (no destructuring). This must preserve the
    // correct `this` binding so nested encode/decode still dispatch to
    // `Bar.from` and not to `Foo.from`.
    const outer = mol.table({ inner: Bar });

    const encoded = outer.encode({ inner: { v: 1 } });
    const decoded = outer.decode(encoded);
    expect(decoded.inner.via).toBe("Bar");

    const fromed = outer.from({ inner: { v: 1 } });
    expect(fromed.inner.via).toBe("Bar");
  });

  test("tearing encode off a class and calling it without a receiver throws", () => {
    // This is expected, ordinary JavaScript behavior for static methods that
    // rely on `this`: once detached from their receiver, they can no longer
    // resolve `this.from`. The `@codec` decorator and `Codec.from` must not
    // paper over this by rebinding `this` at property-read time; only the
    // framework's own internal call sites (e.g. `Codec.from`) are responsible
    // for calling these methods without tearing them off their class.
    const { encode } = Bar;
    expect(() => encode({ v: 1 })).toThrow(TypeError);
  });

  test("Codec.from does not tear encode/decode/from off the source object", () => {
    // Regression guard for `Codec.from`: it must keep a reference to the
    // passed-in `codecLike` and call `codecLike.encode(...)` etc. as member
    // calls (preserving `this`), rather than destructuring
    // `{ encode, decode, from }` into standalone functions, which would lose
    // the receiver and break subclass dispatch through nested codecs.
    const rebound = Codec.from(Bar);
    const encoded = rebound.encode({ v: 1 });
    expect(rebound.decode(bytesFrom(encoded)).via).toBe("Bar");
    expect(rebound.from({ v: 1 }).via).toBe("Bar");
  });
});

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
