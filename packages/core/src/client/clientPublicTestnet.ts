import WebSocket from "isomorphic-ws";
import { RequestorJsonRpc } from "../jsonRpc/requestor.js";
import type { ClientConfig } from "./client.js";
import { TESTNET_SCRIPTS } from "./clientPublicTestnet.advanced.js";
import { ClientJsonRpc } from "./jsonRpc/client.js";

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

  private constructor(requestor: RequestorJsonRpc, config?: ClientConfig) {
    super(requestor, config);
  }

  /** Creates a Client that borrows an existing Transport. */
  static new(
    config: Omit<Parameters<typeof RequestorJsonRpc.new>[0], "onError"> &
      ClientConfig,
  ): ClientPublicTestnet {
    const {
      cache,
      scripts = TESTNET_SCRIPTS,
      addressResolver,
      ...requestorConfig
    } = config;
    const requestor = this.newRequestor(requestorConfig);
    return new ClientPublicTestnet(requestor, {
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
      scripts = TESTNET_SCRIPTS,
      addressResolver,
      urls = this.defaultUrls(),
      ...requestorConfig
    } = config ?? {};
    return this.openRequestor({
      ...requestorConfig,
      urls,
    }).map(
      (requestor) =>
        new ClientPublicTestnet(requestor, {
          cache,
          scripts,
          addressResolver,
        }),
    );
  }

  get addressPrefix(): string {
    return "ckt";
  }
}
