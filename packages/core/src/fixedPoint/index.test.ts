import { describe, expect, test } from "vitest";
import { fixedPointFrom, fixedPointToString } from "./index.js";

describe("fixedPointToString", () => {
  const cases: [bigint, string, number?][] = [
    [0n, "0"],
    [1n, "0.00000001"],
    [100000000n, "1"],
    [1000000000n, "10"],
    [1010100000n, "10.101"],
    [11n, "1.1", 1],
    [0n, "0", 1],
    [1n, "1", 0],
    [0n, "0", 0],
  ];

  cases.forEach(([i, o, decimals]) =>
    test(`${i} with ${decimals ?? "default"} decimals = "${o}"`, () => {
      expect(fixedPointToString(i, decimals)).toBe(o);
    }),
  );
});

describe("fixedPointFrom string", () => {
  const cases: [string, bigint, number?][] = [
    ["0", 0n],
    ["0.00000001", 1n],
    ["1", 100000000n],
    ["10", 1000000000n],
    ["10.101", 1010100000n],
    ["1.1", 11n, 1],
    ["0", 0n, 1],
    ["1", 1n, 0],
    ["0", 0n, 0],
  ];

  cases.forEach(([i, o, decimals]) =>
    test(`"${i}" = ${o} with ${decimals ?? "default"} decimals `, () => {
      expect(fixedPointFrom(i, decimals)).toBe(o);
    }),
  );
});

describe("fixedPointFrom number", () => {
  const cases: [number, bigint, number?][] = [
    [0.00000001, 1n],
    [10.101, 1010100000n],
    [1.1, 11n, 1],
  ];

  cases.forEach(([i, o, decimals]) =>
    test(`${i} = ${o} with ${decimals ?? "default"} decimals `, () => {
      expect(fixedPointFrom(i, decimals)).toBe(o);
    }),
  );
});
