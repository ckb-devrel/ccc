import { describe, expect, it } from "vitest";
import { JsonRpcTransportFallback } from "./fallback.js";
import {
  JsonRpcPayload,
  JsonRpcResponse,
  JsonRpcTransport,
} from "./transport.js";

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

function makeTransport(
  handler: () => Promise<JsonRpcResponse>,
): JsonRpcTransport {
  return { request: () => handler() };
}

describe("JsonRpcTransportFallback", () => {
  it("returns result from the first healthy transport", async () => {
    const transport = new JsonRpcTransportFallback([
      makeTransport(() => Promise.resolve(response)),
    ]);
    expect(await transport.request(payload)).toBe(response);
  });

  it("falls back to the next transport when the first fails", async () => {
    const transport = new JsonRpcTransportFallback([
      makeTransport(() => Promise.reject(new Error("fail"))),
      makeTransport(() => Promise.resolve(response)),
    ]);
    expect(await transport.request(payload)).toBe(response);
  });

  it("throws when all transports fail", async () => {
    const transport = new JsonRpcTransportFallback([
      makeTransport(() => Promise.reject(new Error("fail A"))),
      makeTransport(() => Promise.reject(new Error("fail B"))),
    ]);
    await expect(transport.request(payload)).rejects.toThrow("fail B");
  });

  it("concurrent requests both succeed when the first transport is down", async () => {
    // Transport A is always unavailable; transport B always succeeds.
    // Two concurrent requests should each fall back to B independently.
    const transport = new JsonRpcTransportFallback([
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

    const transport = new JsonRpcTransportFallback([
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
