import { beforeEach, describe, expect, it, vi } from "vitest";

const { FakeWebSocket } = vi.hoisted(() => {
  class FakeWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    static readonly instances: FakeWebSocket[] = [];

    readonly close = vi.fn(() => {
      this.readyState = FakeWebSocket.CLOSING;
      this.readyState = FakeWebSocket.CLOSED;
      this.onclose?.();
    });
    readonly send = vi.fn();
    readonly OPEN = FakeWebSocket.OPEN;
    readonly CLOSING = FakeWebSocket.CLOSING;
    readonly CLOSED = FakeWebSocket.CLOSED;
    readyState = FakeWebSocket.CONNECTING;
    onclose?: () => void;
    onerror?: () => void;
    onmessage?: (event: { data: string }) => void;
    onopen?: () => void;

    constructor(readonly url: string) {
      FakeWebSocket.instances.push(this);
    }

    open() {
      this.readyState = FakeWebSocket.OPEN;
      this.onopen?.();
    }

    message(data: string) {
      this.onmessage?.({ data });
    }
  }

  return { FakeWebSocket };
});

vi.mock("isomorphic-ws", () => ({ default: FakeWebSocket }));

import { TransportWebSocket } from "./webSocket.js";

describe("TransportWebSocket", () => {
  beforeEach(() => {
    FakeWebSocket.instances.length = 0;
  });

  it("closes the socket after all pending requests complete", async () => {
    const transport = new TransportWebSocket("ws://example.test");
    const first = transport.request({
      id: 0,
      jsonrpc: "2.0",
      method: "first",
      params: [],
    });
    const socket = FakeWebSocket.instances[0];
    socket.open();

    await vi.waitFor(() => expect(socket.send).toHaveBeenCalledTimes(1));

    const second = transport.request({
      id: 1,
      jsonrpc: "2.0",
      method: "second",
      params: [],
    });
    await vi.waitFor(() => expect(socket.send).toHaveBeenCalledTimes(2));

    socket.message(JSON.stringify({ id: 0, result: "first" }));
    await expect(first).resolves.toEqual({ id: 0, result: "first" });
    expect(socket.close).not.toHaveBeenCalled();

    socket.message(JSON.stringify({ id: 1, result: "second" }));
    await expect(second).resolves.toEqual({ id: 1, result: "second" });
    expect(socket.close).toHaveBeenCalledOnce();
  });
});
