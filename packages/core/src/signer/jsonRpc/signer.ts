import { randomBytes } from "@noble/hashes/utils.js";
import { Address } from "../../address/index.js";
import { Script } from "../../ckb/index.js";
import { Client } from "../../client/index.js";
import {
  JsonRpcScript,
  JsonRpcTransformers,
} from "../../client/jsonRpc/advanced.js";
import { hexFrom } from "../../hex/index.js";
import { JsonRpcError, RequestorJsonRpc } from "../../jsonRpc/index.js";
import { retry, sleep, waitForAvailability } from "../../utils/index.js";
import { Signer } from "../signer/index.js";
import {
  SignerJsonRpcErrorCode,
  type SignerJsonRpcResultRecord,
} from "./handler.js";
import { signerJsonRpcNetworkIdFromAddressPrefix } from "./network.js";
import {
  SignerJsonRpcInfo,
  SignerJsonRpcTransformers,
} from "./transformers.js";

export type SignerJsonRpcConfig = Omit<
  Parameters<typeof RequestorJsonRpc.new>[0],
  "onError"
> & {
  /** Cleans up integration-owned resources before replacement is announced. */
  disconnectHandler?: () => PromiseLike<void> | void;
};

const GET_RESULT_RETRY_DELAYS = [1_000, 2_000, 4_000, 8_000] as const;
const GET_RESULT_MIN_POLL_INTERVAL_MS = 5_000;
const GET_RESULT_RETRY_REPEAT_MS = 10_000;
const GET_RESULT_TIMEOUT_MS = 20_000;
const REQUEST_RETRY_DELAYS = [5_000, 10_000, 20_000] as const;
const REQUEST_TIMEOUT_MS = 10_000;

export class SignerJsonRpc extends Signer {
  private connecting?: Promise<void>;
  private disconnecting?: Promise<void>;
  private scriptsPromise?: Promise<Script[]>;
  private internalAddressPromise?: Promise<string>;
  private identityPromise?: Promise<string>;
  private requestsController = new AbortController();
  private readonly replacedListeners = new Set<() => void>();

  private constructor(
    client: Client,
    readonly requestor: RequestorJsonRpc,
    private info: SignerJsonRpcInfo,
    private readonly disconnectHandler?: () => PromiseLike<void> | void,
  ) {
    super(client);
  }

  /** Creates a Signer that borrows an existing Transport. */
  static async new(client: Client, config: SignerJsonRpcConfig) {
    const { disconnectHandler, ...requestorConfig } = config;
    const requestor = RequestorJsonRpc.new(requestorConfig);
    const signer = new SignerJsonRpc(
      client,
      requestor,
      {} as SignerJsonRpcInfo,
      disconnectHandler,
    );
    signer.info = (await signer.request(
      "get_info",
      [],
      [],
      SignerJsonRpcTransformers.infoTo,
    )) as SignerJsonRpcInfo;
    return signer;
  }

  get type() {
    return this.info.type;
  }

  get signType() {
    return this.info.signType;
  }

  get name() {
    return this.info.name;
  }

  get icon() {
    return this.info.icon;
  }

  connect(): Promise<void> {
    if (this.disconnecting) {
      return this.disconnecting.then(() => this.connect());
    }
    if (this.connecting) {
      return this.connecting;
    }

    const connecting = this.requestConnect(
      signerJsonRpcNetworkIdFromAddressPrefix(this.client.addressPrefix),
    ).catch((cause: unknown) => {
      if (this.connecting === connecting) {
        this.connecting = undefined;
      }
      throw cause;
    });
    this.connecting = connecting;
    return connecting;
  }

  disconnect(): Promise<void> {
    this.clearReadCache();
    if (this.disconnecting) {
      return this.disconnecting;
    }
    if (!this.connecting) {
      return Promise.resolve();
    }

    this.connecting = undefined;
    this.disconnecting = Promise.resolve()
      .then(() => this.disconnectHandler?.())
      .finally(() => {
        this.replace();
        this.disconnecting = undefined;
      });
    return this.disconnecting;
  }

  private requestConnect = this.buildSender("connect", []) as (
    networkId: string,
  ) => Promise<void>;

  onReplaced(listener: () => void) {
    this.replacedListeners.add(listener);
    return () => this.replacedListeners.delete(listener);
  }

  replace() {
    const requestsController = this.requestsController;
    this.requestsController = new AbortController();
    requestsController.abort(new Error("Signer JSON-RPC was replaced"));
    this.connecting = undefined;
    this.clearReadCache();
    const listeners = [...this.replacedListeners];
    this.replacedListeners.clear();
    listeners.forEach((listener) => listener());
  }

  async isConnected() {
    return (
      this.connecting?.then(
        () => true,
        () => false,
      ) ?? false
    );
  }

  getScripts(): Promise<Script[]> {
    if (this.scriptsPromise) {
      return this.scriptsPromise.then((scripts) => [...scripts]);
    }

    const pending = this.request(
      "get_scripts",
      [],
      [],
      (scripts: JsonRpcScript[]) =>
        scripts.map((script) => JsonRpcTransformers.scriptTo(script)),
    ).catch((cause: unknown) => {
      if (this.scriptsPromise === pending) {
        this.scriptsPromise = undefined;
      }
      throw cause;
    }) as Promise<Script[]>;
    this.scriptsPromise = pending;
    return pending.then((scripts) => [...scripts]);
  }

  async getAddressObjs() {
    return (await this.getScripts()).map((script) =>
      Address.fromScript(script, this.client),
    );
  }

