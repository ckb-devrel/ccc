import type { Connection, PeerId } from "@libp2p/interface";
import { multiaddr } from "@multiformats/multiaddr";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KhieConnectionController } from "./connection.js";
import type { KhieNode } from "./node.js";

const RELAY_PEER_ID = "12D3KooWQwLwBK3EaCaJQNL9KBUvPi9Vh3gZqPfLQVi7aZpHkF3S";
const PAIRED_PEER_ID = "12D3KooWJZQ7ypYJ6LHVYbNcKZX7HxV5pnPHJHvJ7zH2Bf6WmDKm";
const STORED_RELAY_ADDRESS = multiaddr(
  `/dns4/relay.ckbccc.com/tcp/443/wss/p2p/${RELAY_PEER_ID}/p2p-circuit`,
);
const STORED_WEBRTC_ADDRESS = STORED_RELAY_ADDRESS.encapsulate("/webrtc");

function testPeerId(value: string): PeerId {
  return {
    equals: (other: PeerId) => other.toString() === value,
    toString: () => value,
  } as PeerId;
}

function testConnection(direct: boolean): Connection {
  return { direct, status: "open" } as Connection;
}

function createNode(initialConnections = [testConnection(false)]) {
  const target = new EventTarget();
  const dial = vi.fn().mockRejectedValue(new Error("Unavailable"));
  const refresh = vi.fn();
  const getConnections = vi.fn(() => initialConnections);
  const getPeer = vi.fn().mockResolvedValue({
    addresses: [
      { isCertified: false, multiaddr: STORED_RELAY_ADDRESS },
      { isCertified: false, multiaddr: STORED_WEBRTC_ADDRESS },
    ],
  });
  const node = Object.assign(target, {
    dial,
    getConnections,
    peerStore: { get: getPeer },
    services: { pairing: { refresh } },
  }) as unknown as KhieNode;

  return { dial, getConnections, getPeer, node, refresh, target };
}

function dispatchPeerEvent(target: EventTarget, peerId: PeerId) {
  target.dispatchEvent(new CustomEvent("peer:disconnect", { detail: peerId }));
}

