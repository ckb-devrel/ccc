import { randomBytes } from "@noble/hashes/utils.js";
import type { Transaction } from "../../ckb/index.js";
import { JsonRpcTransformers } from "../../client/jsonRpc/advanced.js";
import { hexFrom } from "../../hex/index.js";
import { JsonRpcError, type JsonRpcPayload } from "../../jsonRpc/index.js";
import { abortSignalAny, sleep } from "../../utils/index.js";
import { OwnerUnique } from "../../utils/owner/unique.js";
import type { Signer } from "../signer/index.js";
import { signerJsonRpcNetworkIdFromAddressPrefix } from "./network.js";
import {
  SignerJsonRpcTransformers,
  type SignerJsonRpcInfo,
  type SignerJsonRpcInfoPayload,
  type SignerJsonRpcMessageToSign,
} from "./transformers.js";

export type SignerJsonRpcConfirmation =
  | { method: "connect"; networkId: string }
  | { method: "sign_message"; message: SignerJsonRpcMessageToSign }
  | { method: "sign_transaction"; transaction: Transaction };

const GET_RESULT_CACHE_MS = 120_000;
const GET_RESULT_HISTORY_CAPACITY = 128;
const GET_RESULT_WAIT_MS = 10_000;
const GET_RESULT_PENDING_RESULT = Symbol("pending");

type SignerJsonRpcResultEntry = {
  completion: Promise<unknown>;
  retrieved: boolean;
};

export enum SignerJsonRpcErrorCode {
  MethodNotFound = -32601,
  InvalidParams = -32602,
  ServerError = -32000,
  InvalidState = -32001,
  NetworkMismatch = -32002,
  UserRejected = -32003,
  InvalidSession = -32004,
  DuplicateRequestId = -32005,
}

export type SignerJsonRpcProviderSessionOptions = {
  /** Aborts when the provider session is disposed. */
  signal?: AbortSignal;
};

export type SignerJsonRpcResultRecord =
  | { status: "not_found" }
  | { status: "pending" }
  | { status: "completed"; result: unknown };

export type SignerJsonRpcProviderSessionConfig = {
  getSigner: () => Signer | undefined;
  getSignerMetadata?: () => Pick<SignerJsonRpcInfo, "name" | "icon">;
  /** Connects the requested network and returns its connected Signer. */
  connect: (
    networkId: string,
    options?: SignerJsonRpcProviderSessionOptions,
  ) => Promise<Signer>;
  confirmRequest: (
    request: SignerJsonRpcConfirmation,
    options?: SignerJsonRpcProviderSessionOptions,
  ) => Promise<boolean>;
};

export class SignerJsonRpcProviderSession {
  private readonly abortController = new AbortController();
  private readonly id = hexFrom(randomBytes(16));
  private readonly resultRecords = new Map<string, SignerJsonRpcResultEntry>();
  private readonly resultHistory = new Map<string, SignerJsonRpcResultEntry>();
  private readonly handlers;
  private info?: SignerJsonRpcInfoPayload;
  private connected = false;

  private constructor(
    private readonly config: SignerJsonRpcProviderSessionConfig,
  ) {
    this.handlers = new Map<
      string,
      readonly [
        number,
        (
          params: unknown[],
          options?: SignerJsonRpcProviderSessionOptions,
        ) => unknown,
      ]
    >([
      [
        "get_info",
        [
          0,
          () =>
            (this.info ??= buildSignerInfo(
              this.id,
              this.requireSigner(),
              this.config.getSignerMetadata?.() ?? {},
            )),
        ],
      ],
      [
        "connect",
        [
          1,
          async ([networkId], options) => {
            this.connected = false;
            if (typeof networkId !== "string" || !networkId) {
              throw new JsonRpcError({
                code: SignerJsonRpcErrorCode.InvalidParams,
                message: "Invalid network ID",
              });
            }

            await this.requireConfirmation(
              { method: "connect", networkId },
              options,
            );

            const signer = await this.config.connect(networkId, options);
            options?.signal?.throwIfAborted();
            const actualNetworkId = signerJsonRpcNetworkIdFromAddressPrefix(
              signer.client.addressPrefix,
            );
            if (actualNetworkId !== networkId) {
              throw new JsonRpcError({
                code: SignerJsonRpcErrorCode.NetworkMismatch,
                message: `Signer uses ${actualNetworkId}, expected ${networkId}`,
              });
            }

            this.connected = true;
            return null;
          },
        ],
      ],
      [
        "get_scripts",
        [
          0,
          async () =>
            (await this.requireSigner().getAddressObjs()).map(({ script }) =>
              JsonRpcTransformers.scriptFrom(script),
            ),
        ],
      ],
      [
        "get_native_address",
        [0, () => this.requireSigner().getInternalAddress()],
      ],
      ["get_identity", [0, () => this.requireSigner().getIdentity()]],
      [
        "sign_message",
        [
          1,
          async ([message], options) => {
            const parsedMessage = parseMessageParam(message);
            await this.requireConfirmation(
              {
                method: "sign_message",
                message: SignerJsonRpcTransformers.messageFrom(parsedMessage),
              },
              options,
            );
            return this.requireSigner().signMessageRaw(parsedMessage);
          },
        ],
      ],
      [
        "prepare_transaction",
        [
          1,
          async ([transaction]) =>
            JsonRpcTransformers.transactionFrom(
              await this.requireSigner().prepareTransaction(
                parseTransactionParam(transaction),
              ),
            ),
        ],
      ],
      [
        "sign_transaction",
        [
          1,
          async ([transaction], options) => {
            const parsedTransaction = parseTransactionParam(transaction);
            await this.requireConfirmation(
              { method: "sign_transaction", transaction: parsedTransaction },
              options,
            );
            return JsonRpcTransformers.transactionFrom(
              await this.requireSigner().signOnlyTransaction(parsedTransaction),
            );
          },
        ],
      ],
    ]);
  }

