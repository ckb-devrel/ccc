import { ccc } from "@ckb-ccc/core";
import type { Connection, Libp2p, PeerId } from "@libp2p/interface";
import { lpStream, streamPair } from "@libp2p/utils";
import { multiaddr } from "@multiformats/multiaddr";
import { describe, expect, it, vi } from "vitest";
import { JsonRpcTransportLibp2p } from "./jsonRpcTransport.js";

const PROTOCOL = "/json-rpc/test/1.0.0";
const RELAY_PEER_ID = "12D3KooWQwLwBK3EaCaJQNL9KBUvPi9Vh3gZqPfLQVi7aZpHkF3S";
const REMOTE_PEER_ID = "12D3KooWJZQ7ypYJ6LHVYbNcKZX7HxV5pnPHJHvJ7zH2Bf6WmDKm";
const STORED_RELAY_ADDRESS = multiaddr(
  `/dns4/relay.ckbccc.com/tcp/443/wss/p2p/${RELAY_PEER_ID}/p2p-circuit`,
);
const STORED_WEBRTC_ADDRESS = multiaddr(
  `/dns4/relay.ckbccc.com/tcp/443/wss/p2p/${RELAY_PEER_ID}/p2p-circuit/webrtc`,
);
const RELAY_ADDRESS = STORED_RELAY_ADDRESS.encapsulate(
  `/p2p/${REMOTE_PEER_ID}`,
);
const WEBRTC_ADDRESS = STORED_WEBRTC_ADDRESS.encapsulate(
  `/p2p/${REMOTE_PEER_ID}`,
);

function testPeerId(value: string): PeerId {
  return {
    equals: (other: PeerId) => other.toString() === value,
    toString: () => value,
  } as PeerId;
}

