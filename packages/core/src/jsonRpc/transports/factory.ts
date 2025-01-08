import { TransportHttp } from "./http.js";
import { TransportWebSocket } from "./webSocket.js";

export function transportFromUri(uri: string, config?: { timeout?: number }) {
  if (uri.startsWith("wss://") || uri.startsWith("ws://")) {
    return new TransportWebSocket(uri, config?.timeout);
  }

  return new TransportHttp(uri, config?.timeout);
}
