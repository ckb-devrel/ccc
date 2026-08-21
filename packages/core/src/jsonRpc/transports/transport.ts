export type JsonRpcId = string | number;

export type JsonRpcPayload = {
  id: JsonRpcId;
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
  id: JsonRpcId;
  jsonrpc: "2.0";
} & (
  | { result: Result; error?: never }
  | { result?: never; error: JsonRpcError<Error> }
);

export interface JsonRpcTransport {
  /**
   * Sends a JSON-RPC request to the server.
   *
   * @param payload - The JSON-RPC payload to send.
   * @returns The JSON-RPC response.
   */
  request(payload: JsonRpcPayload): Promise<JsonRpcResponse>;

  /** Releases resources held by the transport. */
  close(): Promise<void>;
}
