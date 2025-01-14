import { JsonRpcPayload, Transport } from "./transport.js";

export class TransportFallback implements Transport {
  // Current transport index
  private i = 0;

  constructor(private readonly transports: Transport[]) {}

  async request(data: JsonRpcPayload): Promise<unknown> {
    let triedCount = 0;

    while (true) {
      try {
        return await this.transports[this.i % this.transports.length].request(
          data,
        );
      } catch (err) {
        triedCount += 1;
        this.i += 1;

        if (triedCount >= this.transports.length) {
          throw err;
        }
      }
    }
  }
}
