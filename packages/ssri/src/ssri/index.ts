import {
  Bytes,
  bytesConcat,
  ccc,
  Client,
  HasherCkb,
  HashType,
  HashTypeLike,
  Hex,
  HexLike,
  numToBytes,
  OutPointLike,
  Transaction,
  TransactionLike,
} from "@ckb-ccc/core";
import axios from "axios";

/**
 * Represents the parameters for an SSRI call. By providing a script, cell, or transaction, the call environment would be elevated accordingly.
 * @public
 */
export class SSRICallParams {
  /**
   * Elevate to script level
   */
  script?: SSRIScript;
  /**
   * Elevate to cell level
   */
  cell?: SSRICellOutputWithData;
  /**
   * Elevate to transaction level
   *
   */
  transaction?: { inner: TransactionLike; hash: Hex };
  /**
   * Some SSRI methods might be able to store results for cache (e.g. `UDTMetadata.symbol`, etc.). If `noCache` is set to `true`, the cache would be ignored.
   */
  noCache?: boolean;
  /**
   * For mutation methods, if `sendNow` is set to `true`, the transaction would be sent immediately. Note that in this way you won't be able to get the transaction response.
   */
  sendNow?: boolean;

  signer?: ccc.Signer;
}

/**
 * Abstract class representing an SSRI contract. Should be used as the base of all SSRI contracts.
 */
