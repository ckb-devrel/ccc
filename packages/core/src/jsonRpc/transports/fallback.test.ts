import { describe, expect, it } from "vitest";
import { TransportFallback } from "./fallback.js";
import { JsonRpcPayload, Transport } from "./transport.js";

const payload: JsonRpcPayload = {
  id: 0,
  jsonrpc: "2.0",
  method: "test",
  params: [],
};

function makeTransport(handler: () => Promise<unknown>): Transport {
  return { request: () => handler() };
}

describe("TransportFallback", () => {
  it("returns result from the first healthy transport", async () => {
    const transport = new TransportFallback([
      makeTransport(() => Promise.resolve("ok")),
    ]);
    expect(await transport.request(payload)).toBe("ok");
  });

  it("falls back to the next transport when the first fails", async () => {
    const transport = new TransportFallback([
      makeTransport(() => Promise.reject(new Error("fail"))),
      makeTransport(() => Promise.resolve("ok")),
    ]);
    expect(await transport.request(payload)).toBe("ok");
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
      makeTransport(() => Promise.resolve("ok")),
    ]);

    const results = await Promise.allSettled([
      transport.request(payload),
      transport.request(payload),
    ]);

    expect(results[0]).toMatchObject({ status: "fulfilled", value: "ok" });
    expect(results[1]).toMatchObject({ status: "fulfilled", value: "ok" });
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
        return Promise.resolve("ok");
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
