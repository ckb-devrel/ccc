import { RequestorJsonRpc, RequestorJsonRpcConfig } from "@ckb-ccc/core/barrel";

export type JsonRpcConfig = RequestorJsonRpcConfig & {
  requestor?: RequestorJsonRpc;
};

export interface ErrorRpcBaseLike {
  message?: string;
  code?: number;
  data: string;
}

export class ErrorRpcBase extends Error {
  public readonly code?: number;
  public readonly data: string;

  constructor(origin: ErrorRpcBaseLike) {
    super(`Client request error ${origin.message}`);
    this.code = origin.code;
    this.data = origin.data;
  }
}

const ERROR_PARSERS: [
  string,
  (error: ErrorRpcBaseLike, match: RegExpMatchArray) => ErrorRpcBase,
][] = [
  // TODO: add error parsers
];

/**
 * An abstract class implementing JSON-RPC client functionality for a specific URL and timeout.
 * Provides methods for interacting with the Fiber JSON-RPC server.
 */
export abstract class FiberJsonRpc {
  public readonly requestor: RequestorJsonRpc;

  /**
   * Creates an instance of FiberJsonRpc.
   *
   * @param url_ - The URL of the JSON-RPC server.
   * @param timeout - The timeout for requests in milliseconds
   */

  constructor(url_: string, config?: JsonRpcConfig) {
    this.requestor =
      config?.requestor ??
      new RequestorJsonRpc(url_, config, (errAny) => {
        if (
          typeof errAny !== "object" ||
          errAny === null ||
          !("data" in errAny) ||
          typeof errAny.data !== "string"
        ) {
          throw errAny;
        }
        const err = errAny as ErrorRpcBaseLike;

        for (const [regexp, builder] of ERROR_PARSERS) {
          const match = err.data.match(regexp);
          if (match) {
            throw builder(err, match);
          }
        }

        throw new ErrorRpcBase(err);
      });
  }

  // TODO: add methods

  buildSender(
    rpcMethod: Parameters<RequestorJsonRpc["request"]>[0],
    inTransformers?: Parameters<RequestorJsonRpc["request"]>[2],
    outTransformer?: Parameters<RequestorJsonRpc["request"]>[3],
  ): (...req: unknown[]) => Promise<unknown> {
    return async (...req: unknown[]) => {
      return this.requestor.request(
        rpcMethod,
        req,
        inTransformers,
        outTransformer,
      );
    };
  }
}
