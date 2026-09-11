import { ccc } from "@ckb-ccc/core";
import type { Connection, Libp2p, PeerId } from "@libp2p/interface";
import { lpStream, streamPair } from "@libp2p/utils";
import { describe, expect, it, vi } from "vitest";
import { JsonRpcTransportLibp2p } from "./jsonRpcTransport.js";

const PROTOCOL = "/json-rpc/test/1.0.0";

function testPeerId(value: string): PeerId {
  return {
    equals: (other: PeerId) => other.toString() === value,
    toString: () => value,
  } as PeerId;
}

describe("JsonRpcTransportLibp2p", () => {
  it("keeps the remaining connections as fallbacks", async () => {
    const peerId = testPeerId("remote");
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
    const dialProtocol = vi.fn();
    const node = {
      dialProtocol,
      getConnections: () => [preferred, fallback],
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
      dialProtocol: vi.fn(),
      getConnections: () => [first, second],
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
