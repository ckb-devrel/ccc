import { OwnerUnique } from "../../utils/owner/unique.js";
import { JsonRpcTransportHttp } from "./http.js";
import { JsonRpcTransportWebSocket } from "./webSocket.js";

export function jsonRpcTransportFromUri(
  uri: string,
  config?: { timeout?: number },
) {
  if (uri.startsWith("wss://") || uri.startsWith("ws://")) {
    return JsonRpcTransportWebSocket.open(uri, config?.timeout);
  }

  return new OwnerUnique(
    new JsonRpcTransportHttp(uri, config?.timeout),
    () => {},
  );
}
