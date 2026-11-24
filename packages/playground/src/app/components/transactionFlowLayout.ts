export const TRANSACTION_DIVIDER_SPACE = 20;
export const TRANSACTION_MIN_COLUMN_WIDTH = 144;

/** Both sides remain visible; narrow containers prioritize equal usable widths. */
export function transactionSplitBounds(width: number): [number, number] {
  const usable = width - TRANSACTION_DIVIDER_SPACE;
  if (!Number.isFinite(usable) || usable <= 0) {
    return [50, 50];
  }
  const min = Math.min(
    50,
    Math.max(20, (TRANSACTION_MIN_COLUMN_WIDTH / usable) * 100),
  );
  return [min, 100 - min];
}
export function clampTransactionSplit(value: number, width: number): number {
  const [min, max] = transactionSplitBounds(width);
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 50));
}

/** Pointer x is relative to the flow's left edge and targets the gutter center. */
export function transactionSplitAtPointer(x: number, width: number): number {
  const usable = width - TRANSACTION_DIVIDER_SPACE;
  return clampTransactionSplit(
    ((x - TRANSACTION_DIVIDER_SPACE / 2) / usable) * 100,
    width,
  );
}
