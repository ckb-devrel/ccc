/**
 * 将十六进制字符串转换为十进制数字
 * @param hex 十六进制字符串，可以带0x前缀
 * @returns 十进制数字
 */
export function hexToDecimal(hex: string): number {
  // 移除0x前缀（如果存在）
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  // 使用parseInt将十六进制转换为十进制
  return parseInt(cleanHex, 16);
}

/**
 * 将十进制数字转换为十六进制字符串
 * @param decimal 十进制数字
 * @returns 带0x前缀的十六进制字符串
 */
export function decimalToHex(decimal: number): string {
  return `0x${decimal.toString(16)}`;
} 