export type JsonRpcPayload = {
  id: number;
  jsonrpc: "2.0";
  method: string;
  params: unknown[] | Record<string, unknown>;
};

export type JsonRpcError<Data = unknown> = {
  code: number;
  message: string;
  data?: Data;
};

export type JsonRpcResponse<Result = unknown, Error = unknown> = {
  id: number;
  jsonrpc: "2.0";
} & (
  | { result: Result; error?: never }
  | { result?: never; error: JsonRpcError<Error> }
);

export interface Transport {
  /**
   * Sends a JSON-RPC request to the server.
   *
   * @param payload - The JSON-RPC payload to send.
   * @returns The JSON-RPC response.
   */
  request(data: JsonRpcPayload): Promise<JsonRpcResponse>;

  /** Releases resources held by the transport. */
  close(): Promise<void>;
}
