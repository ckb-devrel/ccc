import {
  JsonRpcPayload,
  JsonRpcResponse,
  JsonRpcTransport,
} from "./transport.js";

export class JsonRpcTransportFallback implements JsonRpcTransport {
  // Current transport index
  private i = 0;

  constructor(private readonly transports: JsonRpcTransport[]) {}

  async request(data: JsonRpcPayload): Promise<JsonRpcResponse> {
    const startI = this.i;
    let lastErr: unknown = new Error(
      "JsonRpcTransportFallback requires at least one transport",
    );

    for (let tried = 0; tried < this.transports.length; tried += 1) {
      const i = (startI + tried) % this.transports.length;

      try {
        const res = await this.transports[i].request(data);

        this.i = i;
        return res;
      } catch (err) {
        lastErr = err;
      }
    }

    throw lastErr;
  }

  async close(): Promise<void> {
    await Promise.all(
      this.transports.map(async (transport) => transport.close()),
    );
  }
}
