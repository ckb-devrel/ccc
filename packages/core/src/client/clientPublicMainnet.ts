import WebSocket from "isomorphic-ws";
import { MAINNET_SCRIPTS } from "./clientPublicMainnet.advanced.js";
import { ScriptInfo, ScriptInfoLike } from "./clientTypes.js";
import { ClientJsonRpc, ClientJsonRpcConfig } from "./jsonRpc/index.js";
import { KnownScript } from "./knownScript.js";

/**
 * @public
 */
export class ClientPublicMainnet extends ClientJsonRpc {
  constructor(
    private readonly config?: ClientJsonRpcConfig & {
      url?: string;
      scripts?: Record<KnownScript, ScriptInfoLike | undefined>;
    },
  ) {
    const hasWebSocket = typeof WebSocket !== "undefined";
    super(
      config?.url ??
        (hasWebSocket
          ? "wss://mainnet.ckb.dev/ws"
          : "https://mainnet.ckb.dev/"),
      {
        ...config,
        fallbacks:
          config?.fallbacks ??
          (hasWebSocket
            ? [
                "wss://mainnet.ckb.dev/ws",
                "https://mainnet.ckb.dev/",
                "https://mainnet.ckbapp.dev/",
              ]
            : ["https://mainnet.ckb.dev/", "https://mainnet.ckbapp.dev/"]),
      },
    );
  }

  get scripts(): Record<KnownScript, ScriptInfoLike | undefined> {
    return this.config?.scripts ?? MAINNET_SCRIPTS;
  }

  get addressPrefix(): string {
    return "ckb";
  }

  async getKnownScript(script: KnownScript): Promise<ScriptInfo> {
    const found = this.scripts[script];
    if (!found) {
      throw new Error(
        `No script information was found for ${script} on ${this.addressPrefix}`,
      );
    }
    return ScriptInfo.from(found);
  }
}
