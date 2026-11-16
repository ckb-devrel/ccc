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
      // Start releasing the connection, but don't await cancellation: a cloned
      // response can keep it pending until the other branch finishes reading.
      try {
        void response.body?.cancel().catch(() => {});
      } catch {
        // A failed cleanup must not replace the HTTP status error.
      }
      throw new Error(`HTTP request failed with status ${response.status}`);
    }

    return (await response.json()) as JsonRpcResponse;
  }
}
