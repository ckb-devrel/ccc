import WebSocket from "isomorphic-ws";
import { TESTNET_SCRIPTS } from "./clientPublicTestnet.advanced.js";
import { ScriptInfo, ScriptInfoLike } from "./clientTypes.js";
import { ClientJsonRpc, ClientJsonRpcConfig } from "./jsonRpc/index.js";
import { KnownScript } from "./knownScript.js";

/**
 * @public
 */
export class ClientPublicTestnet extends ClientJsonRpc {
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
          ? "wss://testnet.ckb.dev/ws"
          : "https://testnet.ckb.dev/"),
      {
        ...config,
        fallbacks:
          config?.fallbacks ??
          (hasWebSocket
            ? [
                "wss://testnet.ckb.dev/ws",
                "https://testnet.ckb.dev/",
                "https://testnet.ckbapp.dev/",
              ]
            : ["https://testnet.ckb.dev/", "https://testnet.ckbapp.dev/"]),
      },
    );
  }

  get scripts(): Record<KnownScript, ScriptInfoLike | undefined> {
    return this.config?.scripts ?? TESTNET_SCRIPTS;
  }

  get addressPrefix(): string {
    return "ckt";
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
