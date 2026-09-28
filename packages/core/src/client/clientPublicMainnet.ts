import WebSocket from "isomorphic-ws";
import { RequestorJsonRpc } from "../jsonRpc/requestor.js";
import type { ClientConfig } from "./client.js";
import { MAINNET_SCRIPTS } from "./clientPublicMainnet.advanced.js";
import { ClientJsonRpc } from "./jsonRpc/client.js";

/**
 * @public
 */
export class ClientPublicMainnet extends ClientJsonRpc {
  private static defaultUrls(): readonly [string, ...string[]] {
    return typeof WebSocket !== "undefined"
      ? [
          "wss://mainnet.ckb.dev/ws",
          "https://mainnet.ckb.dev/",
          "https://mainnet.ckbapp.dev/",
        ]
      : ["https://mainnet.ckb.dev/", "https://mainnet.ckbapp.dev/"];
  }

  private constructor(requestor: RequestorJsonRpc, config?: ClientConfig) {
    super(requestor, config);
  }

  /** Creates a Client that borrows an existing Transport. */
  static new(
    config: Omit<Parameters<typeof RequestorJsonRpc.new>[0], "onError"> &
      ClientConfig,
  ): ClientPublicMainnet {
    const {
      cache,
      scripts = MAINNET_SCRIPTS,
      addressResolver,
      ...requestorConfig
    } = config;
    const requestor = this.newRequestor(requestorConfig);
    return new ClientPublicMainnet(requestor, {
      cache,
      scripts,
      addressResolver,
    });
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
      scripts = MAINNET_SCRIPTS,
      addressResolver,
      urls = this.defaultUrls(),
      ...requestorConfig
    } = config ?? {};
    return this.openRequestor({
      ...requestorConfig,
      urls,
    }).map(
      (requestor) =>
        new ClientPublicMainnet(requestor, {
          cache,
          scripts,
          addressResolver,
        }),
    );
  }

  get addressPrefix(): string {
    return "ckb";
  }
}
