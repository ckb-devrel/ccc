import { afterEach, describe, expect, it, vi } from "vitest";
import { TransportHttp } from "./http.js";
import type { JsonRpcPayload, JsonRpcResponse } from "./transport.js";

const payload: JsonRpcPayload = {
  id: 0,
  jsonrpc: "2.0",
  method: "test",
  params: [],
};
const response: JsonRpcResponse = {
  id: 0,
  jsonrpc: "2.0",
  result: "ok",
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("TransportHttp", () => {
  it("clears its timeout after a successful response", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ json: async () => response })),
    );

    await expect(
      new TransportHttp("https://example.com").request(payload),
    ).resolves.toEqual(response);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its timeout when fetch rejects", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("unavailable"))),
    );

    await expect(
      new TransportHttp("https://example.com").request(payload),
    ).rejects.toThrow("unavailable");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its timeout when response parsing rejects", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => Promise.reject(new Error("invalid JSON")),
      })),
    );

    await expect(
      new TransportHttp("https://example.com").request(payload),
    ).rejects.toThrow("invalid JSON");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts a request when its timeout expires", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new Error("aborted")),
            );
          }),
      ),
    );

    const request = new TransportHttp("https://example.com", 1000).request(
      payload,
    );
    const rejection = expect(request).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(1000);

    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });
});
