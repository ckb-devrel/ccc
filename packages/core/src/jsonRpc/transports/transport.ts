export type JsonRpcPayload = {
  id: number;
  jsonrpc: "2.0";
  method: string;
  params: unknown[] | Record<string, unknown>;
};

export interface Transport {
  /**
   * Sends a JSON-RPC request to the server.
   *
   * @param payload - The JSON-RPC payload to send.
   * @returns The result of the JSON-RPC request.
   *
   * @throws Will throw an error if the response ID does not match the request ID, or if the response contains an error.
   */
  request(data: JsonRpcPayload): Promise<unknown>;
}