  static open(
    config: SignerJsonRpcProviderSessionConfig,
  ): OwnerUnique<SignerJsonRpcProviderSession> {
    const session = new SignerJsonRpcProviderSession(config);
    return new OwnerUnique(session, (session) => session.dispose());
  }

  get isConnected() {
    return this.connected;
  }

  handle = (payload: JsonRpcPayload) => {
    const signal = this.abortController.signal;
    signal.throwIfAborted();

    const [metadata, ...params] = requireParams(payload);
    const { requestId, sessionId } = parseRequestMetadata(metadata);

    if (payload.method === "get_result") {
      const [targetRequestId] = params;
      requireParams(payload, 2);
      requireRequestId(targetRequestId);
      return this.getResult(
        this.resultRecords.get(targetRequestId) ??
          this.resultHistory.get(targetRequestId),
        signal,
      );
    }

    requireRequestId(requestId);
    if (
      this.resultRecords.has(requestId) ||
      this.resultHistory.has(requestId)
    ) {
      throw new JsonRpcError({
        code: SignerJsonRpcErrorCode.DuplicateRequestId,
        message: "Request ID already exists",
      });
    }

    return this.executeRequest(requestId, async () => {
      signal.throwIfAborted();
      const isGetInfo = payload.method === "get_info";
      if (isGetInfo) {
        if (sessionId !== undefined) {
          throw new JsonRpcError({
            code: SignerJsonRpcErrorCode.InvalidParams,
            message: "get_info does not accept a session ID",
          });
        }
      } else {
        this.requireSession(sessionId);
      }

      const entry = this.handlers.get(payload.method);
      if (!entry) {
        throw new JsonRpcError({
          code: SignerJsonRpcErrorCode.MethodNotFound,
          message: `Unsupported method: ${payload.method}`,
        });
      }
      const [paramCount, handler] = entry;
      requireParams(payload, paramCount + 1);

      if (!isGetInfo && payload.method !== "connect" && !this.connected) {
        throw new JsonRpcError({
          code: SignerJsonRpcErrorCode.InvalidState,
          message: "Connect must be approved before this request",
        });
      }
      const result = await handler(params, { signal });
      signal.throwIfAborted();
      return result;
    });
  };

  private dispose() {
    this.connected = false;
    this.resultRecords.clear();
    this.resultHistory.clear();
    this.abortController.abort(
      new JsonRpcError({
        code: SignerJsonRpcErrorCode.InvalidSession,
        message: "Invalid or expired session",
      }),
    );
  }

  private requireSession(value: unknown) {
    if (value === this.id) {
      return;
    }
    throw new JsonRpcError({
      code: SignerJsonRpcErrorCode.InvalidSession,
      message: "Invalid or expired session",
    });
  }

  private requireSigner() {
    const signer = this.config.getSigner();
    if (!signer) {
      throw new JsonRpcError({
        code: SignerJsonRpcErrorCode.ServerError,
        message: "No signer is connected",
      });
    }

    return signer;
  }

  private async requireConfirmation(
    request: SignerJsonRpcConfirmation,
    options?: SignerJsonRpcProviderSessionOptions,
  ) {
    const confirmed = await this.config.confirmRequest(request, options);
    options?.signal?.throwIfAborted();
    if (!confirmed) {
      throw new JsonRpcError({
        code: SignerJsonRpcErrorCode.UserRejected,
        message: "User rejected request",
      });
    }
  }

