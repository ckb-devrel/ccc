import { Hex, hexFrom } from "@ckb-ccc/shell";

export const trimHexPrefix = (hex: string): string =>
  hex.startsWith("0x") ? hex.substring(2) : hex;

export const prependHexPrefix = (hex: string): Hex =>
  (hex.startsWith("0x") ? hex : `0x${hex}`) as Hex;

export const u8ToHex = (u8: number): Hex => {
  if (u8 < 0 || u8 > 255 || !Number.isInteger(u8)) {
    throw new Error("Input must be an integer between 0 and 255");
  }
  return prependHexPrefix(u8.toString(16).padStart(2, "0"));
};

export const u32ToHex = (u32: string | number, littleEndian = false): Hex => {
  const num = Number(u32);
  if (num < 0 || num > 0xffffffff || !Number.isInteger(num)) {
    throw new Error("Input must be an unsigned 32-bit integer");
  }

  const hex = num.toString(16).padStart(8, "0");
  return littleEndian ? reverseHexByteOrder(hex as Hex) : prependHexPrefix(hex);
};

export const utf8ToHex = (text: string): Hex => {
  let result = text.trim();
  if (result.startsWith("0x")) {
    return result as Hex;
  }
  return hexFrom(new TextEncoder().encode(result));
};

export const reverseHexByteOrder = (hex: Hex): Hex => {
  const trimmed = trimHexPrefix(hex);
  const pairs = trimmed.match(/.{2}/g) || [];
  return prependHexPrefix(pairs.reverse().join(""));
};

export const u128ToLe = (u128: bigint): string => {
  if (u128 < 0n || u128 > 0xffffffffffffffffffffffffffffffffn) {
    throw new Error("Input must be an unsigned 128-bit integer");
  }

  const buffer = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    buffer[i] = Number((u128 >> BigInt(i * 8)) & 0xffn);
  }

  return buffer.toString("hex");
};

export function leToU128(le: string): bigint {
  const trimmedLe = trimHexPrefix(le);
  if (!/^[0-9a-fA-F]+$/.test(trimmedLe)) {
    throw new Error("Input must be a valid hex string");
  }
  const paddedLe = trimmedLe.padStart(32, "0");

  const beHex = paddedLe.match(/.{2}/g)?.reverse().join("") || "";
  return BigInt(`0x${beHex}`);
}

export const u64ToLe = (u64: bigint): string => {
  if (u64 < 0n || u64 > 0xffffffffffffffffn) {
    throw new Error("Input must be an unsigned 64-bit integer");
  }

  const buffer = Buffer.alloc(8);
  for (let i = 0; i < 8; i++) {
    buffer[i] = Number((u64 >> BigInt(i * 8)) & 0xffn);
  }

  return buffer.toString("hex");
};

export const u32ToLe = (u32: number): string => {
  if (u32 < 0 || u32 > 0xffffffff || !Number.isInteger(u32)) {
    throw new Error("Input must be an unsigned 32-bit integer");
  }

  const buffer = Buffer.alloc(4);
  for (let i = 0; i < 4; i++) {
    buffer[i] = (u32 >> (i * 8)) & 0xff;
  }

  return buffer.toString("hex");
};
