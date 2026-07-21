import { JsonRpcPayload, Transport } from "./transport.js";

export class TransportFallback implements Transport {
  // Current transport index
  private i = 0;

  constructor(private readonly transports: Transport[]) {}

  async request(data: JsonRpcPayload): Promise<unknown> {
    const startI = this.i;
    let lastErr: unknown = new Error(
      "TransportFallback requires at least one transport",
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
}
