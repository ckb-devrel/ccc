import WebSocket from "isomorphic-ws";
import {
  JsonRpcId,
  JsonRpcPayload,
  JsonRpcResponse,
  JsonRpcTransport,
} from "./transport.js";

export class JsonRpcTransportWebSocket implements JsonRpcTransport {
  private ongoing: Map<
    JsonRpcId,
    [
      (response: JsonRpcResponse) => unknown,
      (error: unknown) => unknown,
      ReturnType<typeof setTimeout>,
    ]
  > = new Map();
  private socket?: WebSocket;
  private openSocket?: Promise<WebSocket>;

  constructor(
    private readonly url: string,
    private readonly timeout = 30000,
  ) {}

  request(data: JsonRpcPayload): Promise<JsonRpcResponse> {
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

        const req = this.ongoing.get(id);
        if (!req) {
          return;
        }
        const [resolve, _, timeout] = req;
        clearTimeout(timeout);
        this.ongoing.delete(id);

        resolve(res);
      };
      const onClose = () => {
        this.ongoing.forEach(([_, reject, timeout]) => {
          clearTimeout(timeout);
          reject(new Error("Connection closed"));
        });
        this.ongoing.clear();
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
      const req: [
        (res: JsonRpcResponse) => unknown,
        (err: unknown) => unknown,
        ReturnType<typeof setTimeout>,
      ] = [
        resolve,
        reject,
        setTimeout(() => {
          this.ongoing.delete(data.id);
          socketUnsafe.close();
          reject(new Error("Request timeout"));
        }, this.timeout),
      ];
      this.ongoing.set(data.id, req);

      void socket
        .then((socket) => {
          if (!this.ongoing.has(data.id)) {
            return;
          }
          if (
            socket.readyState === socket.CLOSED ||
            socket.readyState === socket.CLOSING
          ) {
            clearTimeout(req[2]);
            this.ongoing.delete(data.id);
            reject(new Error("Connection closed"));
          } else {
            socket.send(JSON.stringify(data));
          }
        })
        .catch((err) => {
          clearTimeout(req[2]);
          this.ongoing.delete(data.id);
          reject(err);
        });
    });
  }

  async close(): Promise<void> {
    const socket = this.socket;

    if (!socket || socket.readyState === socket.CLOSED) return;

    await new Promise<void>((resolve) => {
      socket.addEventListener("close", () => resolve(), { once: true });
      socket.close();
    });
  }
}
