import { ccc } from "@ckb-ccc/core";

/** Convert u128-like value to decimal string (default 8 decimals). */
export function u128ToDecimal(value: bigint | string, decimals = 8): string {
  return ccc.fixedPointToString(value, decimals);
}

/** Convert decimal string to u128 bigint (default 8 decimals). */
export function decimalToU128(value: string, decimals = 8): bigint {
  return ccc.fixedPointFrom(value, decimals);
}

/** Convert decimal string to u64 bigint. */
export function decimalToU64(value: string): bigint {
  return BigInt(value);
}

/** Convert u64-like value to decimal string; if isTimestamp, return as plain string. */
export function u64ToDecimal(
  value: bigint | string,
  isTimestamp = false,
): string {
  return isTimestamp ? value.toString() : u128ToDecimal(value, 0);
}
