import { OutPoint } from "@ckb-ccc/core";

export function deduplicateByOutPoint<T extends { outPoint: OutPoint }>(
  items: T[],
): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.outPoint.txHash}-${item.outPoint.index.toString()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Domain validation utility
/**
 * Check if target string is a valid domain.
 * @exmaple
 * isDomain('google.com') // => true
 * isDomain('https://google.com') // => false
 * isDomain('localhost') // => false
 * isDomain('localhost', true) // => true
 */
export function isDomain(domain: string, allowLocalhost?: boolean): boolean {
  if (allowLocalhost && domain === "localhost") {
    return true;
  }
  const regex = /^(?:[-A-Za-z0-9]+\.)+[A-Za-z]{2,}$/;
  return regex.test(domain);
}

export const trimHexPrefix = (hex: string): string =>
  hex.startsWith("0x") ? hex.substring(2) : hex;
