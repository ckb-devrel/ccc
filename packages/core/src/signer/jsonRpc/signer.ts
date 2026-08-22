import { Address } from "../../address/index.js";
import { Script } from "../../ckb/index.js";
import { Client } from "../../client/index.js";
import {
  JsonRpcScript,
  JsonRpcTransformers,
} from "../../client/jsonRpc/advanced.js";
import { RequestorJsonRpc } from "../../jsonRpc/index.js";
import { Signer } from "../signer/index.js";
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

export class SignerJsonRpc extends Signer {
  private connecting?: Promise<void>;
  private disconnecting?: Promise<void>;
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
    const info = (await requestor.request(
      "get_info",
      [],
      [],
      SignerJsonRpcTransformers.infoTo,
    )) as SignerJsonRpcInfo;

    return new SignerJsonRpc(client, requestor, info, disconnectHandler);
  }

  get type() {
    return this.info.type;
  }

  get signType() {
    return this.info.signType;
  }

  get url() {
    return this.requestor.url;
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

    const connecting = this.requestConnect(this.client.addressPrefix).catch(
      (cause: unknown) => {
        if (this.connecting === connecting) {
          this.connecting = undefined;
        }
        throw cause;
      },
    );
    this.connecting = connecting;
    return connecting;
  }

  disconnect(): Promise<void> {
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

  onReplaced(listener: () => void) {
    this.replacedListeners.add(listener);
    return () => this.replacedListeners.delete(listener);
  }

  replace() {
    this.connecting = undefined;
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

  getScripts = this.buildSender("get_scripts", [], (scripts: JsonRpcScript[]) =>
    scripts.map((script) => JsonRpcTransformers.scriptTo(script)),
  ) as () => Promise<Script[]>;

  async getAddressObjs() {
    return (await this.getScripts()).map((script) =>
      Address.fromScript(script, this.client),
    );
  }

  getInternalAddress = this.buildSender(
    "get_native_address",
    [],
  ) as Signer["getInternalAddress"];

  getIdentity = this.buildSender("get_identity", []) as Signer["getIdentity"];

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
      this.requestor.request(
        rpcMethod,
        request,
        inTransformers,
        outTransformer,
      );
  }

  private requestConnect = this.buildSender("connect", []) as (
    addressPrefix: string,
  ) => Promise<void>;
}
