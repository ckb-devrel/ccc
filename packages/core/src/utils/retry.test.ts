import { afterEach, describe, expect, it, vi } from "vitest";
import { retry } from "./index.js";

describe("retry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses each delay before retrying", async () => {
    vi.useFakeTimers();
    const indexes: number[] = [];
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"))
      .mockResolvedValue("done");
    const retried = retry([100, 200], async ({ index, resolve }) => {
      indexes.push(index);
      return resolve(await operation());
    });

    await vi.advanceTimersByTimeAsync(299);
    expect(operation).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);

    await expect(retried).resolves.toBe("done");
    expect(operation).toHaveBeenCalledTimes(3);
    expect(indexes).toEqual([0, 1, 2]);
  });

  it("stops when the operation rejects the error", async () => {
    vi.useFakeTimers();
    const cause = new Error("stop");
    const operation = vi.fn();

    await expect(
      retry<never>([100], ({ reject }) => {
        operation();
        return reject(cause);
      }),
    ).rejects.toBe(cause);
    expect(operation).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retries when requested without throwing", async () => {
    vi.useFakeTimers();
    const operation = vi.fn();
    const retried = retry([100], ({ resolve, next }) => {
      operation();
      return operation.mock.calls.length === 1 ? next() : resolve("done");
    });

    await vi.advanceTimersByTimeAsync(99);
    expect(operation).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);

    await expect(retried).resolves.toBe("done");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("retries forever with an infinite delay iterable", async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"))
      .mockResolvedValue("done");
    const delays = (function* () {
      while (true) yield 100;
    })();
    const retried = retry(delays, async ({ resolve }) =>
      resolve(await operation()),
    );

    await vi.advanceTimersByTimeAsync(200);

    await expect(retried).resolves.toBe("done");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("stops when its delay iterable is exhausted", async () => {
    vi.useFakeTimers();
    const cause = new Error("stop");
    const delays = (function* () {
      yield 100;
    })();
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(cause);
    const retried = retry(delays, async ({ resolve }) =>
      resolve(await operation()),
    );
    const expected = expect(retried).rejects.toBe(cause);

    await vi.advanceTimersByTimeAsync(100);

    await expected;
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("repeats with a fixed delay after its delay iterable is exhausted", async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"))
      .mockRejectedValueOnce(new Error("third"))
      .mockResolvedValue("done");
    const retried = retry(
      [100, 200],
      async ({ resolve }) => resolve(await operation()),
      { repeat: 300 },
    );

    await vi.advanceTimersByTimeAsync(599);
    expect(operation).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);

    await expect(retried).resolves.toBe("done");
    expect(operation).toHaveBeenCalledTimes(4);
  });

  it("repeats an empty delay iterable when configured", async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("first"))
      .mockResolvedValue("done");
    const retried = retry(
      [],
      async ({ resolve }) => resolve(await operation()),
      {
        repeat: 100,
      },
    );

    await vi.advanceTimersByTimeAsync(100);

    await expect(retried).resolves.toBe("done");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("accepts any iterable of delays", async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("first"))
      .mockResolvedValue("done");
    const retried = retry(new Set([100]), async ({ resolve }) =>
      resolve(await operation()),
    );

    await vi.advanceTimersByTimeAsync(100);

    await expect(retried).resolves.toBe("done");
  });
});
