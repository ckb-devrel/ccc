import { describe, expect, it, vi } from "vitest";
import { ClientPublicTestnet } from "../../client/index.js";
import { JsonRpcError, type JsonRpcPayload } from "../../jsonRpc/index.js";
import { SignerSignType, SignerType, type Signer } from "../signer/index.js";
import { buildSignerJsonRpcHandler } from "./index.js";
import { SignerJsonRpcTransformers } from "./transformers.js";

function payload(method: string, params: unknown[] = []): JsonRpcPayload {
  return { id: 0, jsonrpc: "2.0", method, params };
}

function mockSigner(overrides: Partial<Signer> = {}) {
  return {
    client: new ClientPublicTestnet(),
    connect: vi.fn(async () => {}),
    isConnected: vi.fn(async () => true),
    signType: SignerSignType.CkbSecp256k1,
    type: SignerType.CKB,
    ...overrides,
  } as unknown as Signer;
}

describe("buildSignerJsonRpcHandler", () => {
  it("returns signer information with application metadata", async () => {
    const signer = mockSigner();
    const handler = buildSignerJsonRpcHandler({
      connect: async () => signer,
      confirmRequest: async () => true,
      getSigner: () => signer,
      getSignerMetadata: () => ({ name: "Test wallet", icon: "test.svg" }),
    });

    expect(handler(payload("get_info"))).toEqual({
      type: SignerType.CKB,
      sign_type: SignerSignType.CkbSecp256k1,
      name: "Test wallet",
      icon: "test.svg",
    });
  });

  it("confirms and connects the requested network", async () => {
    const signerConnect = vi.fn(async () => {});
    const signer = mockSigner({ connect: signerConnect });
    const connect = vi.fn(async () => signer);
    const confirmRequest = vi.fn(async () => true);
    const handler = buildSignerJsonRpcHandler({
      connect,
      confirmRequest,
      getSigner: () => signer,
    });

    await expect(
      handler(payload("connect", ["ckb-testnet"])),
    ).resolves.toBeNull();
    expect(confirmRequest).toHaveBeenCalledWith({
      method: "connect",
      networkId: "ckb-testnet",
    });
    expect(connect).toHaveBeenCalledWith("ckb-testnet");
    expect(signerConnect).not.toHaveBeenCalled();
  });

  it("validates methods and parameters with JSON-RPC errors", async () => {
    const signer = mockSigner();
    const handler = buildSignerJsonRpcHandler({
      connect: async () => signer,
      confirmRequest: async () => true,
      getSigner: () => signer,
    });

    expect(() => handler(payload("unknown"))).toThrow(
      new JsonRpcError({
        code: -32601,
        message: "Unsupported method: unknown",
      }),
    );
    await expect(handler(payload("connect"))).rejects.toMatchObject({
      code: -32602,
    });
  });

  it("does not sign rejected requests", async () => {
    const message = Uint8Array.from([1, 2]);
    const signMessageRaw = vi.fn();
    const signer = mockSigner({ signMessageRaw });
    const confirmRequest = vi.fn(async () => false);
    const handler = buildSignerJsonRpcHandler({
      connect: async () => signer,
      confirmRequest,
      getSigner: () => signer,
    });

    const request = handler(
      payload("sign_message", [SignerJsonRpcTransformers.messageFrom(message)]),
    );

    await expect(request).rejects.toEqual(
      new JsonRpcError({
        code: -32003,
        message: "User rejected request",
      }),
    );
    expect(confirmRequest).toHaveBeenCalledWith({
      method: "sign_message",
      message: { type: "bytes", value: "0x0102" },
    });
    expect(signMessageRaw).not.toHaveBeenCalled();
  });
});
