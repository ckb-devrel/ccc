import { ccc } from "@ckb-ccc/core";
import type { Connection, PeerId, StreamHandler } from "@libp2p/interface";
import { lpStream, streamPair } from "@libp2p/utils";
import { describe, expect, it, vi } from "vitest";
import {
  jsonRpcService,
  type JsonRpcRequest,
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
    const handleRequest = vi.fn((_request: JsonRpcRequest) => "result");
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
    expect(service.timeout).toBe(30_000);
    expect(handleRequest).toHaveBeenCalledOnce();
    const request = handleRequest.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      connection,
      payload,
      peerId: connection.remotePeer,
    });
    expect(request?.signal).toBeInstanceOf(AbortSignal);
    expect(request?.signal.aborted).toBe(false);
  });

  it("aborts the request signal when the stream closes", async () => {
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
    let requestSignal: AbortSignal | undefined;
    let finishRequest: (() => void) | undefined;
    const requestCompletion = new Promise<void>((resolve) => {
      finishRequest = resolve;
    });
    const handleRequest = vi.fn(({ signal }: JsonRpcRequest) => {
      requestSignal = signal;
      return requestCompletion;
    });
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
    await vi.waitFor(() => expect(requestSignal).toBeDefined());

    outbound.abort(new Error("Client closed stream"));
    await handling;

    expect(requestSignal?.aborted).toBe(true);
    expect(requestSignal?.reason).toBeInstanceOf(Error);
    expect(requestSignal?.reason).toMatchObject({ name: "AbortError" });

    finishRequest?.();
    await requestCompletion;
  });

  it("aborts the request and stream when the service times out", async () => {
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
    let requestSignal: AbortSignal | undefined;
    let finishRequest: (() => void) | undefined;
    const requestCompletion = new Promise<void>((resolve) => {
      finishRequest = resolve;
    });
    const handleRequest = vi.fn(({ signal }: JsonRpcRequest) => {
      requestSignal = signal;
      return requestCompletion;
    });
    const service = jsonRpcService(
      { protocol: PROTOCOL, timeout: 20 },
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
    await handling;

    expect(service.timeout).toBe(20);
    expect(requestSignal?.aborted).toBe(true);
    expect(requestSignal?.reason).toMatchObject({ name: "TimeoutError" });
    expect(inbound.status).toBe("aborted");

    finishRequest?.();
    await requestCompletion;
  });
});
