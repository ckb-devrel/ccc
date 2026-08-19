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
      const request = JSON.parse(data) as { id: number };
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
    const transport = new JsonRpcTransportWebSocket("ws://example.com");
    await transport.request({
      id: 0,
      jsonrpc: "2.0",
      method: "test",
      params: [],
    });
    expect(mock.sockets).toHaveLength(1);
    expect(mock.sockets[0].closed).toBe(false);

    await transport.close();

    expect(mock.sockets[0].closed).toBe(true);
  });

  it("ignores invalid JSON until the request times out", async () => {
    vi.useFakeTimers();
    mock.invalidResponse = true;
    const transport = new JsonRpcTransportWebSocket("ws://example.com", 100);

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
  });

  it("cleans up the request timeout when send throws", async () => {
    vi.useFakeTimers();
    const error = new Error("send failed");
    mock.sendError = error;
    const transport = new JsonRpcTransportWebSocket("ws://example.com", 100);

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
  });

  it("closes a connecting socket without sending after timeout", async () => {
    vi.useFakeTimers();
    mock.deferOpen = true;
    const transport = new JsonRpcTransportWebSocket("ws://example.com", 100);

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
  });
});
