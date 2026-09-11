import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  deferOpen: false,
  invalidResponse: false,
  sendError: undefined as Error | undefined,
  sockets: [] as {
    closeCalls: number;
    closed: boolean;
    open: () => void;
    sent: string[];
  }[],
}));

vi.mock("isomorphic-ws", () => {
  class WebSocket extends EventTarget {
    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSING = 2;
    readonly CLOSED = 3;
    readyState = this.CONNECTING;
    closeCalls = 0;
    closed = false;
    sent: string[] = [];
    onopen?: () => void;
    onclose?: () => void;
    onerror?: () => void;
    onmessage?: (event: { data: string }) => void;

    constructor(_url: string) {
      super();
      mock.sockets.push(this);
      if (!mock.deferOpen) {
        queueMicrotask(() => this.open());
      }
    }

    open() {
      this.readyState = this.OPEN;
      this.onopen?.();
    }

    send(data: string) {
      if (mock.sendError) {
        throw mock.sendError;
      }
      this.sent.push(data);
      const request = JSON.parse(data) as { id: string | number };
      queueMicrotask(() =>
        this.onmessage?.({
          data: mock.invalidResponse
            ? "{"
            : JSON.stringify({
                jsonrpc: "2.0",
                id: request.id,
                result: "ok",
              }),
        }),
      );
    }

    close() {
      this.closeCalls += 1;
      this.readyState = this.CLOSED;
      this.closed = true;
      this.onclose?.();
      this.dispatchEvent(new Event("close"));
    }
  }

  return { default: WebSocket };
});

import { JsonRpcTransportWebSocket } from "./webSocket.js";

describe("JsonRpcTransportWebSocket", () => {
  beforeEach(() => {
    mock.deferOpen = false;
    mock.invalidResponse = false;
    mock.sendError = undefined;
    mock.sockets.length = 0;
    vi.useRealTimers();
  });

  it("closes its socket", async () => {
    const owner = JsonRpcTransportWebSocket.open("ws://example.com");
    const transport = owner.value;
    await transport.request({
      id: 0,
      jsonrpc: "2.0",
      method: "test",
      params: [],
    });
    expect(mock.sockets).toHaveLength(1);
    expect(mock.sockets[0].closed).toBe(false);

    await owner.dispose();

    expect(mock.sockets[0].closed).toBe(true);
    expect(() => owner.value).toThrow(
      "Cannot access a moved or disposed Owner",
    );
  });

  it("does not reconnect through a stale borrow after disposal", async () => {
    const owner = JsonRpcTransportWebSocket.open("ws://example.com");
    const transport = owner.value;

    await owner.dispose();

    await expect(
      transport.request({
        id: 0,
        jsonrpc: "2.0",
        method: "test",
        params: [],
      }),
    ).rejects.toThrow("Cannot use a disposed JsonRpcTransportWebSocket");
    expect(mock.sockets).toHaveLength(0);
  });

  it("correlates responses with string IDs", async () => {
    const owner = JsonRpcTransportWebSocket.open("ws://example.com");
    const transport = owner.value;

    await expect(
      transport.request({
        id: "request-0",
        jsonrpc: "2.0",
        method: "test",
        params: [],
      }),
    ).resolves.toMatchObject({ id: "request-0", result: "ok" });

    await owner.dispose();
  });

  it("ignores invalid JSON until the request times out", async () => {
    vi.useFakeTimers();
    mock.invalidResponse = true;
    const owner = JsonRpcTransportWebSocket.open("ws://example.com", 100);
    const transport = owner.value;

    const request = expect(
      transport.request({
        id: 0,
        jsonrpc: "2.0",
        method: "test",
        params: [],
      }),
    ).rejects.toThrow("Request timeout");

    await vi.advanceTimersByTimeAsync(100);
    await request;

    expect(mock.sockets[0].closed).toBe(true);
    await owner.dispose();
  });

  it("cleans up the request timeout when send throws", async () => {
    vi.useFakeTimers();
    const error = new Error("send failed");
    mock.sendError = error;
    const owner = JsonRpcTransportWebSocket.open("ws://example.com", 100);
    const transport = owner.value;

    await expect(
      transport.request({
        id: 0,
        jsonrpc: "2.0",
        method: "test",
        params: [],
      }),
    ).rejects.toBe(error);

    await vi.advanceTimersByTimeAsync(100);

    expect(mock.sockets[0].closeCalls).toBe(0);
    await owner.dispose();
  });

  it("closes a connecting socket without sending after timeout", async () => {
    vi.useFakeTimers();
    mock.deferOpen = true;
    const owner = JsonRpcTransportWebSocket.open("ws://example.com", 100);
    const transport = owner.value;

    const request = expect(
      transport.request({
        id: 0,
        jsonrpc: "2.0",
        method: "test",
        params: [],
      }),
    ).rejects.toThrow("Request timeout");

    await vi.advanceTimersByTimeAsync(100);
    await request;

    expect(mock.sockets[0].closed).toBe(true);

    mock.sockets[0].open();
    await Promise.resolve();

    expect(mock.sockets[0].sent).toHaveLength(0);
    await owner.dispose();
  });
});
