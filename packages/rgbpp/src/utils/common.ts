import { OutPoint } from "@ckb-ccc/shell";

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
