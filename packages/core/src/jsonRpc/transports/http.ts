import { abortSignalAny } from "../../utils/abortSignal.js";
import {
  JsonRpcPayload,
  JsonRpcResponse,
  JsonRpcTransport,
  JsonRpcTransportRequestOptions,
} from "./transport.js";

export class JsonRpcTransportHttp implements JsonRpcTransport {
  constructor(
    private readonly url: string,
    private readonly timeout = 30000,
  ) {}

  async request(
    payload: JsonRpcPayload,
    options?: JsonRpcTransportRequestOptions,
  ): Promise<JsonRpcResponse> {
    const timeoutSignal = AbortSignal.timeout(options?.timeout ?? this.timeout);
    const signal = options?.signal
      ? abortSignalAny([options.signal, timeoutSignal])
      : timeoutSignal;

    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal,
    });
    // Reject HTTP errors here so fallback transports can try the next endpoint.
    if (!response.ok) {
      // Release the connection without waiting for an error body to finish.
      // A failed cleanup must not replace the HTTP status error.
      await response.body?.cancel().catch(() => {});
      throw new Error(`HTTP request failed with status ${response.status}`);
    }

    return (await response.json()) as JsonRpcResponse;
  }
}
