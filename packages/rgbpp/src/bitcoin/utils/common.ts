import { OutPoint } from "@ckb-ccc/core";

import { UtxoSeal } from "../types/index.js";

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

export function trimHexPrefix(hex: string): string {
  return hex.startsWith("0x") ? hex.substring(2) : hex;
}

/**
 * Deduplicate UTXO seals based on txId and index
 */
export function deduplicateUtxoSeals(utxoSeals: UtxoSeal[]): UtxoSeal[] {
  if (!utxoSeals || utxoSeals.length === 0) {
    return [];
  }

  const seen = new Map<string, UtxoSeal>();

  for (const seal of utxoSeals) {
    const normalizedTxId = seal.txId?.toLowerCase() ?? "";
    const key = `${normalizedTxId}:${seal.index}`;

    if (!seen.has(key)) {
      seen.set(key, seal);
    }
  }

  return Array.from(seen.values());
}
