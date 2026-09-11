import WebSocket from "isomorphic-ws";
import { RequestorJsonRpc } from "../jsonRpc/requestor.js";
import type { ClientConfig } from "./client.js";
import { TESTNET_SCRIPTS } from "./clientPublicTestnet.advanced.js";
import { ClientJsonRpc, type ClientJsonRpcConfig } from "./jsonRpc/client.js";

/**
 * @public
 */
export class ClientPublicTestnet extends ClientJsonRpc {
  private static defaultUrls(): readonly [string, ...string[]] {
    return typeof WebSocket !== "undefined"
      ? [
          "wss://testnet.ckb.dev/ws",
          "https://testnet.ckb.dev/",
          "https://testnet.ckbapp.dev/",
        ]
      : ["https://testnet.ckb.dev/", "https://testnet.ckbapp.dev/"];
  }

  private static resolveConfig(
    config?: ClientJsonRpcConfig & {
      /** @deprecated URL belongs to Transport construction. */
      url?: string;
    },
  ): ClientJsonRpcConfig & { url: string; fallbacks: string[] } {
    const defaultUrls = this.defaultUrls();
    return {
      ...config,
      url: config?.url ?? defaultUrls[0],
      fallbacks: config?.fallbacks ?? [...defaultUrls],
      scripts: config?.scripts ?? TESTNET_SCRIPTS,
    };
  }

  /**
   * @deprecated Use {@link ClientPublicTestnet.new} with a borrowed Transport or
   * {@link ClientPublicTestnet.open} when creating Transports.
   */
  constructor(
    config?: ClientJsonRpcConfig & {
      /** @deprecated URL belongs to Transport construction. */
      url?: string;
    },
  ) {
    const resolved = ClientPublicTestnet.resolveConfig(config);
    super(resolved.url, resolved);
  }

  /** Creates a Client that borrows an existing Transport. */
  static new(
    config: Omit<Parameters<typeof RequestorJsonRpc.new>[0], "onError"> &
      ClientConfig,
  ): ClientPublicTestnet {
    const { cache, scripts, ...requestorConfig } = config;
    const requestor = this.newRequestor(requestorConfig);
    return new ClientPublicTestnet({ cache, scripts, requestor });
  }

  /** Opens a Client with explicit ownership of its default dependencies. */
  static open(
    config?: Omit<
      Parameters<typeof RequestorJsonRpc.open>[0],
      "onError" | "urls"
    > &
      ClientConfig & {
        urls?: Parameters<typeof RequestorJsonRpc.open>[0]["urls"];
      },
  ) {
    const {
      cache,
      scripts,
      urls = this.defaultUrls(),
      ...requestorConfig
    } = config ?? {};
    return this.openRequestor({
      ...requestorConfig,
      urls,
    }).map(
      (requestor) =>
        new ClientPublicTestnet({
          cache,
          scripts,
          requestor,
          url: urls[0],
          fallbacks: [...urls.slice(1)],
        }),
    );
  }

  get addressPrefix(): string {
    return "ckt";
  }
}
