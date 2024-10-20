import WebSocket from "isomorphic-ws";
import { ClientCache } from "./cache/index.js";
import { MAINNET_SCRIPTS } from "./clientPublicMainnet.advanced.js";
import { KnownScript, ScriptInfo } from "./clientTypes.js";
import { ClientJsonRpc } from "./jsonRpc/index.js";

/**
 * @public
 */
export class ClientPublicMainnet extends ClientJsonRpc {
  constructor(
    private readonly config?: {
      url?: string;
      timeout?: number;
      scripts?: typeof MAINNET_SCRIPTS;
      cache?: ClientCache;
    },
  ) {
    super(
      config?.url ??
        (typeof WebSocket !== "undefined"
          ? "wss://mainnet.ckb.dev/ws"
          : "https://mainnet.ckb.dev/"),
      config,
    );
  }

  get scripts(): typeof MAINNET_SCRIPTS {
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
