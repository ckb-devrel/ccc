import { ccc } from "@ckb-ccc/core";
import type { Connection, PeerId, Stream } from "@libp2p/interface";
import type { Registrar } from "@libp2p/interface-internal";
import { lpStream } from "@libp2p/utils";

const defaultMaxMessageLength = 1024 * 1024;

export type JsonRpcServiceComponents = {
  registrar: Registrar;
};

export type JsonRpcServiceConfig = {
  protocol: string;
  maxMessageLength?: number;
};

export type JsonRpcRequest = {
  peerId: PeerId;
  payload: ccc.JsonRpcPayload;
};

export type JsonRpcRequestHandler<
  Components extends JsonRpcServiceComponents = JsonRpcServiceComponents,
> = (this: JsonRpcService<Components>, request: JsonRpcRequest) => unknown;

export class JsonRpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "JsonRpcError";
  }
}

export abstract class JsonRpcService<
  Components extends JsonRpcServiceComponents = JsonRpcServiceComponents,
> {
  private readonly errorListeners = new Set<(error: Error) => void>();
  readonly maxMessageLength: number;

  constructor(
    readonly components: Components,
    readonly config: JsonRpcServiceConfig,
  ) {
    const maxMessageLength = config.maxMessageLength ?? defaultMaxMessageLength;
    if (!Number.isSafeInteger(maxMessageLength) || maxMessageLength <= 0) {
      throw new Error(
        "Maximum JSON-RPC message length must be a positive integer",
      );
    }

    this.maxMessageLength = maxMessageLength;
  }

  protected abstract handleRequest(request: JsonRpcRequest): unknown;

  onError(listener: (error: Error) => void) {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  async start() {
    await this.components.registrar.handle(
      this.config.protocol,
      this.handleProtocol.bind(this),
      { runOnLimitedConnection: true },
    );
  }

  async stop() {
    await this.components.registrar.unhandle(this.config.protocol);
  }

  private async handleProtocol(stream: Stream, connection: Connection) {
    try {
      const rpcStream = lpStream(stream, {
        maxDataLength: this.maxMessageLength,
      });
      const payload = parseJsonRpcRequest(
        ccc.bytesTo((await rpcStream.read()).subarray(), "utf8"),
      );

      let response: ccc.JsonRpcResponse;
      try {
        response = {
          jsonrpc: "2.0",
          id: payload.id,
          result: await this.handleRequest({
            peerId: connection.remotePeer,
            payload,
          }),
        };
      } catch (cause) {
        const error = toJsonRpcError(cause);
        response = {
          jsonrpc: "2.0",
          id: payload.id,
          error: {
            code: error.code,
            message: error.message,
            data: error.data,
          },
        };
      }

      await rpcStream.write(ccc.bytesFrom(JSON.stringify(response), "utf8"));
      await stream.close();
    } catch (cause) {
      this.handleError(cause, stream);
    }
  }

  private handleError(cause: unknown, stream?: Stream) {
    const error = asJsonRpcError(cause);

    stream?.abort(error);
    this.errorListeners.forEach((listener) => listener(error));
    return error;
  }
}

function toJsonRpcError(cause: unknown) {
  if (cause instanceof JsonRpcError) {
    return cause;
  }

  return new JsonRpcError(-32603, asJsonRpcError(cause).message);
}

function parseJsonRpcRequest(data: string) {
  const payload = JSON.parse(data) as Partial<ccc.JsonRpcPayload>;
  if (
    payload?.jsonrpc !== "2.0" ||
    (typeof payload.id !== "number" && typeof payload.id !== "string") ||
    typeof payload.method !== "string"
  ) {
    throw new Error("Invalid JSON-RPC request");
  }

  return payload as ccc.JsonRpcPayload;
}

function asJsonRpcError(cause: unknown) {
  return cause instanceof Error ? cause : new Error("JSON-RPC request failed");
}

export function jsonRpcService<
  Components extends JsonRpcServiceComponents = JsonRpcServiceComponents,
>(
  config: JsonRpcServiceConfig,
  handler: JsonRpcRequestHandler<Components>,
): (components: Components) => JsonRpcService<Components> {
  return (components: Components) =>
    new (class extends JsonRpcService<Components> {
      protected handleRequest(request: JsonRpcRequest) {
        return handler.call(this, request);
      }
    })(components, config);
}
