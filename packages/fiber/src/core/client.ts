import axios, { AxiosInstance } from "axios";

export interface FiberClientConfig {
  baseURL: string;
  timeout?: number;
}

export class FiberClient {
  private client: AxiosInstance;

  constructor(config: FiberClientConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 5000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  private serializeBigInt(obj: any): any {
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
      const result: any = {};
      for (const key in obj) {
        if (key === "peer_id") {
          result[key] = obj[key];
        } else if (key === "channel_id") {
          result[key] = obj[key];
        } else if (
          typeof obj[key] === "bigint" ||
          typeof obj[key] === "number"
        ) {
          result[key] = "0x" + obj[key].toString(16);
        } else {
          result[key] = this.serializeBigInt(obj[key]);
        }
      }
      return result;
    }
    return obj;
  }

  async call<T = any>(method: string, params?: any): Promise<T> {
    const serializedParams = params ? this.serializeBigInt(params) : undefined;
    const payload = {
      jsonrpc: "2.0",
      method,
      params: serializedParams ? [serializedParams] : [],
      id: 1,
    };

    console.log("发送 RPC 请求:", JSON.stringify(payload, null, 2));

    const response = await this.client.post("", payload);

    if (response.data.error) {
      throw new Error(
        `[RPC Error ${response.data.error.code}] ${response.data.error.message}${
          response.data.error.data
            ? "\nDetails: " + response.data.error.data
            : ""
        }`,
      );
    }

    return response.data.result;
  }
}

export class RPCError extends Error {
  constructor(
    public error: {
      code: number;
      message: string;
      data?: any;
    },
  ) {
    super(`[RPC Error ${error.code}] ${error.message}`);
  }
}
