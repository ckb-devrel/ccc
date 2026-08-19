import { JsonRpcTransportHttp } from "./http.js";
import { JsonRpcTransportWebSocket } from "./webSocket.js";

export function jsonRpcTransportFromUri(
  uri: string,
  config?: { timeout?: number },
) {
  if (uri.startsWith("wss://") || uri.startsWith("ws://")) {
    return new JsonRpcTransportWebSocket(uri, config?.timeout);
  }

  return new JsonRpcTransportHttp(uri, config?.timeout);
}
