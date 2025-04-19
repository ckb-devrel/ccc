import { RequestorJsonRpc, RequestorJsonRpcConfig } from "@ckb-ccc/core";

export interface ClientConfig extends RequestorJsonRpcConfig {
  endpoint: string;
}

interface AcceptChannelParams {
  temporary_channel_id: string;
  funding_amount: bigint;
  max_tlc_value_in_flight: bigint;
  max_tlc_number_in_flight: bigint;
  tlc_min_value: bigint;
  tlc_fee_proportional_millionths: bigint;
  tlc_expiry_delta: bigint;
}

interface AcceptChannelResponse {
  channel_id: string;
}

export class RPCError extends Error {
  constructor(
    public error: {
      code: number;
      message: string;
      data?: unknown;
    },
  ) {
    super(`[RPC Error ${error.code}] ${error.message}`);
    this.name = "RPCError";
  }
}

export class FiberClient {
  private requestor: RequestorJsonRpc;

  constructor(config: ClientConfig) {
    this.requestor = new RequestorJsonRpc(config.endpoint, {
      timeout: config.timeout,
      maxConcurrent: config.maxConcurrent,
      fallbacks: config.fallbacks,
      transport: config.transport,
    });
  }

  private serializeBigInt(obj: unknown): unknown {
    if (typeof obj === "bigint") {
      const hex = obj.toString(16);
      return "0x" + hex;
    }
    if (typeof obj === "number") {
      const hex = obj.toString(16);
      return "0x" + hex;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.serializeBigInt(item));
    }
    if (obj !== null && typeof obj === "object") {
      if (Object.keys(obj).length === 0) {
        return obj;
      }
      const result: Record<string, unknown> = {};
      const typedObj = obj as Record<string, unknown>;
      for (const key in typedObj) {
        if (key === "peer_id") {
          result[key] = typedObj[key];
        } else if (key === "channel_id") {
          result[key] = typedObj[key];
        } else if (
          typeof typedObj[key] === "bigint" ||
          typeof typedObj[key] === "number"
        ) {
          result[key] = "0x" + typedObj[key].toString(16);
        } else {
          result[key] = this.serializeBigInt(typedObj[key]);
        }
      }
      return result;
    }
    return obj;
  }

  async call<T>(method: string, params: unknown[]): Promise<T> {
    if (params.length === 0 || (params.length === 1 && params[0] === null)) {
      params = [];
    }

    const serializedParams = params.map((param) => {
      if (param === null || param === undefined) {
        return {};
      }
      return this.serializeBigInt(param);
    });

    try {
      const result = await this.requestor.request(method, serializedParams);
      if (!result && result !== null) {
        throw new RPCError({
          code: -1,
          message: `RPC method "${method}" failed`,
          data: undefined,
        });
      }
      return result as T;
    } catch (error) {
      console.log(error);
      if (error instanceof Error) {
        if (error.message.includes("Method not found")) {
          throw new RPCError({
            code: -32601,
            message: `RPC method "${method}" not found`,
            data: undefined,
          });
        }
        throw new RPCError({
          code: -1,
          message: error.message,
          data: undefined,
        });
      }
      throw error;
    }
  }

  async acceptChannel(
    params: AcceptChannelParams,
  ): Promise<AcceptChannelResponse> {
    const transformedParams = {
      temporary_channel_id: params.temporary_channel_id,
      funding_amount: params.funding_amount,
      max_tlc_value_in_flight: params.max_tlc_value_in_flight,
      max_tlc_number_in_flight: params.max_tlc_number_in_flight,
      tlc_min_value: params.tlc_min_value,
      tlc_fee_proportional_millionths: params.tlc_fee_proportional_millionths,
      tlc_expiry_delta: params.tlc_expiry_delta,
    };

    return this.call<AcceptChannelResponse>("accept_channel", [
      transformedParams,
    ]);
  }
}
