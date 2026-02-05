import { ccc } from "@ckb-ccc/core";
import { camelToSnake, snakeToCamel } from "../keys.js";
import { RPCError } from "./error.js";
import { serializeRpcParams } from "./serialize.js";

export interface FiberClientConfig extends ccc.RequestorJsonRpcConfig {
  endpoint: string;
}

/**
 * Low-level JSON-RPC client for the Fiber node API.
 * Serializes params (bigint/number → hex) and forwards requests.
 */
export class FiberClient {
  private readonly requestor: ccc.RequestorJsonRpc;

  constructor(config: FiberClientConfig) {
    this.requestor = new ccc.RequestorJsonRpc(config.endpoint, {
      timeout: config.timeout,
      maxConcurrent: config.maxConcurrent,
      fallbacks: config.fallbacks,
      transport: config.transport,
    });
  }

  /**
   * Call a Fiber RPC method. Params are serialized for JSON (bigint/number → hex).
   * Use this when you already have snake_case params (e.g. raw RPC).
   */
  async call<T>(method: string, params: unknown[]): Promise<T> {
    const normalized =
      params.length === 0 || (params.length === 1 && params[0] === null)
        ? []
        : params;
    const serialized = normalized.map((p) =>
      p === null || p === undefined ? {} : serializeRpcParams(p),
    );
    return this.request(method, serialized) as Promise<T>;
  }

  /**
   * Call a Fiber RPC method with camelCase params; converts to snake_case for the wire and result back to camelCase.
   * Use this for the public SDK API.
   */
  async callCamel<T>(method: string, params: unknown[]): Promise<T> {
    const normalized =
      params.length === 0 || (params.length === 1 && params[0] === null)
        ? []
        : params;
    const snakeParams = normalized.map((p) =>
      p === null || p === undefined ? {} : camelToSnake(p),
    );
    const serialized = snakeParams.map((p) =>
      p === null || p === undefined ? {} : serializeRpcParams(p),
    );
    const result = await this.request(method, serialized);
    return snakeToCamel(result) as T;
  }

  private async request(
    method: string,
    serialized: unknown[],
  ): Promise<unknown> {
    try {
      const result = await this.requestor.request(method, serialized);
      if (result === undefined) {
        throw new RPCError({
          code: -1,
          message: `RPC method "${method}" failed`,
        });
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Method not found")) {
        throw new RPCError({
          code: -32601,
          message: `RPC method "${method}" not found`,
        });
      }
      throw new RPCError({ code: -1, message });
    }
  }
}
