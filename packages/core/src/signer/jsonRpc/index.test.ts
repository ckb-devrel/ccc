import { describe, expect, it, vi } from "vitest";
import { ClientPublicTestnet } from "../../client/index.js";
import {
  JsonRpcPayload,
  JsonRpcResponse,
  JsonRpcTransport,
} from "../../jsonRpc/index.js";
import { SignerSignType, SignerType } from "../signer/index.js";
import { SignerJsonRpc } from "./index.js";
import { SignerJsonRpcTransformers } from "./transformers.js";

function response(payload: JsonRpcPayload, result: unknown): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id: payload.id,
    result,
  };
}

describe("SignerJsonRpc", () => {
  it("serializes signer info with snake-case keys", () => {
    expect(
      SignerJsonRpcTransformers.infoFrom({
        type: SignerType.CKB,
        signType: SignerSignType.CkbSecp256k1,
        name: "Test wallet",
      }),
    ).toEqual({
      type: SignerType.CKB,
      sign_type: SignerSignType.CkbSecp256k1,
      name: "Test wallet",
    });
  });

  it("loads info before explicitly connecting", async () => {
    const client = new ClientPublicTestnet();
    const requests: Array<[string, unknown]> = [];
    const transport: JsonRpcTransport = {
      async request(payload) {
        requests.push([payload.method, payload.params]);
        if (payload.method === "connect") {
          return response(payload, null);
        }

        return response(payload, {
          type: SignerType.CKB,
          sign_type: SignerSignType.CkbSecp256k1,
          name: "Test wallet",
          icon: "https://example.com/icon.png",
        });
      },
    };
    const signer = await SignerJsonRpc.new(client, { transport });

    expect(requests).toEqual([["get_info", []]]);
    await expect(signer.isConnected()).resolves.toBe(false);
    expect(signer.name).toBe("Test wallet");
    expect(signer.icon).toBe("https://example.com/icon.png");

    await signer.connect();

    expect(requests).toEqual([
      ["get_info", []],
      ["connect", [client.addressPrefix]],
    ]);
    await expect(signer.isConnected()).resolves.toBe(true);
  });

  it("shares concurrent connect requests", async () => {
    let resolveConnect = () => {};
    const connectPending = new Promise<void>((resolve) => {
      resolveConnect = resolve;
    });
    let connectRequests = 0;
    const transport: JsonRpcTransport = {
      async request(payload) {
        if (payload.method === "connect") {
          connectRequests += 1;
          await connectPending;
          return response(payload, null);
        }

        return response(payload, {
          type: SignerType.CKB,
          sign_type: SignerSignType.CkbSecp256k1,
        });
      },
    };
    const signer = await SignerJsonRpc.new(new ClientPublicTestnet(), {
      transport,
    });

    const first = signer.connect();
    const second = signer.connect();

    expect(second).toBe(first);
    await vi.waitFor(() => expect(connectRequests).toBe(1));
    resolveConnect();
    await first;
    await signer.connect();
    expect(connectRequests).toBe(1);
  });

  it("loads scripts using the local client address prefix", async () => {
    const client = new ClientPublicTestnet();
    const methods: string[] = [];
    const transport: JsonRpcTransport = {
      async request(payload) {
        methods.push(payload.method);
        return response(
          payload,
          payload.method === "get_info"
            ? {
                type: SignerType.CKB,
                sign_type: SignerSignType.CkbSecp256k1,
              }
            : [
                {
                  code_hash: `0x${"00".repeat(32)}`,
                  hash_type: "type",
                  args: "0x",
                },
              ],
        );
      },
    };
    const signer = await SignerJsonRpc.new(client, { transport });

    const [address] = await signer.getAddressObjs();

    expect(address.prefix).toBe(client.addressPrefix);
    expect(address.script.codeHash).toBe(`0x${"00".repeat(32)}`);
    expect(methods).toEqual(["get_info", "get_scripts"]);
  });

  it("runs disconnect cleanup before notifying replacement", async () => {
    const close = vi.fn(async () => {});
    const order: string[] = [];
    const disconnectHandler = vi.fn(async () => {
      order.push("disconnect");
    });
    const replaced = vi.fn(() => {
      order.push("replaced");
    });
    const transport: JsonRpcTransport & { close(): Promise<void> } = {
      close,
      async request(payload) {
        return response(payload, {
          type: SignerType.CKB,
          sign_type: SignerSignType.CkbSecp256k1,
        });
      },
    };
    const signer = await SignerJsonRpc.new(new ClientPublicTestnet(), {
      transport,
      disconnectHandler,
    });
    await signer.connect();
    signer.onReplaced(replaced);

    await Promise.all([signer.disconnect(), signer.disconnect()]);

    expect(close).not.toHaveBeenCalled();
    expect(disconnectHandler).toHaveBeenCalledOnce();
    expect(replaced).toHaveBeenCalledOnce();
    expect(order).toEqual(["disconnect", "replaced"]);
    await expect(signer.isConnected()).resolves.toBe(false);

    await signer.connect();
    signer.onReplaced(replaced);
    await signer.disconnect();

    expect(disconnectHandler).toHaveBeenCalledTimes(2);
    expect(replaced).toHaveBeenCalledTimes(2);
    expect(order).toEqual(["disconnect", "replaced", "disconnect", "replaced"]);
    await expect(signer.isConnected()).resolves.toBe(false);
  });

  it("notifies all replacement listeners exactly once", async () => {
    const listener = vi.fn();
    const otherListener = vi.fn();
    const removedListener = vi.fn();
    const nextListener = vi.fn();
    const transport: JsonRpcTransport = {
      async request(payload) {
        return response(payload, {
          type: SignerType.CKB,
          sign_type: SignerSignType.CkbSecp256k1,
        });
      },
    };
    const signer = await SignerJsonRpc.new(new ClientPublicTestnet(), {
      transport,
    });

    await signer.connect();
    signer.onReplaced(listener);
    signer.onReplaced(otherListener);
    const remove = signer.onReplaced(removedListener);
    remove();
    signer.replace();

    signer.onReplaced(nextListener);
    await signer.connect();
    signer.replace();

    expect(listener).toHaveBeenCalledOnce();
    expect(otherListener).toHaveBeenCalledOnce();
    expect(removedListener).not.toHaveBeenCalled();
    expect(nextListener).toHaveBeenCalledOnce();
    await expect(signer.isConnected()).resolves.toBe(false);
  });
});
