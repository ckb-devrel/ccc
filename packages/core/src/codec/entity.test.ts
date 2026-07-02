import { describe, expect, test } from "vitest";
import { bytesFrom } from "../bytes/index.js";
import { mol } from "../molecule/index.js";
import { Codec } from "./codec.js";
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

  constructor(v: number, via: string) {
    super();
    this.v = v;
    this.via = via;
  }

  static override from(fooLike: FooLike | Foo): Foo {
    if (fooLike instanceof Foo) {
      return fooLike;
    }
    return new Foo(fooLike.v, "Foo");
  }

  override clone(): Foo {
    return new Foo(this.v, this.via);
  }
}

/** A subclass of `Foo` that overrides `from` with distinguishable behavior. */
class Bar extends Foo {
  static override from(fooLike: FooLike | Foo): Foo {
    if (fooLike instanceof Foo) {
      return fooLike;
    }
    return new Foo(fooLike.v, "Bar");
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
