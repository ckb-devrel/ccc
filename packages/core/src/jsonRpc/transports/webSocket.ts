import WebSocket from "isomorphic-ws";
import { OwnerUnique } from "../../utils/owner/unique.js";
import {
  JsonRpcId,
  JsonRpcPayload,
  JsonRpcResponse,
  JsonRpcTransport,
  JsonRpcTransportRequestOptions,
} from "./transport.js";

const SOCKET_TIMEOUT_GRACE_PERIOD = 10_000;

export class JsonRpcTransportWebSocket implements JsonRpcTransport {
  private ongoing: Map<
    JsonRpcId,
    [
      (response: JsonRpcResponse) => unknown,
      (error: unknown) => unknown,
      WebSocket,
    ]
  > = new Map();
  private firstTimeout?: { socket: WebSocket; at: number };
  private disposed = false;
  private socket?: WebSocket;
  private openSocket?: Promise<WebSocket>;

  /**
   * @deprecated Use {@link JsonRpcTransportWebSocket.open} to make lifecycle
   * ownership explicit. This constructor will become private in a future
   * release.
   */
  constructor(
    private readonly url: string,
    private readonly timeout = 30000,
  ) {}

  /** Opens an owned WebSocket transport. */
  static open(
    url: string,
    timeout = 30000,
  ): OwnerUnique<JsonRpcTransportWebSocket> {
    const transport = new JsonRpcTransportWebSocket(url, timeout);
    return new OwnerUnique(transport, (transport) => transport.dispose());
  }

  request(
    data: JsonRpcPayload,
    options?: JsonRpcTransportRequestOptions,
  ): Promise<JsonRpcResponse> {
    if (this.disposed) {
      return Promise.reject(
        new Error("Cannot use a disposed JsonRpcTransportWebSocket"),
      );
    }
    if (options?.signal?.aborted) {
      return Promise.reject(
        options.signal.reason ?? new Error("Request aborted"),
      );
    }

    const [socketUnsafe, socket] = (() => {
      if (
        this.socket &&
        this.socket.readyState !== this.socket.CLOSING &&
        this.socket.readyState !== this.socket.CLOSED &&
        this.openSocket
      ) {
        return [this.socket, this.openSocket] as const;
      }
      const socket = new WebSocket(this.url);
      const onMessage = ({ data }: WebSocket.MessageEvent) => {
        let res: JsonRpcResponse;
        try {
          res = JSON.parse(data as string) as JsonRpcResponse;
        } catch (_) {
          return;
        }
        if (
          typeof res !== "object" ||
          res === null ||
          (typeof res.id !== "number" && typeof res.id !== "string")
        ) {
          return;
        }
        const id = res.id;
        if (this.firstTimeout?.socket === socket) {
          this.firstTimeout = undefined;
        }

        const req = this.ongoing.get(id);
        if (!req || req[2] !== socket) {
          return;
        }
        const [resolve] = req;
        resolve(res);
      };
      const onClose = () => {
        if (this.firstTimeout?.socket === socket) {
          this.firstTimeout = undefined;
        }
        this.ongoing.forEach(([_, reject, requestSocket]) => {
          if (requestSocket === socket) {
            reject(new Error("Connection closed"));
          }
        });
      };

      socket.onclose = onClose;
      socket.onerror = onClose;
      socket.onmessage = onMessage;

      this.socket = socket;
      this.openSocket = new Promise<WebSocket>((resolve) => {
        if (socket.readyState === socket.OPEN) {
          resolve(socket);
        } else {
          socket.onopen = () => {
            resolve(socket);
          };
        }
      });
      return [socket, this.openSocket] as const;
    })();

    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const abortSignal = options?.signal;
      let timeout: ReturnType<typeof setTimeout>;
      const req: [
        (res: JsonRpcResponse) => unknown,
        (err: unknown) => unknown,
        WebSocket,
      ] = [
        (response) => {
          if (cleanup()) {
            resolve(response);
          }
        },
        (error) => {
          if (cleanup()) {
            reject(error);
          }
        },
        socketUnsafe,
      ];
      const cleanup = () => {
        if (this.ongoing.get(data.id) !== req) {
          return false;
        }
        this.ongoing.delete(data.id);
        clearTimeout(timeout);
        abortSignal?.removeEventListener("abort", onAbort);
        return true;
      };
      const onAbort = () => {
        req[1](abortSignal?.reason ?? new Error("Request aborted"));
      };

      timeout = setTimeout(() => {
        if (this.ongoing.get(data.id) === req) {
          req[1](new Error("Request timeout"));
          const hasPending = [...this.ongoing.values()].some(
            ([, , requestSocket]) => requestSocket === socketUnsafe,
          );
          if (!hasPending) {
            socketUnsafe.close();
            return;
          }

          const firstTimeout = this.firstTimeout;
          if (firstTimeout?.socket !== socketUnsafe) {
            this.firstTimeout = { socket: socketUnsafe, at: Date.now() };
          } else if (
            Date.now() - firstTimeout.at >=
            SOCKET_TIMEOUT_GRACE_PERIOD
          ) {
            socketUnsafe.close();
          }
        }
      }, options?.timeout ?? this.timeout);
      this.ongoing.set(data.id, req);

      abortSignal?.addEventListener("abort", onAbort, { once: true });
      if (abortSignal?.aborted) {
        onAbort();
        return;
      }

      void socket
        .then((socket) => {
          if (this.ongoing.get(data.id) !== req) {
            return;
          }
          if (
            socket.readyState === socket.CLOSED ||
            socket.readyState === socket.CLOSING
          ) {
            req[1](new Error("Connection closed"));
          } else {
            socket.send(JSON.stringify(data));
          }
        })
        .catch((err) => {
          req[1](err);
        });
    });
  }

  private async dispose(): Promise<void> {
    this.disposed = true;
    const socket = this.socket;

    if (!socket || socket.readyState === socket.CLOSED) {
      return;
    }

    await new Promise<void>((resolve) => {
      socket.addEventListener("close", () => resolve(), { once: true });
      socket.close();
    });
  }
}
