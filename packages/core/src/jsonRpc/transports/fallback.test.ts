import { describe, expect, it, vi } from "vitest";
import { TransportFallback } from "./fallback.js";
import { JsonRpcPayload, JsonRpcResponse, Transport } from "./transport.js";

const payload: JsonRpcPayload = {
  id: 0,
  jsonrpc: "2.0",
  method: "test",
  params: [],
};
const response: JsonRpcResponse = {
  id: payload.id,
  jsonrpc: "2.0",
  result: "ok",
};

function makeTransport(handler: () => Promise<JsonRpcResponse>): Transport {
  return { request: () => handler(), async close() {} };
}

describe("TransportFallback", () => {
  it("closes every transport", async () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    const transport = new TransportFallback([
      { request: async () => response, close: closeA },
      { request: async () => response, close: closeB },
    ]);

    await transport.close();

    expect(closeA).toHaveBeenCalledOnce();
    expect(closeB).toHaveBeenCalledOnce();
  });

  it("starts closing every transport when one close throws synchronously", async () => {
    const error = new Error("close failed");
    const closeA = vi.fn(() => {
      throw error;
    });
    const closeB = vi.fn(async () => {});
    const transport = new TransportFallback([
      { request: async () => response, close: closeA },
      { request: async () => response, close: closeB },
    ]);

    await expect(transport.close()).rejects.toBe(error);

    expect(closeA).toHaveBeenCalledOnce();
    expect(closeB).toHaveBeenCalledOnce();
  });

  it("returns result from the first healthy transport", async () => {
    const transport = new TransportFallback([
      makeTransport(() => Promise.resolve(response)),
    ]);
    expect(await transport.request(payload)).toBe(response);
  });

  it("falls back to the next transport when the first fails", async () => {
    const transport = new TransportFallback([
      makeTransport(() => Promise.reject(new Error("fail"))),
      makeTransport(() => Promise.resolve(response)),
    ]);
    expect(await transport.request(payload)).toBe(response);
  });

  it("throws when all transports fail", async () => {
    const transport = new TransportFallback([
      makeTransport(() => Promise.reject(new Error("fail A"))),
      makeTransport(() => Promise.reject(new Error("fail B"))),
    ]);
    await expect(transport.request(payload)).rejects.toThrow("fail B");
  });

  it("concurrent requests both succeed when the first transport is down", async () => {
    // Transport A is always unavailable; transport B always succeeds.
    // Two concurrent requests should each fall back to B independently.
    const transport = new TransportFallback([
      makeTransport(() => Promise.reject(new Error("A unavailable"))),
      makeTransport(() => Promise.resolve(response)),
    ]);

    const results = await Promise.allSettled([
      transport.request(payload),
      transport.request(payload),
    ]);

    expect(results[0]).toMatchObject({
      status: "fulfilled",
      value: response,
    });
    expect(results[1]).toMatchObject({
      status: "fulfilled",
      value: response,
    });
  });

  it("advances the starting transport after failures so future requests skip known-bad transports", async () => {
    let callsToA = 0;
    let callsToB = 0;

    const transport = new TransportFallback([
      makeTransport(() => {
        callsToA += 1;
        return Promise.reject(new Error("A unavailable"));
      }),
      makeTransport(() => {
        callsToB += 1;
        return Promise.resolve(response);
      }),
    ]);

    // First request: tries A (fails), then B (succeeds)
    await transport.request(payload);
    expect(callsToA).toBe(1);
    expect(callsToB).toBe(1);

    // Second request: should start from B (since A was the last known failure)
    await transport.request(payload);
    expect(callsToA).toBe(1);
    expect(callsToB).toBe(2);
  });
});
