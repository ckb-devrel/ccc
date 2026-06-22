/* eslint-disable @typescript-eslint/no-explicit-any */
// From https://github.com/secretkeylabs/sats-connect-core/

import * as v from "valibot";
import type { BtcProvider } from "./provider.advanced.js";
import type { Requests, Return } from "./requests.advanced.js";

export enum BitcoinNetworkType {
  Mainnet = "Mainnet",
  Testnet = "Testnet",
  Signet = "Signet",
}

export interface BitcoinNetwork {
  type: BitcoinNetworkType;
  address?: string;
}

export interface RequestPayload {
  network: BitcoinNetwork;
}

export interface RequestOptions<Payload extends RequestPayload, Response> {
  onFinish: (response: Response) => void;
  onCancel: () => void;
  payload: Payload;
  getProvider?: () => Promise<BtcProvider | undefined>;
}

// RPC Request and Response types

export const RpcIdSchema = v.optional(
  v.union([v.string(), v.number(), v.null()]),
);
export type RpcId = v.InferOutput<typeof RpcIdSchema>;
export const rpcRequestMessageSchema = v.object({
  jsonrpc: v.literal("2.0"),
  method: v.string(),
  params: v.optional(
    v.union([
      v.array(v.unknown()),
      v.looseObject({}),
      // Note: This is to support current incorrect usage of RPC 2.0. Params need
      // to be either an array or an object when provided. Changing this now would
      // be a breaking change, so accepting null values for now. Tracking in
      // https://linear.app/xverseapp/issue/ENG-4538.
      v.null(),
    ]),
  ),
  id: RpcIdSchema,
});
export type RpcRequestMessage = v.InferOutput<typeof rpcRequestMessageSchema>;

export interface RpcBase {
  jsonrpc: "2.0";
  id: RpcId;
}
export interface RpcRequest<T extends string, U> extends RpcBase {
  method: T;
  params: U;
}

export interface MethodParamsAndResult<TParams, TResult> {
  params: TParams;
  result: TResult;
}

/**
 * @enum {number} RpcErrorCode
 * @description JSON-RPC error codes
 * @see https://www.jsonrpc.org/specification#error_object
 */
export enum RpcErrorCode {
  /**
   * Parse error Invalid JSON
   **/
  PARSE_ERROR = -32700,
  /**
   * The JSON sent is not a valid Request object.
   **/
  INVALID_REQUEST = -32600,
  /**
   * The method does not exist/is not available.
   **/
  METHOD_NOT_FOUND = -32601,
  /**
   * Invalid method parameter(s).
   */
  INVALID_PARAMS = -32602,
  /**
   * Internal JSON-RPC error.
   * This is a generic error, used when the server encounters an error in performing the request.
   **/
  INTERNAL_ERROR = -32603,
  /**
   * user rejected/canceled the request
   */
  USER_REJECTION = -32000,
  /**
   * method is not supported for the address provided
   */
  METHOD_NOT_SUPPORTED = -32001,
  /**
   * The client does not have permission to access the requested resource.
   */
  ACCESS_DENIED = -32002,
}

export const rpcSuccessResponseMessageSchema = v.object({
  jsonrpc: v.literal("2.0"),
  result: v.nonOptional(v.unknown()),
  id: RpcIdSchema,
});
export type RpcSuccessResponseMessage = v.InferOutput<
  typeof rpcSuccessResponseMessageSchema
>;

export const rpcErrorResponseMessageSchema = v.object({
  jsonrpc: v.literal("2.0"),
  error: v.nonOptional(v.unknown()),
  id: RpcIdSchema,
});
export type RpcErrorResponseMessage = v.InferOutput<
  typeof rpcErrorResponseMessageSchema
>;
export const rpcResponseMessageSchema = v.union([
  rpcSuccessResponseMessageSchema,
  rpcErrorResponseMessageSchema,
]);
export type RpcResponseMessage = v.InferOutput<typeof rpcResponseMessageSchema>;

export interface RpcError {
  code: number | RpcErrorCode;
  message: string;
  data?: any;
}

export interface RpcErrorResponse<
  TError extends RpcError = RpcError,
> extends RpcBase {
  error: TError;
}

export interface RpcSuccessResponse<
  Method extends keyof Requests,
> extends RpcBase {
  result: Return<Method>;
}

export type RpcResponse<Method extends keyof Requests> =
  | RpcSuccessResponse<Method>
  | RpcErrorResponse;

export type RpcResult<Method extends keyof Requests> =
  | {
      result: RpcSuccessResponse<Method>["result"];
      status: "success";
    }
  | {
      error: RpcErrorResponse["error"];
      status: "error";
    };
