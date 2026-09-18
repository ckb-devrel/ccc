import { afterEach, describe, expect, it, vi } from "vitest";
import { sleep } from "./index.js";

describe("sleep", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after the requested duration", async () => {
    vi.useFakeTimers();
    const sleeping = sleep(1_000);

    await vi.advanceTimersByTimeAsync(999);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);

    await expect(sleeping).resolves.toBeUndefined();
  });

  it("rejects immediately when already aborted", async () => {
    const controller = new AbortController();
    const reason = new Error("Cancelled");
    controller.abort(reason);

    await expect(sleep(1_000, controller.signal)).rejects.toBe(reason);
  });

  it("clears the pending timer when aborted", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const reason = new Error("Cancelled");
    const sleeping = sleep(1_000, controller.signal);
    const rejected = expect(sleeping).rejects.toBe(reason);

    controller.abort(reason);

    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
});
