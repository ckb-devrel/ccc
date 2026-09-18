import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  deferOpen: false,
  deferResponse: false,
  invalidResponse: false,
  sendError: undefined as Error | undefined,
  sockets: [] as {
    closeCalls: number;
    closed: boolean;
    open: () => void;
    respond: (id: string | number) => void;
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
      if (!mock.deferResponse) {
        queueMicrotask(() => this.respond(request.id));
      }
    }

    respond(id: string | number) {
      this.onmessage?.({
        data: mock.invalidResponse
          ? "{"
          : JSON.stringify({ jsonrpc: "2.0", id, result: "ok" }),
      });
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
    mock.deferResponse = false;
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

  it("keeps the socket open after a timeout while another request is pending", async () => {
    vi.useFakeTimers();
    mock.deferResponse = true;
    const owner = JsonRpcTransportWebSocket.open("ws://example.com");
    const first = expect(
      owner.value.request(
        { id: 0, jsonrpc: "2.0", method: "first", params: [] },
        { timeout: 100 },
      ),
    ).rejects.toThrow("Request timeout");
    const second = owner.value.request(
      { id: 1, jsonrpc: "2.0", method: "second", params: [] },
      { timeout: 20_000 },
    );

    await vi.advanceTimersByTimeAsync(100);
    await first;

    expect(mock.sockets[0].closed).toBe(false);
    mock.sockets[0].respond(1);
    await expect(second).resolves.toMatchObject({ id: 1, result: "ok" });
    await owner.dispose();
  });

  it("keeps a connecting socket open for another pending request", async () => {
    vi.useFakeTimers();
    mock.deferOpen = true;
    mock.deferResponse = true;
    const owner = JsonRpcTransportWebSocket.open("ws://example.com");
    const first = expect(
      owner.value.request(
        { id: 0, jsonrpc: "2.0", method: "first", params: [] },
        { timeout: 100 },
      ),
    ).rejects.toThrow("Request timeout");
    const second = owner.value.request(
      { id: 1, jsonrpc: "2.0", method: "second", params: [] },
      { timeout: 20_000 },
    );

    await vi.advanceTimersByTimeAsync(100);
    await first;
    expect(mock.sockets[0].closed).toBe(false);

    mock.sockets[0].open();
    await Promise.resolve();
    mock.sockets[0].respond(1);
    await expect(second).resolves.toMatchObject({ id: 1, result: "ok" });
    await owner.dispose();
  });

  it("closes the socket after ten seconds without a successful response", async () => {
    vi.useFakeTimers();
    mock.deferResponse = true;
    const owner = JsonRpcTransportWebSocket.open("ws://example.com");
    const first = expect(
      owner.value.request(
        { id: 0, jsonrpc: "2.0", method: "first", params: [] },
        { timeout: 100 },
      ),
    ).rejects.toThrow("Request timeout");
    const second = expect(
      owner.value.request(
        { id: 1, jsonrpc: "2.0", method: "second", params: [] },
        { timeout: 10_100 },
      ),
    ).rejects.toThrow("Request timeout");
    const third = expect(
      owner.value.request(
        { id: 2, jsonrpc: "2.0", method: "third", params: [] },
        { timeout: 20_000 },
      ),
    ).rejects.toThrow("Connection closed");

    await vi.advanceTimersByTimeAsync(100);
    await first;
    expect(mock.sockets[0].closed).toBe(false);

    await vi.advanceTimersByTimeAsync(10_000);
    await Promise.all([second, third]);
    expect(mock.sockets[0].closed).toBe(true);
    await owner.dispose();
  });

  it("resets the timeout window when a response arrives", async () => {
    vi.useFakeTimers();
    mock.deferResponse = true;
    const owner = JsonRpcTransportWebSocket.open("ws://example.com");
    const first = expect(
      owner.value.request(
        { id: 0, jsonrpc: "2.0", method: "first", params: [] },
        { timeout: 100 },
      ),
    ).rejects.toThrow("Request timeout");
    const pending = owner.value.request(
      { id: 1, jsonrpc: "2.0", method: "pending", params: [] },
      { timeout: 20_000 },
    );

    await vi.advanceTimersByTimeAsync(100);
    await first;
    mock.sockets[0].respond(0);
    await vi.advanceTimersByTimeAsync(10_000);

    const later = expect(
      owner.value.request(
        { id: 2, jsonrpc: "2.0", method: "later", params: [] },
        { timeout: 100 },
      ),
    ).rejects.toThrow("Request timeout");
    await vi.advanceTimersByTimeAsync(100);
    await later;

    expect(mock.sockets[0].closed).toBe(false);
    mock.sockets[0].respond(1);
    await expect(pending).resolves.toMatchObject({ id: 1, result: "ok" });
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

  it("does not open a socket for an already aborted request", async () => {
    const owner = JsonRpcTransportWebSocket.open("ws://example.com");
    const controller = new AbortController();
    const error = new Error("canceled");
    controller.abort(error);

    await expect(
      owner.value.request(
        { id: 0, jsonrpc: "2.0", method: "test", params: [] },
        { signal: controller.signal },
      ),
    ).rejects.toBe(error);
    expect(mock.sockets).toHaveLength(0);

    await owner.dispose();
  });

  it("does not send a request aborted before the socket opens", async () => {
    mock.deferOpen = true;
    const owner = JsonRpcTransportWebSocket.open("ws://example.com");
    const controller = new AbortController();
    const error = new Error("canceled");
    const request = owner.value.request(
      { id: 0, jsonrpc: "2.0", method: "test", params: [] },
      { signal: controller.signal },
    );

    controller.abort(error);
    await expect(request).rejects.toBe(error);

    mock.sockets[0].open();
    await Promise.resolve();
    expect(mock.sockets[0].sent).toHaveLength(0);

    await owner.dispose();
  });

  it("rejects with an error when abort has no explicit reason", async () => {
    mock.deferOpen = true;
    const owner = JsonRpcTransportWebSocket.open("ws://example.com");
    const controller = new AbortController();
    const request = owner.value.request(
      { id: 0, jsonrpc: "2.0", method: "test", params: [] },
      { signal: controller.signal },
    );

    controller.abort();

    await expect(request).rejects.toBeInstanceOf(Error);
    await owner.dispose();
  });

  it("keeps concurrent requests alive when one is aborted", async () => {
    mock.deferResponse = true;
    const owner = JsonRpcTransportWebSocket.open("ws://example.com");
    const controller = new AbortController();
    const error = new Error("canceled");
    const first = owner.value.request(
      { id: 0, jsonrpc: "2.0", method: "first", params: [] },
      { signal: controller.signal },
    );
    const second = owner.value.request({
      id: 1,
      jsonrpc: "2.0",
      method: "second",
      params: [],
    });
    await Promise.resolve();

    controller.abort(error);
    mock.sockets[0].respond(1);

    await expect(first).rejects.toBe(error);
    await expect(second).resolves.toMatchObject({ id: 1, result: "ok" });
    expect(mock.sockets[0].closed).toBe(false);

    await owner.dispose();
  });

  it("ignores a late abort after the request has completed", async () => {
    const owner = JsonRpcTransportWebSocket.open("ws://example.com");
    const controller = new AbortController();

    await owner.value.request(
      { id: 0, jsonrpc: "2.0", method: "first", params: [] },
      { signal: controller.signal },
    );

    mock.deferResponse = true;
    const second = owner.value.request({
      id: 0,
      jsonrpc: "2.0",
      method: "second",
      params: [],
    });
    await Promise.resolve();

    controller.abort(new Error("late abort"));
    mock.sockets[0].respond(0);

    await expect(second).resolves.toMatchObject({ id: 0, result: "ok" });
    await owner.dispose();
  });
});