  private executeRequest(requestId: string, request: () => unknown) {
    const completion = Promise.resolve().then(request);
    const entry = { completion, retrieved: false };
    this.resultRecords.set(requestId, entry);
    const expire = () => {
      setTimeout(() => {
        if (this.resultRecords.get(requestId) === entry) {
          this.resultRecords.delete(requestId);
          this.resultHistory.set(requestId, entry);
          this.trimResultHistory();
        }
      }, GET_RESULT_CACHE_MS);
    };
    void completion.then(expire, expire);
    return completion;
  }

  private trimResultHistory() {
    while (this.resultHistory.size > GET_RESULT_HISTORY_CAPACITY) {
      let oldestRetrieved: string | undefined;
      for (const [requestId, entry] of this.resultHistory) {
        if (entry.retrieved) {
          oldestRetrieved = requestId;
          break;
        }
      }

      this.resultHistory.delete(
        oldestRetrieved ?? this.resultHistory.keys().next().value!,
      );
    }
  }

  private async getResult(
    entry: SignerJsonRpcResultEntry | undefined,
    signal?: AbortSignal,
  ): Promise<SignerJsonRpcResultRecord> {
    if (!entry) {
      return { status: "not_found" };
    }

    const controller = new AbortController();
    try {
      const result = await Promise.race([
        entry.completion.then(
          (value) => ({ status: "fulfilled" as const, value }),
          (reason: unknown) => ({ status: "rejected" as const, reason }),
        ),
        sleep(
          GET_RESULT_WAIT_MS,
          signal
            ? abortSignalAny([signal, controller.signal])
            : controller.signal,
        ).then(
          (): typeof GET_RESULT_PENDING_RESULT => GET_RESULT_PENDING_RESULT,
        ),
      ]);
      if (result === GET_RESULT_PENDING_RESULT) {
        return { status: "pending" };
      }

      entry.retrieved = true;
      if (result.status === "rejected") {
        throw result.reason;
      }
      return { status: "completed", result: result.value };
    } finally {
      controller.abort();
    }
  }
}

function parseMessageParam(message: unknown) {
  try {
    return SignerJsonRpcTransformers.messageTo(message);
  } catch (cause) {
    throw new JsonRpcError({
      code: SignerJsonRpcErrorCode.InvalidParams,
      message:
        cause instanceof Error ? cause.message : "Invalid signer message",
    });
  }
}

function parseTransactionParam(transaction: unknown) {
  try {
    return JsonRpcTransformers.transactionTo(
      transaction as Parameters<typeof JsonRpcTransformers.transactionTo>[0],
    );
  } catch (cause) {
    throw new JsonRpcError({
      code: SignerJsonRpcErrorCode.InvalidParams,
      message:
        cause instanceof Error ? cause.message : "Invalid signer transaction",
    });
  }
}

function requireParams(payload: JsonRpcPayload, count?: number) {
  if (!Array.isArray(payload.params)) {
    throw new JsonRpcError({
      code: SignerJsonRpcErrorCode.InvalidParams,
      message: `${payload.method} expects positional parameters`,
    });
  }
  if (count !== undefined && payload.params.length !== count) {
    throw new JsonRpcError({
      code: SignerJsonRpcErrorCode.InvalidParams,
      message: `${payload.method} expects ${count} parameter${count === 1 ? "" : "s"}`,
    });
  }

  return payload.params;
}

function parseRequestMetadata(value: unknown) {
  if (
    typeof value !== "object" ||
    value === null ||
    ("request_id" in value && typeof value.request_id !== "string") ||
    ("session_id" in value && typeof value.session_id !== "string")
  ) {
    throw new JsonRpcError({
      code: SignerJsonRpcErrorCode.InvalidParams,
      message: "Invalid request metadata",
    });
  }

  return {
    requestId: "request_id" in value ? value.request_id : undefined,
    sessionId: "session_id" in value ? value.session_id : undefined,
  };
}

function requireRequestId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value) {
    throw new JsonRpcError({
      code: SignerJsonRpcErrorCode.InvalidParams,
      message: "Invalid request ID",
    });
  }
}

function buildSignerInfo(
  sessionId: string,
  signer: Signer,
  metadata: Pick<SignerJsonRpcInfo, "name" | "icon">,
) {
  return SignerJsonRpcTransformers.infoFrom({
    sessionId,
    type: signer.type,
    signType: signer.signType,
    name: metadata.name,
    icon: metadata.icon,
  });
}
