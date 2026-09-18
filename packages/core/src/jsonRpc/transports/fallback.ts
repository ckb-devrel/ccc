import {
  JsonRpcPayload,
  JsonRpcResponse,
  JsonRpcTransport,
  JsonRpcTransportRequestOptions,
} from "./transport.js";

export class JsonRpcTransportFallback implements JsonRpcTransport {
  // Current transport index
  private i = 0;

  constructor(private readonly transports: JsonRpcTransport[]) {}

  async request(
    data: JsonRpcPayload,
    options?: JsonRpcTransportRequestOptions,
  ): Promise<JsonRpcResponse> {
    const startI = this.i;
    let lastErr: unknown = new Error(
      "JsonRpcTransportFallback requires at least one transport",
    );

    for (let tried = 0; tried < this.transports.length; tried += 1) {
      const i = (startI + tried) % this.transports.length;

      try {
        const res = await this.transports[i].request(data, options);

        this.i = i;
        return res;
      } catch (err) {
        lastErr = err;
      }
    }

    throw lastErr;
  }
}
