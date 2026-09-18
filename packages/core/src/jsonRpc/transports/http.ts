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

    return (await (
      await fetch(this.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal,
      })
    ).json()) as JsonRpcResponse;
  }
}
