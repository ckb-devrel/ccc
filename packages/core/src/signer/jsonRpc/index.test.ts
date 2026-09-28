import { describe, expect, it, vi } from "vitest";
import { ClientPublicTestnet } from "../../client/index.js";
import {
  JsonRpcPayload,
  JsonRpcResponse,
  JsonRpcTransport,
} from "../../jsonRpc/index.js";
import { SignerSignType, SignerType } from "../signer/index.js";
import { SignerJsonRpc, SignerJsonRpcErrorCode } from "./index.js";
import { SignerJsonRpcTransformers } from "./transformers.js";

const SESSION_ID = `0x${"11".repeat(16)}`;
const UNUSED_CLIENT_TRANSPORT: JsonRpcTransport = {
  request: async () => {
    throw new Error("Unexpected Client request");
  },
};

function createClient() {
  return ClientPublicTestnet.new({ transport: UNUSED_CLIENT_TRANSPORT });
}

function infoResult(overrides: Record<string, unknown> = {}) {
  return {
    session_id: SESSION_ID,
    type: SignerType.CKB,
    sign_type: SignerSignType.CkbSecp256k1,
    ...overrides,
  };
}

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
        sessionId: SESSION_ID,
        type: SignerType.CKB,
        signType: SignerSignType.CkbSecp256k1,
        name: "Test wallet",
      }),
    ).toEqual({
      session_id: SESSION_ID,
      type: SignerType.CKB,
      sign_type: SignerSignType.CkbSecp256k1,
      name: "Test wallet",
    });
  });

  it("loads info before explicitly connecting", async () => {
    const client = createClient();
    const requests: Array<[string, unknown[]]> = [];
    const transport: JsonRpcTransport = {
      async request(payload) {
        requests.push([payload.method, payload.params as unknown[]]);
        if (payload.method === "connect") {
          return response(payload, null);
        }

        return response(
          payload,
          infoResult({
            name: "Test wallet",
            icon: "https://example.com/icon.png",
          }),
        );
      },
    };
    const signer = await SignerJsonRpc.new(client, { transport });
    const getInfoRequestId = (requests[0]?.[1][0] as { request_id: string })
      .request_id;
    expect(getInfoRequestId).toMatch(/^0x[0-9a-f]{32}$/);

    expect(requests).toEqual([
      ["get_info", [{ request_id: getInfoRequestId }]],
    ]);
    await expect(signer.isConnected()).resolves.toBe(false);
    expect(signer.name).toBe("Test wallet");
    expect(signer.icon).toBe("https://example.com/icon.png");

    await signer.connect();
    const connectRequestId = (requests[1]?.[1][0] as { request_id: string })
      .request_id;
    expect(connectRequestId).toMatch(/^0x[0-9a-f]{32}$/);

    expect(requests).toEqual([
      ["get_info", [{ request_id: getInfoRequestId }]],
      [
        "connect",
        [
          {
            request_id: connectRequestId,
            session_id: SESSION_ID,
          },
          "ckb-testnet",
        ],
      ],
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

        return response(payload, infoResult());
      },
    };
    const signer = await SignerJsonRpc.new(createClient(), {
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
    const client = createClient();
    const methods: string[] = [];
    const transport: JsonRpcTransport = {
      async request(payload) {
        methods.push(payload.method);
        return response(
          payload,
          payload.method === "get_info"
            ? infoResult()
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

  it("keeps input transformers aligned after the request metadata", async () => {
    let signMessageParams: unknown[] | undefined;
    const transport: JsonRpcTransport = {
      async request(payload) {
        if (payload.method === "get_info") {
          return response(payload, infoResult());
        }
        signMessageParams = payload.params as unknown[];
        return response(payload, "signature");
      },
    };
    const signer = await SignerJsonRpc.new(createClient(), {
      transport,
    });

    await expect(signer.signMessageRaw("hello")).resolves.toBe("signature");
    const signMessageRequestId = (
      signMessageParams?.[0] as { request_id: string }
    ).request_id;
    expect(signMessageRequestId).toMatch(/^0x[0-9a-f]{32}$/);
    expect(signMessageParams).toEqual([
      {
        request_id: signMessageRequestId,
        session_id: SESSION_ID,
      },
      { type: "string", value: "hello" },
    ]);
  });

  it("retries a lost response with the same request ID before recovery", async () => {
    vi.useFakeTimers();
    const identityRequestIds: string[] = [];
    const requestTimeouts: Array<number | undefined> = [];
    let identityRequests = 0;
    let getResultTimeout: number | undefined;
    const transport: JsonRpcTransport = {
      async request(payload, options) {
        if (payload.method === "get_info") {
          return response(payload, infoResult());
        }
        if (payload.method === "get_result") {
          getResultTimeout = options?.timeout;
          expect(payload.params).toEqual([{}, identityRequestIds[0]]);
          return response(payload, {
            status: "completed",
            result: "identity",
          });
        }
        identityRequests += 1;
        requestTimeouts.push(options?.timeout);
        const [metadata] = payload.params as [{ request_id: string }];
        identityRequestIds.push(metadata.request_id);
        throw new Error("Response lost");
      },
    };
    try {
      const signer = await SignerJsonRpc.new(createClient(), {
        transport,
      });
      const identity = signer.getIdentity();

      await vi.advanceTimersByTimeAsync(0);
      expect(identityRequests).toBe(1);
      await vi.advanceTimersByTimeAsync(4_999);
      expect(identityRequests).toBe(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(identityRequests).toBe(2);
      await vi.advanceTimersByTimeAsync(9_999);
      expect(identityRequests).toBe(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(identityRequests).toBe(3);
      await vi.advanceTimersByTimeAsync(19_999);
      expect(identityRequests).toBe(3);
      await vi.advanceTimersByTimeAsync(1);

      await expect(identity).resolves.toBe("identity");
      expect(identityRequests).toBe(4);
      expect(new Set(identityRequestIds).size).toBe(1);
      expect(requestTimeouts).toEqual([10_000, 10_000, 10_000, 10_000]);
      expect(getResultTimeout).toBe(20_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("recovers after a retried request reports a duplicate ID", async () => {
    vi.useFakeTimers();
    let identityRequestId: string | undefined;
    let identityRequests = 0;
    const transport: JsonRpcTransport = {
      async request(payload) {
        if (payload.method === "get_info") {
          return response(payload, infoResult());
        }
        if (payload.method === "get_result") {
          expect(payload.params).toEqual([{}, identityRequestId]);
          return response(payload, {
            status: "completed",
            result: "identity",
          });
        }

        const [metadata] = payload.params as [{ request_id: string }];
        identityRequests += 1;
        if (identityRequestId) {
          expect(metadata.request_id).toBe(identityRequestId);
        }
        identityRequestId = metadata.request_id;
        if (identityRequests === 1) {
          throw new Error("Response lost");
        }
        return {
          jsonrpc: "2.0",
          id: payload.id,
          error: {
            code: SignerJsonRpcErrorCode.DuplicateRequestId,
            message: "Request ID already exists",
          },
        };
      },
    };
    try {
      const signer = await SignerJsonRpc.new(createClient(), {
        transport,
      });
      const identity = signer.getIdentity();

      await vi.advanceTimersByTimeAsync(5_000);

      await expect(identity).resolves.toBe("identity");
      expect(identityRequests).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("recovers signer info without a session ID", async () => {
    vi.useFakeTimers();
    let getInfoRequestId: string | undefined;
    const transport: JsonRpcTransport = {
      async request(payload) {
        if (payload.method === "get_info") {
          const [metadata] = payload.params as [{ request_id: string }];
          getInfoRequestId = metadata.request_id;
          throw new Error("Response lost");
        }
        expect(payload.method).toBe("get_result");
        expect(payload.params).toEqual([{}, getInfoRequestId]);
        return response(payload, {
          status: "completed",
          result: infoResult({ name: "Recovered wallet" }),
        });
      },
    };

    try {
      const signerPromise = SignerJsonRpc.new(createClient(), {
        transport,
      });
      await vi.advanceTimersByTimeAsync(35_000);
      const signer = await signerPromise;

      expect(signer.name).toBe("Recovered wallet");
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the B retry schedule while result recovery is unavailable", async () => {
    vi.useFakeTimers();
    let getResultRequests = 0;
    const transport: JsonRpcTransport = {
      async request(payload) {
        if (payload.method === "get_info") {
          return response(payload, infoResult());
        }
        if (payload.method === "get_result") {
          getResultRequests += 1;
          if (getResultRequests < 6) {
            throw new Error("Unavailable");
          }
          return response(payload, {
            status: "completed",
            result: "identity",
          });
        }
        throw new Error("Response lost");
      },
    };

    try {
      const signer = await SignerJsonRpc.new(createClient(), {
        transport,
      });
      const identity = signer.getIdentity();

      await vi.advanceTimersByTimeAsync(35_000);
      expect(getResultRequests).toBe(1);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(getResultRequests).toBe(2);
      await vi.advanceTimersByTimeAsync(2_000);
      expect(getResultRequests).toBe(3);
      await vi.advanceTimersByTimeAsync(4_000);
      expect(getResultRequests).toBe(4);
      await vi.advanceTimersByTimeAsync(8_000);
      expect(getResultRequests).toBe(5);
      await vi.advanceTimersByTimeAsync(10_000);

      await expect(identity).resolves.toBe("identity");
      expect(getResultRequests).toBe(6);
    } finally {
      vi.useRealTimers();
    }
  });

  it("limits pending result polling to once every five seconds", async () => {
    vi.useFakeTimers();
    let getResultRequests = 0;
    const transport: JsonRpcTransport = {
      async request(payload) {
        if (payload.method === "get_info") {
          return response(payload, infoResult());
        }
        if (payload.method === "get_result") {
          getResultRequests += 1;
          if (getResultRequests === 2) {
            await new Promise((resolve) => setTimeout(resolve, 10_000));
          }
          return response(
            payload,
            getResultRequests < 3
              ? { status: "pending" }
              : { status: "completed", result: "identity" },
          );
        }
        return {
          jsonrpc: "2.0",
          id: payload.id,
          error: {
            code: SignerJsonRpcErrorCode.DuplicateRequestId,
            message: "Request ID already exists",
          },
        };
      },
    };

    try {
      const signer = await SignerJsonRpc.new(createClient(), {
        transport,
      });
      const identity = signer.getIdentity();

      await vi.advanceTimersByTimeAsync(0);
      expect(getResultRequests).toBe(1);
      await vi.advanceTimersByTimeAsync(4_999);
      expect(getResultRequests).toBe(1);
      await vi.advanceTimersByTimeAsync(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(getResultRequests).toBe(2);
      await vi.advanceTimersByTimeAsync(9_999);
      expect(getResultRequests).toBe(2);
      await vi.advanceTimersByTimeAsync(1);
      await vi.advanceTimersByTimeAsync(1);

      await expect(identity).resolves.toBe("identity");
      expect(getResultRequests).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops request retries when replaced", async () => {
    vi.useFakeTimers();
    let identityRequests = 0;
    let getResultRequests = 0;
    const transport: JsonRpcTransport = {
      async request(payload) {
        if (payload.method === "get_info") {
          return response(payload, infoResult());
        }
        if (payload.method === "get_result") {
          getResultRequests += 1;
        } else {
          identityRequests += 1;
        }
        throw new Error("Unavailable");
      },
    };

    try {
      const signer = await SignerJsonRpc.new(createClient(), {
        transport,
      });
      const identity = signer.getIdentity();
      const identityError = expect(identity).rejects.toThrow(
        "Signer JSON-RPC was replaced",
      );
      await vi.advanceTimersByTimeAsync(0);
      expect(identityRequests).toBe(1);

      signer.replace();

      await identityError;
      await vi.advanceTimersByTimeAsync(35_000);
      expect(identityRequests).toBe(1);
      expect(getResultRequests).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops result recovery when replaced", async () => {
    let getResultRequests = 0;
    let recoverySignal: AbortSignal | undefined;
    const transport: JsonRpcTransport = {
      async request(payload, options) {
        if (payload.method === "get_info") {
          return response(payload, infoResult());
        }
        if (payload.method !== "get_result") {
          return {
            jsonrpc: "2.0",
            id: payload.id,
            error: {
              code: SignerJsonRpcErrorCode.DuplicateRequestId,
              message: "Request ID already exists",
            },
          };
        }

        getResultRequests += 1;
        recoverySignal = options?.signal;
        return new Promise<JsonRpcResponse>((_resolve, reject) => {
          recoverySignal?.throwIfAborted();
          recoverySignal?.addEventListener(
            "abort",
            () => reject(recoverySignal?.reason),
            { once: true },
          );
        });
      },
    };
    const signer = await SignerJsonRpc.new(createClient(), {
      transport,
    });
    const identity = signer.getIdentity();
    const identityError = expect(identity).rejects.toThrow(
      "Signer JSON-RPC was replaced",
    );
    await vi.waitFor(() => expect(getResultRequests).toBe(1));

    signer.replace();

    await identityError;
    expect(recoverySignal?.aborted).toBe(true);
    expect(getResultRequests).toBe(1);
  });

  it("replaces itself when a request reports an expired session", async () => {
    let identityRequests = 0;
    const transport: JsonRpcTransport = {
      async request(payload) {
        if (payload.method === "get_info") {
          return response(payload, infoResult());
        }
        if (payload.method === "connect") {
          return response(payload, null);
        }
        identityRequests += 1;
        return {
          jsonrpc: "2.0",
          id: payload.id,
          error: {
            code: SignerJsonRpcErrorCode.InvalidSession,
            message: "Invalid or expired session",
          },
        };
      },
    };
    const signer = await SignerJsonRpc.new(createClient(), {
      transport,
    });
    await signer.connect();
    const replaced = vi.fn();
    signer.onReplaced(replaced);

    await expect(signer.getIdentity()).rejects.toMatchObject({
      code: SignerJsonRpcErrorCode.InvalidSession,
    });
    expect(replaced).toHaveBeenCalledOnce();
    expect(identityRequests).toBe(1);
    await expect(signer.isConnected()).resolves.toBe(false);
  });

  it("replaces itself when result recovery reports an expired session", async () => {
    vi.useFakeTimers();
    const transport: JsonRpcTransport = {
      async request(payload) {
        if (payload.method === "get_info") {
          return response(payload, infoResult());
        }
        if (payload.method === "get_result") {
          return {
            jsonrpc: "2.0",
            id: payload.id,
            error: {
              code: SignerJsonRpcErrorCode.InvalidSession,
              message: "Invalid or expired session",
            },
          };
        }
        throw new Error("Response lost");
      },
    };
    try {
      const signer = await SignerJsonRpc.new(createClient(), {
        transport,
      });
      const replaced = vi.fn();
      signer.onReplaced(replaced);
      const identity = signer.getIdentity();
      const identityError = expect(identity).rejects.toMatchObject({
        code: SignerJsonRpcErrorCode.InvalidSession,
      });

      await vi.advanceTimersByTimeAsync(35_000);

      await identityError;
      expect(replaced).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("caches successful read-only requests until replacement", async () => {
    const requests = new Map<string, number>();
    let resolveScripts = () => {};
    const scriptsPending = new Promise<void>((resolve) => {
      resolveScripts = resolve;
    });
    const transport: JsonRpcTransport = {
      async request(payload) {
        requests.set(payload.method, (requests.get(payload.method) ?? 0) + 1);
        if (payload.method === "get_info") {
          return response(payload, infoResult());
        }
        if (payload.method === "get_scripts") {
          await scriptsPending;
          return response(payload, [
            {
              code_hash: `0x${"00".repeat(32)}`,
              hash_type: "type",
              args: "0x",
            },
          ]);
        }
        if (payload.method === "get_native_address") {
          return response(payload, "native-address");
        }
        if (payload.method === "get_identity") {
          return response(payload, "identity");
        }
        return response(payload, null);
      },
    };
    const signer = await SignerJsonRpc.new(createClient(), {
      transport,
    });

    const addresses = Promise.all([
      signer.getAddressObjs(),
      signer.getAddresses(),
    ]);
    await vi.waitFor(() => expect(requests.get("get_scripts")).toBe(1));
    resolveScripts();
    await addresses;
    const scripts = await signer.getScripts();
    scripts.pop();
    expect(await signer.getScripts()).toHaveLength(1);
    await signer.getRecommendedAddress();
    await Promise.all([
      signer.getInternalAddress(),
      signer.getInternalAddress(),
      signer.getIdentity(),
      signer.getIdentity(),
    ]);

    expect(requests.get("get_scripts")).toBe(1);
    expect(requests.get("get_native_address")).toBe(1);
    expect(requests.get("get_identity")).toBe(1);

    signer.replace();
    await Promise.all([
      signer.getAddressObjs(),
      signer.getInternalAddress(),
      signer.getIdentity(),
    ]);

    expect(requests.get("get_scripts")).toBe(2);
    expect(requests.get("get_native_address")).toBe(2);
    expect(requests.get("get_identity")).toBe(2);
  });

  it("clears failed read-only requests after recovery fails", async () => {
    vi.useFakeTimers();
    let identityRequests = 0;
    const requestError = new Error("Temporary failure");
    const transport: JsonRpcTransport = {
      async request(payload) {
        if (payload.method === "get_info") {
          return response(payload, infoResult());
        }

        if (payload.method === "get_result") {
          return response(payload, { status: "not_found" });
        }

        identityRequests += 1;
        if (identityRequests <= 4) {
          throw requestError;
        }
        return response(payload, "identity");
      },
    };
    try {
      const signer = await SignerJsonRpc.new(createClient(), {
        transport,
      });
      const firstIdentity = signer.getIdentity();
      const firstIdentityError =
        expect(firstIdentity).rejects.toBe(requestError);
      await vi.advanceTimersByTimeAsync(35_000);

      await firstIdentityError;
      await expect(signer.getIdentity()).resolves.toBe("identity");
      await expect(signer.getIdentity()).resolves.toBe("identity");
      expect(identityRequests).toBe(5);
    } finally {
      vi.useRealTimers();
    }
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
        return response(payload, infoResult());
      },
    };
    const signer = await SignerJsonRpc.new(createClient(), {
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
        return response(payload, infoResult());
      },
    };
    const signer = await SignerJsonRpc.new(createClient(), {
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
