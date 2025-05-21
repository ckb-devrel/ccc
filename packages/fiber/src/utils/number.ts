import { fixedPointFrom, fixedPointToString } from "@ckb-ccc/core";

/**
 * 将u128类型的数字转换为十进制字符串
 * @param value - u128类型的数字（bigint或string）
 * @param decimals - 小数位数，默认为8
 * @returns 十进制字符串
 *
 * @example
 * ```typescript
 * const decimal = u128ToDecimal(123456789n); // 输出 "1.23456789"
 * const decimalWithDecimals = u128ToDecimal(123456789n, 6); // 输出 "123.456789"
 * ```
 */
export function u128ToDecimal(
  value: bigint | string,
  decimals: number = 8,
): string {
  return fixedPointToString(value, decimals);
}

/**
 * 将十进制字符串转换为u128类型
 * @param value - 十进制字符串
 * @param decimals - 小数位数，默认为8
 * @returns u128类型的数字（bigint）
 *
 * @example
 * ```typescript
 * const u128 = decimalToU128("1.23456789"); // 输出 123456789n
 * const u128WithDecimals = decimalToU128("123.456789", 6); // 输出 123456789n
 * ```
 */
export function decimalToU128(value: string, decimals: number = 8): bigint {
  return fixedPointFrom(value, decimals);
}

/**
 * 将十进制字符串转换为U64类型
 * @param value - 十进制字符串
 * @returns U64类型的数字（bigint）
 *
 * @example
 * ```typescript
 * const u64 = decimalToU64("1000"); // 输出 1000n
 * ```
 */
export function decimalToU64(value: string): bigint {
  return BigInt(value);
}

/**
 * 将U64类型的数字转换为十进制字符串
 * @param value - U64类型的数字（bigint或string）
 * @param isTimestamp - 是否为时间戳，如果是则直接返回十进制字符串
 * @returns 十进制字符串
 */
export function u64ToDecimal(
  value: bigint | string,
  isTimestamp: boolean = false,
): string {
  if (isTimestamp) {
    return value.toString();
  }
  return u128ToDecimal(value, 0);
}
