import { describe, expect, it } from "vitest";
import {
  clampTransactionSplit,
  TRANSACTION_DIVIDER_SPACE,
  TRANSACTION_MIN_COLUMN_WIDTH,
  transactionSplitAtPointer,
  transactionSplitBounds,
} from "../src/app/components/transactionFlowLayout";

describe("transaction-only splitter limits", () => {
  it("uses the 20px gutter center consistently for pointer geometry", () => {
    expect(TRANSACTION_DIVIDER_SPACE).toBe(20);
    expect(transactionSplitAtPointer(400, 800)).toBe(50);
    expect(transactionSplitAtPointer(10 + (800 - 20) * 0.7, 800)).toBe(70);
    expect(transactionSplitAtPointer(-100, 800)).toBe(
      transactionSplitBounds(800)[0],
    );
    expect(transactionSplitAtPointer(900, 800)).toBe(
      transactionSplitBounds(800)[1],
    );
    expect(transactionSplitAtPointer(0, 0)).toBe(50);
  });
  it.each([400, 600, 900, 1200])(
    "keeps both columns at least 144px at width %s",
    (width) => {
      const [min, max] = transactionSplitBounds(width);
      const usable = width - TRANSACTION_DIVIDER_SPACE;
      expect((min / 100) * usable).toBeGreaterThanOrEqual(
        TRANSACTION_MIN_COLUMN_WIDTH - 0.001,
      );
      expect(((100 - max) / 100) * usable).toBeGreaterThanOrEqual(
        TRANSACTION_MIN_COLUMN_WIDTH - 0.001,
      );
      expect(clampTransactionSplit(-10, width)).toBe(min);
      expect(clampTransactionSplit(110, width)).toBe(max);
    },
  );
  it("keeps both sides present when the parent pane is narrower than the preferred minimum", () => {
    expect(transactionSplitBounds(260)).toEqual([50, 50]);
    expect(clampTransactionSplit(90, 260)).toBe(50);
  });
  it("uses equal widths before measurement and handles invalid coordinates safely", () => {
    expect(transactionSplitBounds(0)).toEqual([50, 50]);
    expect(transactionSplitBounds(NaN)).toEqual([50, 50]);
    expect(clampTransactionSplit(NaN, 800)).toBe(50);
  });
  it("restores the requested ratio when more container width becomes available", () => {
    expect(clampTransactionSplit(70, 300)).toBe(50);
    expect(clampTransactionSplit(70, 1000)).toBe(70);
  });
});
