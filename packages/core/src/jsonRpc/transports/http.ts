import {
  JsonRpcPayload,
  JsonRpcResponse,
  JsonRpcTransport,
} from "./transport.js";

export class JsonRpcTransportHttp implements JsonRpcTransport {
  constructor(
    private readonly url: string,
    private readonly timeout = 30000,
  ) {}

  async request(payload: JsonRpcPayload): Promise<JsonRpcResponse> {
    const aborter = new AbortController();
    const abortTimer = setTimeout(() => aborter.abort(), this.timeout);

    try {
      return (await (
        await fetch(this.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: aborter.signal,
        })
      ).json()) as JsonRpcResponse;
    } finally {
      clearTimeout(abortTimer);
    }
  }
}
