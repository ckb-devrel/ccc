import { ccc } from "@ckb-ccc/core";
import { describe, expect, it } from "vitest";
import {
  argsToDid,
  base32Decode,
  base32Encode,
  didToArgs,
  isDidCkb,
} from "./identifier.js";

describe("base32", () => {
  it("round-trips known vectors", () => {
    const cases: [string, string][] = [
      ["", ""],
      ["f", "my"],
      ["fo", "mzxq"],
      ["foo", "mzxw6"],
      ["foob", "mzxw6yq"],
      ["fooba", "mzxw6ytb"],
      ["foobar", "mzxw6ytboi"],
    ];
    for (const [input, expected] of cases) {
      const bytes = new TextEncoder().encode(input);
      expect(base32Encode(bytes)).toBe(expected);
      expect(new TextDecoder().decode(base32Decode(expected))).toBe(input);
    }
  });

  it("rejects invalid characters", () => {
    expect(() => base32Decode("!!!")).toThrow(/Invalid base32 character/);
  });

  it("accepts hex input via ccc.bytesFrom", () => {
    expect(base32Encode("0xdeadbeef")).toBe(
      base32Encode(ccc.bytesFrom("0xdeadbeef")),
    );
  });
});

describe("did:ckb identifier", () => {
  // 20 zero bytes -> 32 'a's
  const zeros = "0x" + "00".repeat(20);
  const zerosDid = "did:ckb:" + "a".repeat(32);

  it("converts args <-> did", () => {
    expect(argsToDid(zeros)).toBe(zerosDid);
    expect(didToArgs(zerosDid)).toBe(zeros);
  });

  it("rejects args with wrong length", () => {
    expect(() => argsToDid("0x" + "00".repeat(19))).toThrow();
    expect(() => argsToDid("0x" + "00".repeat(21))).toThrow();
  });

  it("rejects did without prefix", () => {
    expect(() => didToArgs("ckb:" + "a".repeat(32))).toThrow();
  });

  it("rejects did with wrong body length", () => {
    expect(() => didToArgs("did:ckb:" + "a".repeat(31))).toThrow();
    expect(() => didToArgs("did:ckb:" + "a".repeat(33))).toThrow();
  });

  it("isDidCkb is true only for well-formed values", () => {
    expect(isDidCkb(zerosDid)).toBe(true);
    expect(isDidCkb("did:plc:xyz")).toBe(false);
    expect(isDidCkb("did:ckb:tooShort")).toBe(false);
    expect(isDidCkb("did:ckb:" + "!".repeat(32))).toBe(false);
  });

  it("round-trips a random-looking args vector", () => {
    const args = "0x0123456789abcdef0123456789abcdef01234567";
    const did = argsToDid(args);
    expect(did.startsWith("did:ckb:")).toBe(true);
    expect(did.length).toBe("did:ckb:".length + 32);
    expect(didToArgs(did)).toBe(args);
  });
});
