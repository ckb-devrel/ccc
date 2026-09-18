import { ccc, JsonRpcError } from "@ckb-ccc/core";
import type { Connection, PeerId, Stream } from "@libp2p/interface";
import type { Registrar } from "@libp2p/interface-internal";
import { lpStream } from "@libp2p/utils";

const DEFAULT_MAX_MESSAGE_LENGTH = 1024 * 1024;
const DEFAULT_TIMEOUT = 30_000;

export type JsonRpcServiceComponents = {
  registrar: Registrar;
};

export type JsonRpcServiceConfig = {
  protocol: string;
  maxMessageLength?: number;
  timeout?: number;
};

export type JsonRpcRequest = {
  connection: Connection;
  peerId: PeerId;
  payload: ccc.JsonRpcPayload;
  /** Aborts if the service times out or the request stream closes. */
  signal: AbortSignal;
};

export type JsonRpcRequestHandler<
  Components extends JsonRpcServiceComponents = JsonRpcServiceComponents,
> = (this: JsonRpcService<Components>, request: JsonRpcRequest) => unknown;

export abstract class JsonRpcService<
  Components extends JsonRpcServiceComponents = JsonRpcServiceComponents,
> {
  private readonly errorListeners = new Set<(error: Error) => void>();
  readonly maxMessageLength: number;
  readonly timeout: number;

  constructor(
    readonly components: Components,
    readonly config: JsonRpcServiceConfig,
  ) {
    const maxMessageLength =
      config.maxMessageLength ?? DEFAULT_MAX_MESSAGE_LENGTH;
    if (!Number.isSafeInteger(maxMessageLength) || maxMessageLength <= 0) {
      throw new Error(
        "Maximum JSON-RPC message length must be a positive integer",
      );
    }

    this.maxMessageLength = maxMessageLength;

    const timeout = config.timeout ?? DEFAULT_TIMEOUT;
    if (!Number.isSafeInteger(timeout) || timeout <= 0) {
      throw new Error("JSON-RPC request timeout must be a positive integer");
    }

    this.timeout = timeout;
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
    let requestAborted = false;
    const controller = new AbortController();
    const timeoutSignal = AbortSignal.timeout(this.timeout);
    const abortRequest = (event: { error?: Error }) => {
      requestAborted = true;
      const error = new Error(event.error?.message ?? "JSON-RPC stream closed");
      error.name = "AbortError";
      controller.abort(error);
    };
    const abortTimeout = () => {
      requestAborted = true;
      const error = abortReason(timeoutSignal, "JSON-RPC request timed out");
      controller.abort(error);
      stream.abort(error);
    };
    stream.addEventListener("close", abortRequest, { once: true });
    timeoutSignal.addEventListener("abort", abortTimeout, { once: true });
    if (stream.status !== "open") {
      abortRequest({});
    }

    try {
      const rpcStream = lpStream(stream, {
        maxDataLength: this.maxMessageLength,
      });
      const payload = parseJsonRpcRequest(
        ccc.bytesTo(
          (await rpcStream.read({ signal: controller.signal })).subarray(),
          "utf8",
        ),
      );

      let response: ccc.JsonRpcResponse;
      try {
        controller.signal.throwIfAborted();
        response = {
          jsonrpc: "2.0",
          id: payload.id,
          result: await Promise.race([
            Promise.resolve(
              this.handleRequest({
                connection,
                peerId: connection.remotePeer,
                payload,
                signal: controller.signal,
              }),
            ),
            ccc.abortSignalToPromise(controller.signal),
          ]),
        };
      } catch (cause) {
        requestAborted ||= isAbortError(cause);
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

      await rpcStream.write(ccc.bytesFrom(JSON.stringify(response), "utf8"), {
        signal: controller.signal,
      });
      stream.removeEventListener("close", abortRequest);
      await stream.close({ signal: controller.signal });
    } catch (cause) {
      if (requestAborted) {
        return;
      }
      this.handleError(cause, stream);
    } finally {
      stream.removeEventListener("close", abortRequest);
      timeoutSignal.removeEventListener("abort", abortTimeout);
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

  return new JsonRpcError({
    code: -32603,
    message: asJsonRpcError(cause).message,
  });
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

function abortReason(signal: AbortSignal, fallback: string) {
  return signal.reason instanceof Error ? signal.reason : new Error(fallback);
}

function isAbortError(cause: unknown) {
  return (
    cause instanceof Error &&
    (cause.name === "AbortError" || cause.name === "TimeoutError")
  );
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
