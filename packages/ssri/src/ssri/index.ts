import {
  Bytes,
  BytesLike,
  CellLike,
  Client,
  OutPointLike,
  ScriptLike,
  TransactionLike,
} from "@ckb-ccc/core";

/**
 * Represents the parameters for an SSRI call. By providing a script, cell, or transaction, the call environment would be elevated accordingly.
 * @public
 */
export class SSRICallParams {
  script?: ScriptLike;
  cell?: CellLike;
  transaction?: TransactionLike;
  /**
   * Some SSRI methods might be able to store results for cache (e.g. `UDTMetadata.symbol`, etc.). If `noCache` is set to `true`, the cache would be ignored.
   */
  noCache?: boolean;
  /**
   * For mutation methods, if `sendNow` is set to `true`, the transaction would be sent immediately. Note that in this way you won't be able to get the transaction response.
   */
  sendNow?: boolean;
}

/**
 * Abstract class representing an SSRI contract. Should be used as the base of all SSRI contracts.
 */
export abstract class SSRIContract {
  server: SSRIServer;
  codeOutPoint: OutPointLike;

  /**
   * Creates an instance of SSRIContract.
   * @param {SSRIServer} server - The SSRI server instance.
   * @param {OutPointLike} codeOutPoint - The code OutPoint.
   */
  constructor(server: SSRIServer, codeOutPoint: OutPointLike) {
    this.server = server;
    this.codeOutPoint = codeOutPoint;
  }

  /**
   * Calls a method on the SSRI server through SSRIServer.
   * @param {BytesLike} path - The path to the method.
   * @param {BytesLike} args - The arguments for the method.
   * @param {SSRICallParams} params - The parameters for the call.
   * @returns {Promise<BytesLike>} The result of the call.
   * @private
   */
  private async callMethod(
    path: BytesLike,
    args: BytesLike,
    params: SSRICallParams,
  ): Promise<BytesLike> {
    return await this.server.call(path, args, params);
  }

  /**
   * Retrieves a list of methods.
   * @param {number} offset - The offset for the methods.
   * @param {number} limit - The limit for the methods.
   * @returns {Promise<Bytes[]>} A promise that resolves to a list of methods.
   * @throws {Error} Throws an error if the function is not yet implemented.
   */
  static async getMethods(offset: number, limit: number): Promise<Bytes[]> {
    // TODO: implement
    throw new Error("TODO");
  }

  /**
   * Checks if the specified methods exist.
   * @param {Bytes[]} methods - The methods to check.
   * @returns {Promise<boolean>} A promise that resolves to a boolean indicating if the methods exist. True means all methods exist, false means at least one method does not exist.
   * @throws {Error} Throws an error if the function is not yet implemented.
   */
  static async hasMethods(methods: Bytes[]): Promise<boolean> {
    // TODO: implement
    throw new Error("TODO");
  }

  /**
   * Retrieves the version of the contract.
   * @returns {Promise<number>} A promise that resolves to the version number.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag cache
   */
  static async version(): Promise<number> {
    // TODO: implement
    throw new Error("TODO");
  }

  /**
   * Retrieves a list of errors.
   * @param {number[]} [errorCode] - The error codes to retrieve. If empty, all errors would be retrieved.
   * @returns {Promise<string[]>} A promise that resolves to a list of error messages.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag cache
   */
  static async getErrors(errorCode?: number[]): Promise<string[]> {
    // TODO: implement
    throw new Error("TODO");
  }
}

/**
 * Represents an SSRI server. Shall connect to an external server or run in WASM (TODO).
 */
export class SSRIServer {
  client: Client;
  serverURL?: string;

  /**
   * Creates an instance of SSRIServer.
   * @param {Client} client - The client instance.
   * @param {string} [serverURL] - The external server URL.
   */
  constructor(client: Client, serverURL?: string) {
    this.client = client;
    this.serverURL = serverURL;
  }

  /**
   * Calls a method on the server.
   * @param {BytesLike} path - The path to the method.
   * @param {BytesLike} args - The arguments for the method.
   * @param {SSRICallParams} params - The parameters for the call.
   * @returns {Promise<BytesLike>} The result of the call.
   * @throws {Error} Throws an error if the function is not yet implemented.
   */
  async call(
    path: BytesLike,
    args: BytesLike,
    params: SSRICallParams,
  ): Promise<BytesLike> {
    // TODO: implement
    throw new Error("TODO");
  }

  /**
   * NOTE: This function is not yet implemented.
   * Runs the server.
   * @throws {Error} Throws an error if the function is not yet implemented.
   */
  async run() {
    // TODO: implement WASM style
    throw new Error("TODO");
  }
}
