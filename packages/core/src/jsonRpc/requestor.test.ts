import { describe, expect, it, vi } from "vitest";
import { RequestorJsonRpc } from "./requestor.js";
import { JsonRpcPayload, Transport } from "./transports/advanced.js";

function response(payload: JsonRpcPayload, result: unknown) {
  return {
    jsonrpc: "2.0",
    id: payload.id,
    result,
  };
}

describe("RequestorJsonRpc", () => {
  it("advances the queue after a successful request", async () => {
    let releaseFirst: (() => void) | undefined;
    const firstPending = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let active = 0;
    let maxActive = 0;
    const transport: Transport = {
      async request(payload) {
        active += 1;
        maxActive = Math.max(maxActive, active);
        if (payload.id === 0) {
          await firstPending;
        }
        active -= 1;
        return response(payload, payload.id);
      },
    };
    const requestor = new RequestorJsonRpc("", {
      maxConcurrent: 1,
      transport,
    });

    const first = requestor.requestPayload(requestor.buildPayload("test", []));
    const second = requestor.requestPayload(requestor.buildPayload("test", []));

    expect(active).toBe(1);
    releaseFirst?.();
    await expect(Promise.all([first, second])).resolves.toEqual([0, 1]);
    expect(maxActive).toBe(1);
  });

  it("advances the queue after a transport error", async () => {
    let calls = 0;
    const transport: Transport = {
      async request(payload) {
        calls += 1;
        if (calls === 1) {
          throw new Error("failed");
        }
        return response(payload, "ok");
      },
    };
    const requestor = new RequestorJsonRpc("", {
      maxConcurrent: 1,
      transport,
    });

    const first = requestor
      .requestPayload(requestor.buildPayload("test", []))
      .catch((error: unknown) => error);
    const second = requestor.requestPayload(requestor.buildPayload("test", []));

    await vi.waitFor(() => expect(calls).toBe(2));
    expect(await first).toEqual(new Error("failed"));
    await expect(second).resolves.toBe("ok");
  });

  it("does not exhaust a larger concurrency limit after transport errors", async () => {
    let calls = 0;
    const transport: Transport = {
      async request(payload) {
        calls += 1;
        if (calls <= 2) {
          throw new Error(`failed ${calls}`);
        }
        return response(payload, payload.id);
      },
    };
    const requestor = new RequestorJsonRpc("", {
      maxConcurrent: 2,
      transport,
    });

    const results = Promise.allSettled(
      Array.from({ length: 4 }, () =>
        requestor.requestPayload(requestor.buildPayload("test", [])),
      ),
    );

    await vi.waitFor(() => expect(calls).toBe(4));
    await expect(results).resolves.toMatchObject([
      { status: "rejected" },
      { status: "rejected" },
      { status: "fulfilled", value: 2 },
      { status: "fulfilled", value: 3 },
    ]);
  });
});
