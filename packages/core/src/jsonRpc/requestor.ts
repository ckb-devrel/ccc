import {
  JsonRpcPayload,
  Transport,
  TransportFallback,
  transportFromUri,
} from "./transports/advanced.js";

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

export type RequestorJsonRpcConfig = {
  fallbacks?: string[];
  timeout?: number;
  maxConcurrent?: number;
  transport?: Transport;
};

export class RequestorJsonRpc {
  public readonly maxConcurrent?: number;
  private concurrent = 0;
  private readonly pending: (() => void)[] = [];

  public readonly transport: Transport;

  private id = 0;

  /**
   * Creates an instance of ClientJsonRpc.
   *
   * @param url_ - The URL of the JSON-RPC server.
   * @param timeout - The timeout for requests in milliseconds
   */
  constructor(
    private readonly url_: string,
    config?: RequestorJsonRpcConfig,
    private readonly onError?: (err: unknown) => Promise<void> | void,
  ) {
    this.maxConcurrent = config?.maxConcurrent;
    this.transport =
      config?.transport ??
      new TransportFallback(
        Array.from(
          new Set([url_, ...(config?.fallbacks ?? [])]).values(),
          (url) => transportFromUri(url, config),
        ),
      );
  }

  /**
   * Returns the URL of the JSON-RPC server.
   *
   * @returns The URL of the JSON-RPC server.
   */

  get url(): string {
    return this.url_;
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
        await this.requestPayload(payload),
        outTransformer,
      );
    } catch (err: unknown) {
      if (!this.onError) {
        throw err;
      }
      await this.onError(err);
    }
  }

  async requestPayload(payload: JsonRpcPayload): Promise<unknown> {
    if (
      this.maxConcurrent !== undefined &&
      this.concurrent >= this.maxConcurrent
    ) {
      const pending = new Promise<void>((resolve) =>
        this.pending.push(resolve),
      );
      await pending;
    }

    this.concurrent += 1;
    const res = (await this.transport.request(payload)) as {
      id: number;
      error: unknown;
      result: unknown;
    };
    this.concurrent -= 1;
    this.pending.shift()?.();

    if (res.id !== payload.id) {
      throw new Error(`Id mismatched, got ${res.id}, expected ${payload.id}`);
    }
    if (res.error != null) {
      throw res.error as unknown;
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