describe("JsonRpcTransportLibp2p", () => {
  it("keeps the remaining connections as fallbacks", async () => {
    const peerId = testPeerId(REMOTE_PEER_ID);
    const preferredNewStream = vi
      .fn()
      .mockRejectedValue(new Error("Unavailable"));
    const preferredClose = vi.fn();
    const preferred = {
      close: preferredClose,
      newStream: preferredNewStream,
      remotePeer: peerId,
      status: "open",
    } as unknown as Connection;
    const fallbackNewStream = vi.fn(async () => {
      const [outbound, inbound] = await streamPair({ protocol: PROTOCOL });
      void respond(inbound, "fallback");
      return outbound;
    });
    const fallbackClose = vi.fn();
    const fallback = {
      close: fallbackClose,
      newStream: fallbackNewStream,
      remotePeer: peerId,
      status: "open",
    } as unknown as Connection;
    const dial = vi.fn().mockRejectedValue(new Error("Unavailable"));
    const dialProtocol = vi.fn();
    const node = {
      dial,
      dialProtocol,
      getConnections: () => [preferred, fallback],
      peerStore: {
        get: vi.fn().mockResolvedValue({
          addresses: [
            { isCertified: false, multiaddr: STORED_RELAY_ADDRESS },
            { isCertified: false, multiaddr: STORED_WEBRTC_ADDRESS },
          ],
        }),
      },
    } as unknown as Libp2p;
    const transport = new JsonRpcTransportLibp2p(node, peerId, {
      protocol: PROTOCOL,
    });

    await expect(
      transport.request({
        id: 1,
        jsonrpc: "2.0",
        method: "test",
        params: [],
      }),
    ).resolves.toEqual({ id: 1, jsonrpc: "2.0", result: "fallback" });

    expect(preferredNewStream).toHaveBeenCalledOnce();
    expect(fallbackNewStream).toHaveBeenCalledOnce();
    expect(preferredClose).not.toHaveBeenCalled();
    expect(fallbackClose).not.toHaveBeenCalled();
    expect(dialProtocol).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(dial).toHaveBeenCalledWith([RELAY_ADDRESS, WEBRTC_ADDRESS]),
    );
  });

  it("does not wait for the opportunistic dial before using relay", async () => {
    const peerId = testPeerId(REMOTE_PEER_ID);
    const connection = {
      direct: false,
      newStream: vi.fn(() => responseStream("relay")),
      remotePeer: peerId,
      status: "open",
    } as unknown as Connection;
    const dial = vi.fn(() => new Promise<Connection>(() => {}));
    const node = {
      dial,
      dialProtocol: vi.fn(),
      getConnections: () => [connection],
      peerStore: {
        get: vi.fn().mockResolvedValue({
          addresses: [
            { isCertified: false, multiaddr: STORED_RELAY_ADDRESS },
            { isCertified: false, multiaddr: STORED_WEBRTC_ADDRESS },
          ],
        }),
      },
    } as unknown as Libp2p;
    const transport = new JsonRpcTransportLibp2p(node, peerId, {
      protocol: PROTOCOL,
    });

    await expect(
      transport.request({
        id: 1,
        jsonrpc: "2.0",
        method: "test",
        params: [],
      }),
    ).resolves.toEqual({ id: 1, jsonrpc: "2.0", result: "relay" });

    await vi.waitFor(() =>
      expect(dial).toHaveBeenCalledWith([RELAY_ADDRESS, WEBRTC_ADDRESS]),
    );
  });

  it("falls back to dialProtocol after existing streams fail", async () => {
    const peerId = testPeerId("remote");
    const connection = {
      newStream: vi.fn().mockRejectedValue(new Error("Unavailable")),
      remotePeer: peerId,
      status: "open",
    } as unknown as Connection;
    const dialProtocol = vi.fn((..._args: unknown[]) =>
      responseStream("dialed"),
    );
    const node = {
      dial: vi.fn().mockRejectedValue(new Error("Unavailable")),
      dialProtocol,
      getConnections: () => [connection],
      peerStore: {
        get: vi.fn().mockResolvedValue({ addresses: [] }),
      },
    } as unknown as Libp2p;
    const transport = new JsonRpcTransportLibp2p(node, peerId, {
      protocol: PROTOCOL,
    });

    await expect(
      transport.request({
        id: 1,
        jsonrpc: "2.0",
        method: "test",
        params: [],
      }),
    ).resolves.toEqual({ id: 1, jsonrpc: "2.0", result: "dialed" });

    expect(dialProtocol).toHaveBeenCalledOnce();
    const [dialedPeer, protocol, options] = dialProtocol.mock.calls[0] ?? [];
    expect(dialedPeer).toBe(peerId);
    expect(protocol).toBe(PROTOCOL);
    expect(options).toMatchObject({ runOnLimitedConnection: true });
    expect(
      (options as { signal?: unknown } | undefined)?.signal,
    ).toBeInstanceOf(AbortSignal);
    expect(options).not.toHaveProperty("force");
  });

  it("prefers the relayed connection with lower RTT", async () => {
    const peerId = testPeerId("remote");
    const firstNewStream = vi.fn(() => responseStream("first"));
    const secondNewStream = vi.fn(() => responseStream("second"));
    const first = {
      direct: false,
      id: "first",
      newStream: firstNewStream,
      remotePeer: peerId,
      rtt: 100,
      status: "open",
    } as unknown as Connection;
    const second = {
      direct: false,
      id: "second",
      newStream: secondNewStream,
      remotePeer: peerId,
      rtt: 20,
      status: "open",
    } as unknown as Connection;
    const node = {
      dial: vi.fn().mockRejectedValue(new Error("Unavailable")),
      dialProtocol: vi.fn(),
      getConnections: () => [first, second],
      peerStore: {
        get: vi.fn().mockResolvedValue({ addresses: [] }),
      },
    } as unknown as Libp2p;
    const transport = new JsonRpcTransportLibp2p(node, peerId, {
      protocol: PROTOCOL,
    });

    await expect(
      transport.request({
        id: 1,
        jsonrpc: "2.0",
        method: "test",
        params: [],
      }),
    ).resolves.toEqual({ id: 1, jsonrpc: "2.0", result: "second" });

    expect(secondNewStream).toHaveBeenCalledOnce();
    expect(firstNewStream).not.toHaveBeenCalled();
  });
});

async function responseStream(result: unknown) {
  const [outbound, inbound] = await streamPair({ protocol: PROTOCOL });
  void respond(inbound, result);
  return outbound;
}

async function respond(
  stream: Awaited<ReturnType<typeof streamPair>>[number],
  result: unknown,
) {
  const rpcStream = lpStream(stream);
  const payload = JSON.parse(
    ccc.bytesTo((await rpcStream.read()).subarray(), "utf8"),
  ) as ccc.JsonRpcPayload;
  await rpcStream.write(
    ccc.bytesFrom(
      JSON.stringify({ id: payload.id, jsonrpc: "2.0", result }),
      "utf8",
    ),
  );
  await stream.close();
}
