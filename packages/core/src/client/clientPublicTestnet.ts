import WebSocket from "isomorphic-ws";
import { TESTNET_SCRIPTS } from "./clientPublicTestnet.advanced.js";
import { KnownScript, ScriptInfo, ScriptInfoLike } from "./clientTypes.js";
import { ClientJsonRpc, ClientJsonRpcConfig } from "./jsonRpc/index.js";

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
    super(
      config?.url ??
        (typeof WebSocket !== "undefined"
          ? "wss://testnet.ckb.dev/ws"
          : "https://testnet.ckb.dev/"),
      config,
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
