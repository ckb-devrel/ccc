export const trimHexPrefix = (hex: string): string =>
  hex.startsWith("0x") ? hex.substring(2) : hex;