describe("KhieConnectionController", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("starts reconnecting when constructed without an open connection", async () => {
    vi.useFakeTimers();
    const peerId = testPeerId(PAIRED_PEER_ID);
    const { dial, node, refresh } = createNode([]);
    const controller = new KhieConnectionController(node, peerId);

    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledWith(peerId);
    expect(dial).toHaveBeenCalledOnce();

    controller.stop();
  });

  it("retries a disconnected paired peer with bounded backoff", async () => {
    vi.useFakeTimers();
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const peerId = testPeerId(PAIRED_PEER_ID);
    const { dial, node, refresh, target } = createNode([]);
    const controller = new KhieConnectionController(node, peerId);

    dispatchPeerEvent(target, peerId);
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledWith(peerId);
    expect(dial).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(4_999);
    expect(dial).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(dial).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(dial).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(dial).toHaveBeenCalledTimes(4);
    expect(timeout).toHaveBeenCalledTimes(4);
    expect(timeout).toHaveBeenCalledWith(10_000);
    for (const [, options] of dial.mock.calls) {
      expect(options).not.toHaveProperty("force");
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }

    controller.stop();
  });

  it("restarts retries when the paired peer disconnects again", async () => {
    vi.useFakeTimers();
    const peerId = testPeerId(PAIRED_PEER_ID);
    const { dial, node, target } = createNode([]);
    const controller = new KhieConnectionController(node, peerId);

    dispatchPeerEvent(target, peerId);
    await vi.advanceTimersByTimeAsync(0);
    expect(dial).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(4_999);
    dispatchPeerEvent(target, peerId);
    await vi.advanceTimersByTimeAsync(0);
    expect(dial).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1);
    expect(dial).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(dial).toHaveBeenCalledTimes(3);

    controller.stop();
  });

  it("stops retrying when a direct connection becomes available", async () => {
    vi.useFakeTimers();
    const peerId = testPeerId(PAIRED_PEER_ID);
    const { dial, getConnections, node, target } = createNode([]);
    const controller = new KhieConnectionController(node, peerId);

    dispatchPeerEvent(target, peerId);
    await vi.advanceTimersByTimeAsync(0);
    expect(dial).toHaveBeenCalledOnce();

    getConnections.mockReturnValue([testConnection(true)]);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(dial).toHaveBeenCalledOnce();

    controller.stop();
  });

  it("dials known addresses to restore a direct connection", async () => {
    vi.useFakeTimers();
    const peerId = testPeerId(PAIRED_PEER_ID);
    const { dial, getConnections, node, refresh, target } = createNode([]);
    const directConnection = testConnection(true);
    dial.mockImplementationOnce(async () => {
      getConnections.mockReturnValue([directConnection]);
      return directConnection;
    });
    const controller = new KhieConnectionController(node, peerId);

    dispatchPeerEvent(target, peerId);
    await vi.advanceTimersByTimeAsync(0);

    expect(refresh).toHaveBeenCalledWith(peerId);
    expect(dial).toHaveBeenCalledOnce();
    const [addresses, options] = (
      dial.mock.calls as unknown as Array<
        [unknown, { force?: unknown; signal?: unknown }]
      >
    )[0] ?? [undefined, {}];
    expect(addresses).toEqual([
      STORED_RELAY_ADDRESS.encapsulate(`/p2p/${PAIRED_PEER_ID}`),
      STORED_WEBRTC_ADDRESS.encapsulate(`/p2p/${PAIRED_PEER_ID}`),
    ]);
    expect(options).not.toHaveProperty("force");
    expect(options.signal).toBeInstanceOf(AbortSignal);

    controller.stop();
  });

  it("retries a direct upgrade while a relayed connection remains open", async () => {
    vi.useFakeTimers();
    const peerId = testPeerId(PAIRED_PEER_ID);
    const { dial, node } = createNode();
    const controller = new KhieConnectionController(node, peerId);

    await vi.advanceTimersByTimeAsync(0);
    expect(dial).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(5_000);
    expect(dial).toHaveBeenCalledTimes(2);

    controller.stop();
  });

  it("starts a fresh reconnect when the page becomes visible", async () => {
    vi.useFakeTimers();
    let visibilityState: DocumentVisibilityState = "hidden";
    const documentTarget = new EventTarget();
    Object.defineProperty(documentTarget, "visibilityState", {
      get: () => visibilityState,
    });
    vi.stubGlobal("document", documentTarget);
    const peerId = testPeerId(PAIRED_PEER_ID);
    const { dial, getConnections, node } = createNode([testConnection(true)]);
    const controller = new KhieConnectionController(node, peerId);
    await vi.advanceTimersByTimeAsync(0);
    expect(dial).not.toHaveBeenCalled();

    getConnections.mockReturnValue([]);
    visibilityState = "visible";
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(dial).toHaveBeenCalledOnce();

    controller.stop();
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(40_000);
    expect(dial).toHaveBeenCalledOnce();
  });

  it("ignores events for another peer and stops observing", async () => {
    vi.useFakeTimers();
    const peerId = testPeerId(PAIRED_PEER_ID);
    const otherPeer = testPeerId("other");
    const { dial, node, refresh, target } = createNode([testConnection(true)]);
    const controller = new KhieConnectionController(node, peerId);
    await vi.advanceTimersByTimeAsync(0);
    vi.clearAllMocks();

    dispatchPeerEvent(target, otherPeer);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(refresh).not.toHaveBeenCalled();
    expect(dial).not.toHaveBeenCalled();

    controller.stop();
    dispatchPeerEvent(target, peerId);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(dial).not.toHaveBeenCalled();
  });
});
