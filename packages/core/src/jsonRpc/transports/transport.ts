export type JsonRpcId = string | number;

export type JsonRpcPayload = {
  id: JsonRpcId;
  jsonrpc: "2.0";
  method: string;
  params: unknown[] | Record<string, unknown>;
};

export type JsonRpcErrorLike<Data = unknown> = {
  code: number;
  message: string;
  data?: Data;
};

export class JsonRpcError<Data = unknown> extends Error {
  readonly code: number;
  readonly data?: Data;

  constructor(error: JsonRpcErrorLike<Data>) {
    super(error.message);
    this.name = "JsonRpcError";
    this.code = error.code;
    this.data = error.data;
  }
}

export type JsonRpcResponse<Result = unknown, ErrorData = unknown> = {
  id: JsonRpcId;
  jsonrpc: "2.0";
} & (
  | { result: Result; error?: never }
  | { result?: never; error: JsonRpcErrorLike<ErrorData> }
);

export interface JsonRpcTransport {
  /**
   * Sends a JSON-RPC request to the server.
   *
   * @param payload - The JSON-RPC payload to send.
   * @returns The JSON-RPC response.
   */
  request(payload: JsonRpcPayload): Promise<JsonRpcResponse>;
}
