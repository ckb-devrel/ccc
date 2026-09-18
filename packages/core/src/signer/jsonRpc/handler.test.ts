import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientPublicTestnet } from "../../client/index.js";
import { JsonRpcError, type JsonRpcPayload } from "../../jsonRpc/index.js";
import { SignerSignType, SignerType, type Signer } from "../signer/index.js";
import {
  SignerJsonRpcErrorCode,
  SignerJsonRpcProviderSession,
  type SignerJsonRpcProviderSessionConfig,
} from "./index.js";
import { SignerJsonRpcTransformers } from "./transformers.js";

let nextRequestId = 0;
const sessionOwners: ReturnType<typeof SignerJsonRpcProviderSession.open>[] =
  [];

afterEach(async () => {
  await Promise.all(sessionOwners.splice(0).map((owner) => owner.dispose()));
  vi.useRealTimers();
});

function payload(
  method: string,
  params: unknown[] = [],
  requestId = `request-${nextRequestId++}`,
  sessionId?: string,
): JsonRpcPayload {
  return {
    id: 0,
    jsonrpc: "2.0",
    method,
    params: [
      {
        ...(method !== "get_result" ? { request_id: requestId } : {}),
        ...(method !== "get_result" && sessionId
          ? { session_id: sessionId }
          : {}),
      },
      ...(method === "get_result" ? [requestId] : params),
    ],
  };
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

function createSession(
  signer: Signer,
  overrides: Partial<SignerJsonRpcProviderSessionConfig> = {},
) {
  const owner = SignerJsonRpcProviderSession.open({
    connect: async () => signer,
    confirmRequest: async () => true,
    getSigner: () => signer,
    ...overrides,
  });
  sessionOwners.push(owner);
  return owner.value;
}

async function getSessionId(session: SignerJsonRpcProviderSession) {
  const info = (await session.handle(payload("get_info"))) as {
    session_id: string;
  };
  return info.session_id;
}

async function connect(
  session: SignerJsonRpcProviderSession,
  sessionId: string,
) {
  await session.handle(
    payload("connect", ["ckb-testnet"], undefined, sessionId),
  );
}

describe("SignerJsonRpcProviderSession", () => {
  it("creates a unique session ID for each lifecycle", async () => {
    const signer = mockSigner();
    const first = await getSessionId(createSession(signer));
    const second = await getSessionId(createSession(signer));

    expect(first).not.toBe(second);
  });

  it("returns its session ID with signer information", async () => {
    const signer = mockSigner();
    const session = createSession(signer, {
      getSignerMetadata: () => ({ name: "Test wallet", icon: "test.svg" }),
    });

    const info = (await session.handle(payload("get_info"))) as {
      session_id: string;
    };
    expect(info.session_id).toMatch(/^0x[0-9a-f]{32}$/);
    expect(info).toEqual({
      session_id: info.session_id,
      type: SignerType.CKB,
      sign_type: SignerSignType.CkbSecp256k1,
      name: "Test wallet",
      icon: "test.svg",
    });
  });

  it("requires its session ID and a successful connect", async () => {
    const signer = mockSigner({
      getIdentity: vi.fn(async () => "identity"),
    });
    const session = createSession(signer);
    const sessionId = await getSessionId(session);

    await expect(
      session.handle(payload("connect", ["ckb-testnet"], undefined, "wrong")),
    ).rejects.toMatchObject({ code: SignerJsonRpcErrorCode.InvalidSession });
    await expect(
      session.handle(payload("get_identity", [], undefined, sessionId)),
    ).rejects.toMatchObject({ code: SignerJsonRpcErrorCode.InvalidState });

    expect(session.isConnected).toBe(false);
    await connect(session, sessionId);
    expect(session.isConnected).toBe(true);
    await expect(
      session.handle(payload("get_identity", [], undefined, sessionId)),
    ).resolves.toBe("identity");
  });

  it("confirms and connects the requested network", async () => {
    const signerConnect = vi.fn(async () => {});
    const signer = mockSigner({ connect: signerConnect });
    const providerConnect = vi.fn<
      SignerJsonRpcProviderSessionConfig["connect"]
    >(async () => signer);
    const confirmRequest = vi.fn<
      SignerJsonRpcProviderSessionConfig["confirmRequest"]
    >(async () => true);
    const session = createSession(signer, {
      connect: providerConnect,
      confirmRequest,
    });
    const sessionId = await getSessionId(session);

    await expect(
      session.handle(payload("connect", ["ckb-testnet"], undefined, sessionId)),
    ).resolves.toBeNull();
    const [confirmation, confirmationOptions] =
      confirmRequest.mock.calls[0] ?? [];
    expect(confirmation).toEqual({
      method: "connect",
      networkId: "ckb-testnet",
    });
    expect(confirmationOptions?.signal).toBeInstanceOf(AbortSignal);
    const [networkId, connectOptions] = providerConnect.mock.calls[0] ?? [];
    expect(networkId).toBe("ckb-testnet");
    expect(connectOptions?.signal).toBeInstanceOf(AbortSignal);
    expect(signerConnect).not.toHaveBeenCalled();
  });

  it("validates methods and parameters with JSON-RPC errors", async () => {
    const signer = mockSigner();
    const session = createSession(signer);
    const sessionId = await getSessionId(session);

    await expect(
      session.handle(payload("unknown", [], undefined, sessionId)),
    ).rejects.toEqual(
      new JsonRpcError({
        code: SignerJsonRpcErrorCode.MethodNotFound,
        message: "Unsupported method: unknown",
      }),
    );
    await expect(
      session.handle(payload("connect", [], undefined, sessionId)),
    ).rejects.toMatchObject({ code: SignerJsonRpcErrorCode.InvalidParams });
  });

  it("does not sign rejected requests", async () => {
    const message = Uint8Array.from([1, 2]);
    const signMessageRaw = vi.fn();
    const signer = mockSigner({ signMessageRaw });
    const confirmRequest = vi
      .fn<SignerJsonRpcProviderSessionConfig["confirmRequest"]>()
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    const session = createSession(signer, { confirmRequest });
    const sessionId = await getSessionId(session);
    await connect(session, sessionId);

    const request = session.handle(
      payload(
        "sign_message",
        [SignerJsonRpcTransformers.messageFrom(message)],
        undefined,
        sessionId,
      ),
    );

    await expect(request).rejects.toEqual(
      new JsonRpcError({
        code: SignerJsonRpcErrorCode.UserRejected,
        message: "User rejected request",
      }),
    );
    const [confirmation, confirmationOptions] =
      confirmRequest.mock.calls.at(-1) ?? [];
    expect(confirmation).toEqual({
      method: "sign_message",
      message: { type: "bytes", value: "0x0102" },
    });
    expect(confirmationOptions?.signal).toBeInstanceOf(AbortSignal);
    expect(signMessageRaw).not.toHaveBeenCalled();
  });

  it("queries get_info results without a session ID", async () => {
    const session = createSession(mockSigner());
    const requestId = "get-info-request";
    const info = await session.handle(payload("get_info", [], requestId));

    await expect(
      session.handle(payload("get_result", [], requestId)),
    ).resolves.toEqual({ status: "completed", result: info });
  });

  it("caches completed results and rejects duplicate request IDs", async () => {
    const signer = mockSigner({
      getIdentity: vi.fn(async () => "identity"),
    });
    const session = createSession(signer);
    const sessionId = await getSessionId(session);
    await connect(session, sessionId);
    const request = payload("get_identity", [], "same-request", sessionId);

    await expect(session.handle(request)).resolves.toBe("identity");
    await expect(
      session.handle(payload("get_result", [], "same-request")),
    ).resolves.toEqual({ status: "completed", result: "identity" });
    expect(() => session.handle(request)).toThrow(
      new JsonRpcError({
        code: SignerJsonRpcErrorCode.DuplicateRequestId,
        message: "Request ID already exists",
      }),
    );
  });

  it("retains completed results after the guaranteed cache period", async () => {
    vi.useFakeTimers();
    const signer = mockSigner({
      getIdentity: vi.fn(async () => "identity"),
    });
    const session = createSession(signer);
    const sessionId = await getSessionId(session);
    await connect(session, sessionId);

    await session.handle(
      payload("get_identity", [], "retained-request", sessionId),
    );
    await vi.advanceTimersByTimeAsync(120_000);

    await expect(
      session.handle(payload("get_result", [], "retained-request")),
    ).resolves.toEqual({ status: "completed", result: "identity" });
  });

  it("evicts retrieved history before unretrieved history", async () => {
    vi.useFakeTimers();
    const signer = mockSigner({
      getIdentity: vi.fn(async () => "identity"),
    });
    const session = createSession(signer);
    const sessionId = await getSessionId(session);
    await connect(session, sessionId);

    await session.handle(
      payload("get_identity", [], "retrieved-request", sessionId),
    );
    await session.handle(payload("get_result", [], "retrieved-request"));

    for (let i = 0; i < 126; i++) {
      await session.handle(
        payload("get_identity", [], `unretrieved-${i}`, sessionId),
      );
    }
    await vi.advanceTimersByTimeAsync(120_000);

    await expect(
      session.handle(payload("get_result", [], "retrieved-request")),
    ).resolves.toEqual({ status: "not_found" });
    await expect(
      session.handle(payload("get_result", [], "unretrieved-0")),
    ).resolves.toEqual({ status: "completed", result: "identity" });
  });

  it("caches and rethrows the original error object", async () => {
    const error = new JsonRpcError({
      code: SignerJsonRpcErrorCode.UserRejected,
      message: "Rejected",
    });
    const signer = mockSigner({
      getIdentity: vi.fn(async () => {
        throw error;
      }),
    });
    const session = createSession(signer);
    const sessionId = await getSessionId(session);
    await connect(session, sessionId);

    await expect(
      session.handle(payload("get_identity", [], "failed-request", sessionId)),
    ).rejects.toBe(error);
    await expect(
      session.handle(payload("get_result", [], "failed-request")),
    ).rejects.toBe(error);
  });

  it("keeps signer information fixed for its lifecycle", async () => {
    let name = "First name";
    const session = createSession(mockSigner(), {
      getSignerMetadata: () => ({ name }),
    });
    const first = await session.handle(payload("get_info"));
    name = "Second name";

    await expect(session.handle(payload("get_info"))).resolves.toEqual(first);
  });

  it("aborts pending requests when its owner is disposed", async () => {
    let requestSignal: AbortSignal | undefined;
    const signer = mockSigner();
    const owner = SignerJsonRpcProviderSession.open({
      connect: async () => signer,
      confirmRequest: (_request, options) => {
        requestSignal = options?.signal;
        return new Promise<boolean>((resolve) =>
          options?.signal?.addEventListener("abort", () => resolve(false), {
            once: true,
          }),
        );
      },
      getSigner: () => signer,
    });
    sessionOwners.push(owner);
    const session = owner.value;
    const sessionId = await getSessionId(session);
    const request = session.handle(
      payload("connect", ["ckb-testnet"], undefined, sessionId),
    );
    await vi.waitFor(() => expect(requestSignal).toBeDefined());

    await owner.dispose();

    await expect(request).rejects.toMatchObject({
      code: SignerJsonRpcErrorCode.InvalidSession,
      message: "Invalid or expired session",
    });
    expect(session.isConnected).toBe(false);
    expect(() => session.handle(payload("get_info"))).toThrow(
      expect.objectContaining({
        code: SignerJsonRpcErrorCode.InvalidSession,
      }),
    );
  });
});
