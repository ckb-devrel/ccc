import { ccc } from "@ckb-ccc/core";
import type { Connection, PeerId, StreamHandler } from "@libp2p/interface";
import { lpStream, streamPair } from "@libp2p/utils";
import { describe, expect, it, vi } from "vitest";
import {
  jsonRpcService,
  type JsonRpcServiceComponents,
} from "./jsonRpcService.js";

const PROTOCOL = "/json-rpc/test/1.0.0";

function testPeerId(value: string): PeerId {
  return {
    equals: (other: PeerId) => other.toString() === value,
    toString: () => value,
  } as PeerId;
}

describe("JsonRpcService", () => {
  it("passes the stream connection to the request handler", async () => {
    let protocolHandler: StreamHandler | undefined;
    const components = {
      registrar: {
        handle: vi.fn(async (_protocol: string, handler: StreamHandler) => {
          protocolHandler = handler;
        }),
        unhandle: vi.fn(async () => {}),
      },
    } as unknown as JsonRpcServiceComponents;
    const connection = {
      remotePeer: testPeerId("remote"),
    } as Connection;
    const handleRequest = vi.fn(() => "result");
    const service = jsonRpcService(
      { protocol: PROTOCOL },
      handleRequest,
    )(components);
    await service.start();

    const [outbound, inbound] = await streamPair({ protocol: PROTOCOL });
    const handling = protocolHandler?.(inbound, connection);
    const rpcStream = lpStream(outbound);
    const payload: ccc.JsonRpcPayload = {
      id: 1,
      jsonrpc: "2.0",
      method: "test",
      params: [],
    };
    await rpcStream.write(ccc.bytesFrom(JSON.stringify(payload), "utf8"));
    await outbound.close();

    const response = JSON.parse(
      ccc.bytesTo((await rpcStream.read()).subarray(), "utf8"),
    ) as unknown;
    await outbound.closeRead();
    await handling;

    expect(response).toEqual({ id: 1, jsonrpc: "2.0", result: "result" });
    expect(handleRequest).toHaveBeenCalledWith({
      connection,
      payload,
      peerId: connection.remotePeer,
    });
  });
});
