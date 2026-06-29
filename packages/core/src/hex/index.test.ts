import { describe, expect, test } from "vitest";
import { bytesLen, bytesLenUnsafe, hexFrom } from "./index.js";

describe("hexFrom", () => {
  const cases: [string, Parameters<typeof hexFrom>[0], string][] = [
    ["normalized hex", "0x1234", "0x1234"],
    ["empty hex", "0x", "0x"],
    ["odd-length prefixed hex", "0x123", "0x0123"],
    ["hex without prefix", "1234", "0x1234"],
    ["odd-length hex without prefix", "123", "0x0123"],
    ["uppercase hex", "0xABCD", "0xabcd"],
    ["Uint8Array", new Uint8Array([0x12, 0x34]), "0x1234"],
    ["ArrayBuffer", new Uint8Array([0x12, 0x34, 0x56]).buffer, "0x123456"],
    ["number array", [0x12, 0x34, 0x56], "0x123456"],
  ];

  cases.forEach(([name, input, expected]) =>
    test(`returns ${expected} for ${name}`, () => {
      expect(hexFrom(input)).toBe(expected);
    }),
  );

  test("throws for invalid hex string", () => {
    expect(() => hexFrom("0xzz")).toThrow("Invalid bytes 0xzz");
  });

  test("throws for invalid byte values", () => {
    expect(() => hexFrom([256])).toThrow("Invalid bytes [256]");
  });
});

describe("bytesLen", () => {
  const cases: [string, Parameters<typeof bytesLen>[0], number][] = [
    ["normalized hex", "0x1234", 2],
    ["empty hex", "0x", 0],
    ["odd-length hex", "0x123", 2],
    ["hex without prefix", "123", 2],
    ["uppercase hex", "0xABCD", 2],
    ["Uint8Array", new Uint8Array([1, 2, 3]), 3],
    ["ArrayBuffer", new Uint8Array([1, 2, 3, 4]).buffer, 4],
    ["number array", [1, 2, 3, 4, 5], 5],
  ];

  cases.forEach(([name, input, expected]) =>
    test(`returns ${expected} for ${name}`, () => {
      expect(bytesLen(input)).toBe(expected);
    }),
  );

  test("throws for invalid hex string", () => {
    expect(() => bytesLen("0xzz")).toThrow("Invalid bytes 0xzz");
  });

  test("throws for invalid byte values", () => {
    expect(() => bytesLen([256])).toThrow("Invalid bytes [256]");
  });
});

describe("bytesLenUnsafe", () => {
  const cases: [string, `0x${string}`, number][] = [
    ["empty hex", "0x", 0],
    ["even-length hex", "0x1234", 2],
    ["odd-length hex", "0x123", 2],
  ];

  cases.forEach(([name, input, expected]) =>
    test(`returns ${expected} for ${name}`, () => {
      expect(bytesLenUnsafe(input)).toBe(expected);
    }),
  );
});
