import { ccc } from "@ckb-ccc/core";
import { camelToSnake, snakeToCamel } from "./keys.js";

/**
 * Serializes JavaScript values for Fiber JSON-RPC: bigint and number become hex strings.
 * Other values are passed through; objects and arrays are traversed recursively.
 */
export function serializeRpcParams(value: unknown): unknown {
  if (typeof value === "bigint" || typeof value === "number") {
    return "0x" + value.toString(16);
  }
  if (Array.isArray(value)) {
    return value.map(serializeRpcParams);
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Object.keys(obj).length === 0) return obj;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      out[key] = serializeRpcParams(obj[key]);
    }
    return out;
  }
  return value;
}

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

  async call<T>(method: string, params: unknown[]): Promise<T> {
    const serialized = (params ?? []).map((p) =>
      serializeRpcParams(camelToSnake(p)),
    );
    const result = await this.request(method, serialized);
    return snakeToCamel(result) as T;
  }

  private async request(
    method: string,
    serialized: unknown[],
  ): Promise<unknown> {
    const result = await this.requestor.request(method, serialized);
    if (result === undefined) {
      throw new Error(`RPC method "${method}" failed`);
    }
    return result;
  }
}
