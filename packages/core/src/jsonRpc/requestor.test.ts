import { describe, expect, it, vi } from "vitest";
import { RequestorJsonRpc } from "./requestor.js";
import {
  JsonRpcPayload,
  JsonRpcResponse,
  JsonRpcTransport,
} from "./transports/index.js";

function response(payload: JsonRpcPayload, result: unknown): JsonRpcResponse {
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
    const transport: JsonRpcTransport = {
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
    const requestor = RequestorJsonRpc.new({
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
    const transport: JsonRpcTransport = {
      async request(payload) {
        calls += 1;
        if (calls === 1) {
          throw new Error("failed");
        }
        return response(payload, "ok");
      },
    };
    const requestor = RequestorJsonRpc.new({
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
    const transport: JsonRpcTransport = {
      async request(payload) {
        calls += 1;
        if (calls <= 2) {
          throw new Error(`failed ${calls}`);
        }
        return response(payload, payload.id);
      },
    };
    const requestor = RequestorJsonRpc.new({
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

  it("cancels a queued request without blocking later requests", async () => {
    let releaseFirst: (() => void) | undefined;
    const firstPending = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const calls: JsonRpcPayload[] = [];
    const transport: JsonRpcTransport = {
      async request(payload) {
        calls.push(payload);
        if (payload.id === 0) {
          await firstPending;
        }
        return response(payload, payload.id);
      },
    };
    const requestor = RequestorJsonRpc.new({
      maxConcurrent: 1,
      transport,
    });
    const controller = new AbortController();
    const reason = new Error("cancelled while queued");

    const first = requestor.requestPayload(requestor.buildPayload("test", []));
    const second = requestor.requestPayload(
      requestor.buildPayload("test", []),
      { signal: controller.signal },
    );
    const third = requestor.requestPayload(requestor.buildPayload("test", []));
    const secondRejected = expect(second).rejects.toBe(reason);

    controller.abort(reason);
    await secondRejected;
    expect(calls.map(({ id }) => id)).toEqual([0]);

    releaseFirst?.();
    await expect(Promise.all([first, third])).resolves.toEqual([0, 2]);
    expect(calls.map(({ id }) => id)).toEqual([0, 2]);
  });

  it("forwards a released slot when its queued request is cancelled", async () => {
    let resolveFirst: (response: JsonRpcResponse) => void = () => {};
    const firstPending = new Promise<JsonRpcResponse>((resolve) => {
      resolveFirst = resolve;
    });
    const calls: JsonRpcPayload[] = [];
    const transport: JsonRpcTransport = {
      request(payload) {
        calls.push(payload);
        return payload.id === 0
          ? firstPending
          : Promise.resolve(response(payload, payload.id));
      },
    };
    const requestor = RequestorJsonRpc.new({
      maxConcurrent: 1,
      transport,
    });
    const controller = new AbortController();
    const reason = new Error("cancelled while receiving a slot");
    const firstPayload = requestor.buildPayload("test", []);

    const first = requestor.requestPayload(firstPayload);
    const second = requestor.requestPayload(
      requestor.buildPayload("test", []),
      { signal: controller.signal },
    );
    const third = requestor.requestPayload(requestor.buildPayload("test", []));
    const secondRejected = expect(second).rejects.toBe(reason);

    resolveFirst(response(firstPayload, firstPayload.id));
    controller.abort(reason);

    await secondRejected;
    await vi.waitFor(() => expect(calls.map(({ id }) => id)).toEqual([0, 2]));
    await expect(Promise.all([first, third])).resolves.toEqual([0, 2]);
  });

  it("disposes default transports owned by an opened Requestor", async () => {
    const owner = RequestorJsonRpc.open({ urls: ["ws://example.com"] });
    const requestor = owner.value;

    await owner.dispose();

    await expect(
      requestor.requestPayload(requestor.buildPayload("test", [])),
    ).rejects.toThrow("Cannot use a disposed JsonRpcTransportWebSocket");
  });
});