export abstract class SSRIContract {
  cache: Map<string, unknown> = new Map();
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
    this.cache = new Map();
  }

  /**
   * Calls a method on the SSRI server through SSRIServer.
   * @param {string} path - The path to the method.
   * @param {unknown[]} args - The arguments for the method.
   * @param {SSRICallParams} params - The parameters for the call.
   * @returns {Promise<Hex>} The result of the call.
   * @private
   */
  async callMethod(
    path: string,
    argsHex: Hex[],
    params?: SSRICallParams,
  ): Promise<Hex> {
    console.log("Calling method", path, "with args", argsHex);
    const hasher = new HasherCkb();
    const pathHex = hasher.update(Buffer.from(path)).digest().slice(0, 18);
    const payload = {
      id: 2,
      jsonrpc: "2.0",
      method: "run_script_level_code",
      params: [
        this.codeOutPoint.txHash,
        this.codeOutPoint.index,
        [pathHex, ...argsHex],
      ],
    } as PayloadType;
    if (params?.script) {
      payload.method = "run_script_level_script";
      payload.params = [...payload.params, params.script];
    } else if (params?.cell) {
      payload.method = "run_script_level_cell";
      payload.params = [...payload.params, params.cell];
    } else if (params?.transaction) {
      payload.method = "run_script_level_transaction";
      payload.params = [...payload.params, params.transaction];
    }
    console.log("Calling method with Payload", payload);
    return await this.server.call(payload);
  }

  /**
   * Retrieves a list of methods.
   * @param {number} offset - The offset for the methods.
   * @param {number} limit - The limit for the methods.
   * @returns {Promise<Bytes[]>} A promise that resolves to a list of methods.
   * @throws {Error} Throws an error if the function is not yet implemented.
   */
  async getMethods(
    offset = 0,
    limit = 0,
    params?: SSRICallParams,
  ): Promise<Bytes[]> {
    let rawResult: Hex;
    if (
      !params?.noCache &&
      this.cache.has("getMethods") &&
      offset === 0 &&
      limit === 0
    ) {
      rawResult = this.cache.get("getMethods") as Hex;
    } else {
      rawResult = await this.callMethod(
        "SSRI.get_methods",
        [
          ssriUtils.encodeHex(numToBytes(offset, 4)),
          ssriUtils.encodeHex(numToBytes(limit, 4)),
        ],
        params,
      );
      this.cache.set("getMethods", rawResult);
    }
    const decodedResult = ssriUtils.decodeHex(rawResult);
    // Chunk the results into arrays of 8 bytes
    const result = [];
    for (let i = 0; i < decodedResult.length; i += 8) {
      result.push(decodedResult.slice(i, i + 8));
    }
    return result;
  }

  /**
   * Checks if the specified methods exist.
   * @param {Bytes[]} methods - The methods to check.
   * @returns {Promise<boolean>} A promise that resolves to a boolean indicating if the methods exist. True means all methods exist, false means at least one method does not exist.
   * @throws {Error} Throws an error if the function is not yet implemented.
   */
  async hasMethods(methods: Bytes[]): Promise<boolean> {
    const flattenedMethods = bytesConcat(...methods);
    const methodsEncoded = ssriUtils.encodeHex(flattenedMethods)
    const rawResult = await this.callMethod(
      "SSRI.has_methods",
      [
        methodsEncoded
      ],
    );
    return rawResult === "0x01";
  }

  /**
   * Retrieves the version of the contract.
   * @returns {Promise<number>} A promise that resolves to the version number.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag cache
   */
  async version(): Promise<number> {
    const rawResult = await this.callMethod("SSRI.version", []);
    return Number(rawResult);
  }

  /**
   * NOTE: This function is not yet implemented.
   * Retrieves a list of errors.
   * @param {number[]} [errorCode] - The error codes to retrieve. If empty, all errors would be retrieved.
   * @returns {Promise<string[]>} A promise that resolves to a list of error messages.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag cache
   */
  // static async getErrors(errorCode?: number[]): Promise<string[]> {
  //   // TODO: implement
  //   throw new Error("TODO");
  // }
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
   * Makes a JSON-RPC call to the SSRI server.
   * @param {unknown} payload - The JSON-RPC payload to send to the server.
   * @returns {Promise<HexLike>} The hexadecimal result from the server
   * @throws {Error} Throws if the server request fails or returns an error
   */
  async call(payload: unknown): Promise<Hex> {
    try {
      const response = await axios.post(this.serverURL!, payload, {
        headers: { "Content-Type": "application/json" },
      });
      console.log("Response", response.data);
      return response.data.result as Hex;
    } catch (error) {
      throw new Error(error as string);
    }
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

export const ssriUtils = {
  /**
   * Validates SSRI call parameters against required operation level.
   * @param {SSRICallParams} [params] - SSRI call parameters to validate
   * @param {{ level: "script" | "cell" | "transaction" | undefined }} validator - Object containing required operation level
   * @throws {Error} If required parameters are missing or invalid
   */
  validateSSRIParams(
    params: SSRICallParams | undefined,
    validator: {
      level?: "script" | "cell" | "transaction";
      signer?: boolean;
      tx?: boolean;
    },
  ): void {
    console.log("Validating SSRI Params", params, validator);
    if (!params) {
      throw new Error(
        "SSRI Parameters Validation are required for this operation",
      );
    }
    if (validator.level === "transaction" && !params.transaction) {
      throw new Error("Transaction Level is required for this operation");
    }
    if (validator.level === "cell" && !params.cell) {
      throw new Error("Cell Level is required for this operation");
    }
    if (validator.level === "script" && !params.script) {
      throw new Error("Script Level is required for this operation");
    }
    if (validator.signer && !params.signer) {
      throw new Error("Specific signer is required for this operation");
    }
    console.log("Validation Passed");
    return;
  },
  encodeHex(data: Uint8Array): Hex {
    // Convert each byte to a two-character hex string
    return `0x${Array.from(data, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("")}`;
  },
  decodeHex(data: Hex): Uint8Array {
    // Remove the 0x prefix
    const dataString = data.slice(2);
    if (dataString.length % 2 !== 0) {
      throw new Error("Invalid hex string: must have an even length.");
    }

    // Convert the hex string into a Uint8Array
    const result = new Uint8Array(dataString.length / 2);
    for (let i = 0; i < dataString.length; i += 2) {
      result[i / 2] = parseInt(dataString.slice(i, i + 2), 16);
    }

    return result;
  },
  recalibrateCapacity(tx: Transaction): Transaction {
    return tx;
  },
};

type PayloadType = {
  id: number;
  jsonrpc: string;
  method: string;
  params: ParamType[];
};

type SSRIScriptLike = {
  code_hash: HexLike;
  hash_type: HashTypeLike;
  args: HexLike;
};
type ParamType =
  | string
  | number
  | bigint
  | ArrayBuffer
  | ArrayLike<number>
  | string[]
  | SSRIScriptLike
  | SSRICellOutputWithData
  | SSRITransaction;

type SSRICellOutputWithData = {
  cell_output: SSRICellOutput;
  hex_data: Hex;
};

type SSRITransaction = {
  inner: TransactionLike;
  hash: Hex;
};

type SSRIScript = {
  code_hash: Hex;
  hash_type: HashType;
  args: Hex;
};

type SSRICellOutput = {
  capacity: string;
  lock: SSRIScript;
  type?: SSRIScript;
};
