import { describe, expect, it } from "vitest";
import {
  Epoch,
  EPOCH_IN_MILLISECONDS,
  epochFrom,
  epochFromHex,
  epochToHex,
} from "./epoch";

describe("Epoch", () => {
  it("constructs from tuple and object via from()", () => {
    const a = Epoch.from([1n, 2n, 3n]);
    expect(a.integer).toBe(1n);
    expect(a.numerator).toBe(2n);
    expect(a.denominator).toBe(3n);

    const b = Epoch.from({ integer: 4n, numerator: 5n, denominator: 6n });
    expect(b.integer).toBe(4n);
    expect(b.numerator).toBe(5n);
    expect(b.denominator).toBe(6n);

    const c = new Epoch(7n, 8n, 9n);
    expect(Epoch.from(c)).toBe(c);
  });

  it("packs and unpacks numeric layout (toNum/fromNum) and hex conversion", () => {
    const e = new Epoch(0x010203n, 0x0405n, 0x0607n); // use values within bit widths
    const packed1 = e.toNum();
    // integer in lower 24 bits, numerator next 16, denominator next 16
    expect(packed1 & 0xffffffn).toBe(0x010203n);
    expect((packed1 >> 24n) & 0xffffn).toBe(0x0405n);
    expect((packed1 >> 40n) & 0xffffn).toBe(0x0607n);

    const hex = e.toPackedHex();
    expect(typeof hex).toBe("string");
    expect(hex.startsWith("0x")).toBe(true);

    // round-trip
    const decoded = Epoch.fromNum(packed1);
    expect(decoded.integer).toBe(e.integer);
    expect(decoded.numerator).toBe(e.numerator);
    expect(decoded.denominator).toBe(e.denominator);
  });

  it("throws when packing negative components with toNum", () => {
    const e = new Epoch(-1n, 0n, 1n);
    expect(() => e.toNum()).toThrow();

    const e2 = new Epoch(0n, -1n, 1n);
    expect(() => e2.toNum()).toThrow();

    const e3 = new Epoch(0n, 0n, -1n);
    expect(() => e3.toNum()).toThrow();
  });

  it("throws when packing components too big with toNum", () => {
    const e = new Epoch(1n << 24n, 1n, 1n); // integer = 16777215 (24-bit limit + 1)
    expect(() => e.toNum()).toThrow();

    const e2 = new Epoch(1n, 1n << 16n, 1n); // numerator = 65536 (16-bit limit + 1)
    expect(() => e2.toNum()).toThrow();

    const e3 = new Epoch(1n, 1n, 1n << 16n); // denominator = 65536 (16-bit limit + 1)
    expect(() => e3.toNum()).toThrow();
  });

  it("normalizeBase fixes zero or negative denominators", () => {
    const a = new Epoch(1n, 2n, 0n).normalizeBase();
    expect(a.denominator).toBe(1n);
    expect(a.numerator).toBe(0n);

    const b = new Epoch(1n, 2n, -3n).normalizeBase();
    expect(b.denominator).toBe(3n);
    expect(b.numerator).toBe(-2n);
  });

  it("normalizeCanonical reduces fractions and carries/borrows correctly", () => {
    // reduction by gcd: 2/4 -> 1/2
    const a = new Epoch(1n, 2n, 4n).normalizeCanonical();
    expect(a.integer).toBe(1n);
    expect(a.numerator).toBe(1n);
    expect(a.denominator).toBe(2n);

    // carry: 5/2 -> +2 integer, remainder 1/2
    const b = new Epoch(0n, 5n, 2n).normalizeCanonical();
    expect(b.integer).toBe(2n);
    expect(b.numerator).toBe(1n);
    expect(b.denominator).toBe(2n);

    // borrow when numerator negative
    const c = new Epoch(5n, -1n, 2n).normalizeCanonical();
    // -1/2 borrowed: integer 4, numerator becomes 1/2
    expect(c.integer).toBe(4n);
    expect(c.numerator).toBe(1n);
    expect(c.denominator).toBe(2n);
  });

  it("clone returns a deep copy", () => {
    const e = new Epoch(1n, 1n, 1n);
    const c = e.clone();
    expect(c).not.toBe(e);
    expect(c.integer).toBe(e.integer);
    expect(c.numerator).toBe(e.numerator);
    expect(c.denominator).toBe(e.denominator);
  });

  it("genesis and oneNervosDaoCycle helpers", () => {
    const g = Epoch.genesis();
    expect(g.integer).toBe(0n);
    expect(g.numerator).toBe(0n);
    expect(g.denominator).toBe(0n);

    const o = Epoch.oneNervosDaoCycle();
    expect(o.integer).toBe(180n);
    expect(o.numerator).toBe(0n);
    expect(o.denominator).toBe(1n);
  });

  it("comparison operations and compare()", () => {
    const a = new Epoch(1n, 0n, 1n);
    const b = new Epoch(1n, 1n, 2n);
    const c = new Epoch(2n, 0n, 1n);

    expect(a.compare(b)).toBe(-1);
    expect(b.compare(a)).toBe(1);
    expect(a.compare(a)).toBe(0);

    expect(a.lt(b)).toBe(true);
    expect(b.le(b)).toBe(true);
    expect(b.eq(new Epoch(1n, 2n, 4n))).toBe(true); // 1 + 1/2 == 1 + 2/4
    expect(c.gt(b)).toBe(true);
    expect(c.ge(b)).toBe(true);
  });

  it("add and sub arithmetic with differing denominators", () => {
    const a = new Epoch(1n, 1n, 2n); // 1.5
    const b = new Epoch(2n, 1n, 3n); // 2 + 1/3
    const s = a.add(b);
    // compute expected: whole = 3, fractional = 1/2 + 1/3 = 5/6 -> 3 + 5/6
    expect(s.integer).toBe(3n);
    expect(s.numerator).toBe(5n);
    expect(s.denominator).toBe(6n);

    const sub = s.sub(new Epoch(1n, 5n, 6n));
    expect(sub.integer).toBe(2n);
    expect(sub.numerator).toBe(0n);
    expect(sub.denominator).toBe(1n);
  });

  it("toUnix estimates timestamp using a reference header", () => {
    const refEpoch = new Epoch(1n, 0n, 1n);
    // Provide a minimal shaped header for toUnix without using `any`.
    const refHeader: { epoch: Epoch; timestamp: bigint } = {
      epoch: refEpoch,
      timestamp: 1000n,
    };

    // target epoch is 2 + 1/2
    const target = new Epoch(2n, 1n, 2n);
    const delta = target.sub(refEpoch); // should be 1 + 1/2
    const expected =
      refHeader.timestamp +
      EPOCH_IN_MILLISECONDS * delta.integer +
      (EPOCH_IN_MILLISECONDS * delta.numerator) / delta.denominator;
    // Allow this single structural cast for the test harness.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    expect(target.toUnix(refHeader as any)).toBe(expected);
  });

  it("deprecated helpers epochFrom / epochFromHex / epochToHex", () => {
    const e = new Epoch(3n, 4n, 5n);
    expect(epochFrom(e)).toBe(e);

    const hex = epochToHex(e);
    expect(typeof hex).toBe("string");
    expect(hex.startsWith("0x")).toBe(true);

    const decoded = epochFromHex(hex);
    expect(decoded.integer).toBe(e.integer);
    expect(decoded.numerator).toBe(e.numerator);
    expect(decoded.denominator).toBe(e.denominator);
  });
});
