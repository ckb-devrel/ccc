import type { Connection, Libp2p } from "@libp2p/interface";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RelayConnectionController } from "./relayConnection.js";

function testConnection(
  id: string,
  status: Connection["status"] = "open",
): Connection {
  return {
    close: vi.fn(),
    id,
    status,
  } as unknown as Connection;
}

function createNode() {
  const target = new EventTarget();
  const dial = vi.fn();
  const node = Object.assign(target, { dial }) as unknown as Libp2p;
  return { dial, node, target };
}

describe("RelayConnectionController", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { visibilityState: "visible" });
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("window", new EventTarget());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("uses the A retry schedule until connected", async () => {
    vi.useFakeTimers();
    const connection = testConnection("relay");
    const { dial, node } = createNode();
    dial
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"))
      .mockRejectedValueOnce(new Error("third"))
      .mockRejectedValueOnce(new Error("fourth"))
      .mockResolvedValue(connection);
    const controller = new RelayConnectionController(node, ["/memory/1"]);
    const connected = controller.connect();

    await vi.advanceTimersByTimeAsync(0);
    expect(dial).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(dial).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(dial).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(dial).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(dial).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(1);

    await expect(connected).resolves.toBe(connection);
    expect(dial).toHaveBeenCalledTimes(5);
    await controller.stop();
  });

  it("tries each address and reconnects with the successful one", async () => {
    const first = testConnection("first");
    const second = testConnection("second");
    const { dial, node, target } = createNode();
    dial
      .mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const changes: Array<Connection | undefined> = [];
    const controller = new RelayConnectionController(
      node,
      ["/memory/1", "/memory/2"],
      {
        onConnectionChange: (connection) => changes.push(connection),
      },
    );

    await controller.connect();
    expect(
      dial.mock.calls.slice(0, 2).map(([address]) => String(address)),
    ).toEqual(["/memory/1", "/memory/2"]);
    target.dispatchEvent(
      new CustomEvent("connection:close", { detail: first }),
    );
    await vi.waitFor(() => expect(dial).toHaveBeenCalledTimes(3));

    expect(String(dial.mock.calls[2]?.[0])).toBe("/memory/2");
    expect(changes).toEqual([first, undefined, second]);
    await controller.stop();
  });

  it("continues when dial returns an already closed connection", async () => {
    const closed = testConnection("closed", "closed");
    const close = vi.spyOn(closed, "close");
    const open = testConnection("open");
    const { dial, node } = createNode();
    dial.mockResolvedValueOnce(closed).mockResolvedValueOnce(open);
    const controller = new RelayConnectionController(node, [
      "/memory/1",
      "/memory/2",
    ]);

    await expect(controller.connect()).resolves.toBe(open);
    expect(dial).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledOnce();

    await controller.stop();
  });
});
