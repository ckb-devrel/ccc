import { ccc } from "@ckb-ccc/core";
import { describe, expect, it } from "vitest";
import {
  NATIVE_MUTANT_CODE_MAX_SIZE,
  NATIVE_MUTANT_CODE_MIN_SIZE,
  buildMutantArgs,
  checkNativeMutantCode,
  getMutantIds,
  withMutants,
} from "./index.js";

/** Minimal header accepted by the native Mutant extension contract. */
function elfHeader(size: number, eType = 2, eMachine = 243): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01], 0);
  bytes[16] = eType & 0xff;
  bytes[17] = (eType >> 8) & 0xff;
  bytes[18] = eMachine & 0xff;
  bytes[19] = (eMachine >> 8) & 0xff;
  return bytes;
}

describe("checkNativeMutantCode", () => {
  it("accepts a well-formed RISC-V executable ELF", () => {
    const code = elfHeader(NATIVE_MUTANT_CODE_MIN_SIZE);
    expect(checkNativeMutantCode(code)).toEqual(code);
    expect(checkNativeMutantCode(ccc.hexFrom(code))).toEqual(code);
  });

  it("accepts the maximum size", () => {
    expect(() =>
      checkNativeMutantCode(elfHeader(NATIVE_MUTANT_CODE_MAX_SIZE)),
    ).not.toThrow();
  });

  it("rejects undersized and oversized code", () => {
    expect(() =>
      checkNativeMutantCode(elfHeader(NATIVE_MUTANT_CODE_MIN_SIZE - 1)),
    ).toThrow(/bytes/);
    expect(() =>
      checkNativeMutantCode(elfHeader(NATIVE_MUTANT_CODE_MAX_SIZE + 1)),
    ).toThrow(/bytes/);
  });

  it("rejects non-ELF and wrong ELF layouts", () => {
    expect(() => checkNativeMutantCode(new Uint8Array(128))).toThrow(/ELF/);
    expect(() => checkNativeMutantCode(elfHeader(128, 3))).toThrow(/ET_EXEC/);
    expect(() => checkNativeMutantCode(elfHeader(128, 2, 62))).toThrow(
      /RISC-V/,
    );
    expect(() => checkNativeMutantCode(elfHeader(128, 2, 0xf3))).not.toThrow();
  });
});

describe("buildMutantArgs", () => {
  const id = "0x" + "ab".repeat(32);

  it("builds a bare 32-byte ID", () => {
    expect(ccc.bytesFrom(buildMutantArgs(id)).length).toBe(32);
  });

  it("appends an 8-byte little-endian payment", () => {
    const args = buildMutantArgs(id, 0x0102030405060708n);
    const bytes = ccc.bytesFrom(args);
    expect(bytes.length).toBe(40);
    expect(bytes[32]).toBe(0x08);
    expect(bytes[39]).toBe(0x01);
  });

  it("rejects IDs of other lengths", () => {
    expect(() => buildMutantArgs("0x1234")).toThrow(/32 bytes/);
  });
});

describe("contentType mutant[] parameter", () => {
  const ids = ["0x" + "0a".repeat(32), "0x" + "ff".repeat(32)];

  it("round-trips IDs", () => {
    const contentType = withMutants("application/x.equipment", ids);
    expect(contentType).toBe(
      `application/x.equipment;mutant[]=${"0a".repeat(32)},${"ff".repeat(32)}`,
    );
    expect(getMutantIds(contentType)).toEqual(ids);
  });

  it("keeps other parameters", () => {
    expect(
      getMutantIds(withMutants("multipart/mixed;boundary=abc", [ids[0]])),
    ).toEqual([ids[0]]);
  });

  it("returns empty when no mutant[] is present", () => {
    expect(getMutantIds("text/plain")).toEqual([]);
  });

  it("rejects duplicates and empty ID lists on build", () => {
    expect(() => withMutants("text/plain;mutant[]=x", ids)).toThrow(/already/);
    expect(() => withMutants("text/plain", [])).toThrow(/At least one/);
  });

  it("rejects malformed IDs on parse", () => {
    expect(() =>
      getMutantIds("text/plain;mutant[]=0x" + "0a".repeat(32)),
    ).toThrow(/Invalid Mutant ID/);
    expect(() => getMutantIds("text/plain;mutant[]=0a0a")).toThrow(
      /Invalid Mutant ID/,
    );
    expect(() =>
      getMutantIds("text/plain;mutant[]=zz" + "0a".repeat(31)),
    ).toThrow(/Invalid Mutant ID/);
  });
});
