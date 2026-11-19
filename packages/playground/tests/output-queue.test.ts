import type { ccc } from "@ckb-ccc/ccc";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOutputQueue, type Messages } from "../src/app/outputQueue";
import { createOutputRun } from "../src/app/outputRun";
import { createOutputSessionGate } from "../src/app/outputSession";

describe("playground output batching", () => {
  const testnet = { addressPrefix: "ckt" } as ccc.Client;
  const mainnet = { addressPrefix: "ckb" } as ccc.Client;

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("publishes one ordered batch with the client and wallet mode at emission", () => {
    const publish = vi.fn<(batch: Messages) => void>();
    const queue = createOutputQueue(publish);

    const values = { count: 1 };
    queue.append(testnet, true, "info", "before", [values]);
    values.count = 2;
    vi.advanceTimersByTime(99);
    queue.append(mainnet, false, "error", "after", [values]);
    expect(publish).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(publish).toHaveBeenCalledExactlyOnceWith([
      ["info", "before", [{ count: 1 }], 1, testnet, true],
      ["error", "after", [{ count: 2 }], 2, mainnet, false],
    ]);
  });

  it("drops queued entries and their timeout without cancelling a run", () => {
    const publish = vi.fn<(batch: Messages) => void>();
    const queue = createOutputQueue(publish);
    const gate = createOutputSessionGate();
    const run = createOutputRun(gate, (level, title, values, origin) =>
      queue.append(testnet, false, level, title, values, origin),
    );

    run.log("info", "discard this", []);
    vi.advanceTimersByTime(50);
    queue.clear();
    run.log("info", "keep this", []);
    vi.advanceTimersByTime(50);
    expect(publish).not.toHaveBeenCalled();
    expect(run.isCurrent()).toBe(true);

    vi.advanceTimersByTime(50);
    expect(publish).toHaveBeenCalledExactlyOnceWith([
      ["info", "keep this", [], 2, testnet, false],
    ]);
  });

  it("keeps one terminal diagnostic from a superseded run with its original metadata", () => {
    const publish = vi.fn<(batch: Messages) => void>();
    const queue = createOutputQueue(publish);
    const gate = createOutputSessionGate();
    const oldRun = createOutputRun(gate, (level, title, values, origin) =>
      queue.append(testnet, true, level, title, values, origin),
    );
    gate.invalidate();
    const nextRun = createOutputRun(gate, (level, title, values, origin) =>
      queue.append(mainnet, false, level, title, values, origin),
    );

    oldRun.log("info", "ignore", []);
    oldRun.terminalError("original failure");
    oldRun.terminalError("duplicate");
    nextRun.log("info", "new", []);
    vi.advanceTimersByTime(100);

    expect(publish).toHaveBeenCalledExactlyOnceWith([
      [
        "error",
        "Execution failed after wallet/network changed",
        ["original failure"],
        1,
        testnet,
        true,
      ],
      ["info", "new", [], 2, mainnet, false],
    ]);
  });
});