  getInternalAddress(): Promise<string> {
    if (this.internalAddressPromise) {
      return this.internalAddressPromise;
    }

    const pending = this.request("get_native_address", [], []).catch(
      (cause: unknown) => {
        if (this.internalAddressPromise === pending) {
          this.internalAddressPromise = undefined;
        }
        throw cause;
      },
    ) as Promise<string>;
    this.internalAddressPromise = pending;
    return pending;
  }

  getIdentity(): Promise<string> {
    if (this.identityPromise) {
      return this.identityPromise;
    }

    const pending = this.request("get_identity", [], []).catch(
      (cause: unknown) => {
        if (this.identityPromise === pending) {
          this.identityPromise = undefined;
        }
        throw cause;
      },
    ) as Promise<string>;
    this.identityPromise = pending;
    return pending;
  }

  signMessageRaw = this.buildSender("sign_message", [
    SignerJsonRpcTransformers.messageFrom,
  ]) as Signer["signMessageRaw"];

  prepareTransaction = this.buildSender(
    "prepare_transaction",
    [JsonRpcTransformers.transactionFrom],
    JsonRpcTransformers.transactionTo,
  ) as Signer["prepareTransaction"];

  signOnlyTransaction = this.buildSender(
    "sign_transaction",
    [JsonRpcTransformers.transactionFrom],
    JsonRpcTransformers.transactionTo,
  ) as Signer["signOnlyTransaction"];

  buildSender(
    rpcMethod: Parameters<RequestorJsonRpc["request"]>[0],
    inTransformers?: Parameters<RequestorJsonRpc["request"]>[2],
    outTransformer?: Parameters<RequestorJsonRpc["request"]>[3],
  ): (...request: unknown[]) => Promise<unknown> {
    return async (...request: unknown[]) =>
      this.request(rpcMethod, request, inTransformers, outTransformer);
  }

  private clearReadCache() {
    this.scriptsPromise = undefined;
    this.internalAddressPromise = undefined;
    this.identityPromise = undefined;
  }

  private async request(
    method: string,
    params: unknown[],
    inTransformers?: Parameters<RequestorJsonRpc["request"]>[2],
    outTransformer?: Parameters<RequestorJsonRpc["request"]>[3],
  ): Promise<unknown> {
    const requestId = hexFrom(randomBytes(16));
    const sessionId = method === "get_info" ? undefined : this.info.sessionId;
    const signal = this.requestsController.signal;

    const result = retry(
      REQUEST_RETRY_DELAYS,
      async ({ resolve, reject }) => {
        try {
          return resolve(
            await this.requestor.request(
              method,
              [
                {
                  request_id: requestId,
                  ...(sessionId ? { session_id: sessionId } : {}),
                },
                ...params,
              ],
              inTransformers ? [undefined, ...inTransformers] : undefined,
              outTransformer,
              { signal, timeout: REQUEST_TIMEOUT_MS },
            ),
          );
        } catch (cause) {
          if (cause instanceof JsonRpcError) {
            return reject(cause);
          }
          throw cause;
        }
      },
      { signal },
    ).catch((cause: unknown) => {
      signal.throwIfAborted();
      if (
        cause instanceof JsonRpcError &&
        cause.code !== Number(SignerJsonRpcErrorCode.DuplicateRequestId)
      ) {
        throw cause;
      }

      return this.recoverResult(requestId, cause, signal, outTransformer);
    });

    try {
      const value = await result;
      signal.throwIfAborted();
      return value;
    } catch (cause) {
      if (
        cause instanceof JsonRpcError &&
        cause.code === Number(SignerJsonRpcErrorCode.InvalidSession)
      ) {
        this.replace();
      }
      throw cause;
    }
  }

  private async recoverResult(
    requestId: string,
    requestError: unknown,
    signal: AbortSignal,
    outTransformer?: Parameters<RequestorJsonRpc["request"]>[3],
  ) {
    return retry(
      [],
      async ({ resolve, reject, next }) => {
        try {
          let getResultStartedAt = Date.now();
          const result = await retry<SignerJsonRpcResultRecord>(
            GET_RESULT_RETRY_DELAYS,
            async ({ resolve, reject }) => {
              await waitForAvailability(signal);
              getResultStartedAt = Date.now();

              try {
                return resolve(
                  (await this.requestor.request(
                    "get_result",
                    [{}, requestId],
                    undefined,
                    undefined,
                    { signal, timeout: GET_RESULT_TIMEOUT_MS },
                  )) as SignerJsonRpcResultRecord,
                );
              } catch (cause) {
                if (cause instanceof JsonRpcError) {
                  return reject(cause);
                }
                throw cause;
              }
            },
            { repeat: GET_RESULT_RETRY_REPEAT_MS, signal },
          );
          signal.throwIfAborted();

          if (result.status === "not_found") {
            return reject(requestError);
          }
          if (result.status === "pending") {
            const remaining =
              GET_RESULT_MIN_POLL_INTERVAL_MS -
              (Date.now() - getResultStartedAt);
            if (remaining > 0) {
              await sleep(remaining, signal);
            }
            return next();
          }
          if (result.status !== "completed" || !("result" in result)) {
            return reject(new Error("Invalid signer request result"));
          }
          return resolve(
            outTransformer ? outTransformer(result.result) : result.result,
          );
        } catch (cause) {
          return reject(cause);
        }
      },
      { repeat: 0, signal },
    );
  }
}
