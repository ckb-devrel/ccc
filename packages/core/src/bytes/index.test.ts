import { describe, expect, it } from "vitest";
import { bytesFrom, bytesTo } from "./index.js";

describe("bytes", () => {
  it("encodes and decodes UTF-8", () => {
    const value = "Hello, 世界";

    expect(bytesTo(bytesFrom(value, "utf8"), "utf8")).toBe(value);
  });

  it("encodes and decodes Base64", () => {
    const bytes = Uint8Array.from([0xfb, 0xff]);

    expect(bytesTo(bytes, "base64")).toBe("+/8=");
    expect(bytesFrom("+/8=", "base64")).toEqual(bytes);
  });

  it("encodes and decodes unpadded Base64URL", () => {
    const bytes = Uint8Array.from([0xfb, 0xff]);

    expect(bytesTo(bytes, "base64url")).toBe("-_8");
    expect(bytesFrom("-_8", "base64url")).toEqual(bytes);
    expect(bytesFrom("+/8=", "base64url")).toEqual(bytes);
  });

  it("preserves hexadecimal input behavior", () => {
    expect(bytesFrom("abc")).toEqual(Uint8Array.from([0x0a, 0xbc]));
    expect(bytesFrom("abc", "hex")).toEqual(Uint8Array.from([0x0a, 0xbc]));
    expect(bytesFrom("0xabc", "hex")).toEqual(Uint8Array.from([0x0a, 0xbc]));
    expect(bytesFrom("ABcd")).toEqual(Uint8Array.from([0xab, 0xcd]));
    expect(() => bytesFrom("xyz")).toThrow();
    expect(() => bytesFrom("abzz", "hex")).toThrow();
  });
});
