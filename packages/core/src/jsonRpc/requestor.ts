import { abortSignalToPromise } from "../utils/abortSignal.js";
import { OwnerAggregated } from "../utils/owner/aggregated.js";
import { Owner } from "../utils/owner/owner.js";
import { jsonRpcTransportFromUri } from "./transports/factory.js";
import { JsonRpcTransportFallback } from "./transports/fallback.js";
import {
  JsonRpcError,
  JsonRpcPayload,
  JsonRpcResponse,
  JsonRpcTransport,
  JsonRpcTransportRequestOptions,
} from "./transports/index.js";

function openTransports(
  urls: readonly [string, ...string[]],
  config?: { timeout?: number },
): Owner<JsonRpcTransportFallback> {
  const transportOwners = Array.from(new Set(urls), (url) =>
    jsonRpcTransportFromUri(url, config),
  );
  return OwnerAggregated.from(transportOwners).map(
    (transports) => new JsonRpcTransportFallback([...transports]),
  );
}

/**
 * Applies a transformation function to a value if the transformer is provided.
 *
 * @param value - The value to be transformed.
 * @param transformer - An optional transformation function.
 * @returns The transformed value if a transformer is provided, otherwise the original value.
 *
 * @example
 * ```typescript
 * const result = transform(5, (x) => x * 2); // Outputs 10
 * const resultWithoutTransformer = transform(5); // Outputs 5
 * ```
 */
function transform(value: unknown, transformer?: (i: unknown) => unknown) {
  if (transformer) {
    return transformer(value);
  }
  return value;
}

export class RequestorJsonRpc {
  private concurrent = 0;
  private readonly pending: (() => void)[] = [];
  private id = 0;

  private constructor(
    public readonly transport: JsonRpcTransport,
    public readonly maxConcurrent?: number,
    private readonly onError?: (err: unknown) => Promise<void> | void,
  ) {}

  /** Creates a Requestor that borrows an existing Transport. */
  static new({
    transport,
    maxConcurrent,
    onError,
  }: {
    transport: JsonRpcTransport;
    maxConcurrent?: number;
    onError?: (err: unknown) => Promise<void> | void;
  }): RequestorJsonRpc {
    return new RequestorJsonRpc(transport, maxConcurrent, onError);
  }

  /** Opens a Requestor with ownership of its default transports. */
  static open({
    urls: [url, ...fallbacks],
    onError,
    ...config
  }: {
    urls: readonly [string, ...string[]];
    timeout?: number;
    maxConcurrent?: number;
    onError?: (err: unknown) => Promise<void> | void;
  }): Owner<RequestorJsonRpc> {
    const transportOwner = openTransports([url, ...fallbacks], config);
    return transportOwner.map((transport) =>
      RequestorJsonRpc.new({
        transport,
        ...config,
        onError,
      }),
    );
  }

  /**
   * request a JSON-RPC method.
   *
   * @param rpcMethod - The JSON-RPC method.
   * @param params - Params for the method.
   * @param inTransformers - An array of input transformers.
   * @param outTransformer - An output transformer function.
   * @returns Method response.
   */
  async request(
    rpcMethod: string,
    params: unknown[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inTransformers?: (((_: any) => unknown) | undefined)[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outTransformer?: (_: any) => unknown,
    options?: JsonRpcTransportRequestOptions,
  ): Promise<unknown> {
    const payload = this.buildPayload(
      rpcMethod,
      inTransformers
        ? await Promise.all(
            params
              .concat(
                Array.from(
                  new Array(Math.max(inTransformers.length - params.length, 0)),
                ),
              )
              .map((v, i) => transform(v, inTransformers[i])),
          )
        : params,
    );

    try {
      return await transform(
        await this.requestPayload(payload, options),
        outTransformer,
      );
    } catch (err: unknown) {
      if (!this.onError) {
        throw err;
      }
      await this.onError(err);
    }
  }

  async requestPayload(
    payload: JsonRpcPayload,
    options?: JsonRpcTransportRequestOptions,
  ): Promise<unknown> {
    if (
      this.maxConcurrent !== undefined &&
      this.concurrent >= this.maxConcurrent
    ) {
      options?.signal?.throwIfAborted();
      let resolvePending: (() => void) | undefined;
      const pending = new Promise<void>((resolve) => {
        resolvePending = resolve;
        this.pending.push(resolve);
      });
      try {
        await (options?.signal
          ? Promise.race([pending, abortSignalToPromise(options.signal)])
          : pending);
      } catch (cause) {
        const index = resolvePending
          ? this.pending.indexOf(resolvePending)
          : -1;
        if (index !== -1) {
          this.pending.splice(index, 1);
        } else {
          this.pending.shift()?.();
        }
        throw cause;
      }
    }

    const res: JsonRpcResponse = await (async () => {
      this.concurrent += 1;
      try {
        return await this.transport.request(payload, options);
      } finally {
        this.concurrent -= 1;
        this.pending.shift()?.();
      }
    })();

    if (res.id !== payload.id) {
      throw new Error(`Id mismatched, got ${res.id}, expected ${payload.id}`);
    }
    if (res.error != null) {
      throw new JsonRpcError(res.error);
    }
    return res.result;
  }

  /**
   * Builds a JSON-RPC payload for the given method and parameters.
   *
   * @param method - The JSON-RPC method name.
   * @param req - The parameters for the JSON-RPC method.
   * @returns The JSON-RPC payload.
   */

  buildPayload(method: string, req: unknown[]): JsonRpcPayload {
    return {
      id: this.id++,
      method,
      params: req,
      jsonrpc: "2.0",
    };
  }
}
