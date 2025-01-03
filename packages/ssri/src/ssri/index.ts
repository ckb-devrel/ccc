import {
  ccc,
} from "@ckb-ccc/core";
import axios from "axios";

/**
 * Abstract class representing an SSRI contract. Should be used as the base of all SSRI contracts.
 */
export abstract class Contract {
  server: Server;
  codeOutPoint: ccc.OutPointLike;

  /**
   * Creates an instance of SSRI Contract.
   * @param {Server} server - The SSRI server instance.
   * @param {OutPointLike} codeOutPoint - The code OutPoint.
   */
  constructor(server: Server, codeOutPoint: ccc.OutPointLike) {
    this.server = server;
    this.codeOutPoint = codeOutPoint;
  }

  /**
   * Calls a method on the SSRI server through SSRI Server.
   * @param {string} path - The path to the method.
   * @param {unknown[]} args - The arguments for the method.
   * @param {Script} [script] - The script level parameters.
   * @param {CellOutputWithData} [cell] - The cell level parameters. Take precedence over script.
   * @param {Transaction} [transaction] - The transaction level parameters. Take precedence over cell.
   * @returns {Promise<Hex>} The result of the call.
   * @private
   */
  async callMethod(
    path: string,
    argsHex: ccc.Hex[],
    script?: Script,
    cell?: CellOutputWithData,
    transaction?: Transaction,
  ): Promise<ccc.Hex> {
    const hasher = new ccc.HasherCkb();
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
    if (script) {
      payload.method = "run_script_level_script";
      payload.params = [...payload.params, script];
    } else if (cell) {
      payload.method = "run_script_level_cell";
      payload.params = [...payload.params, cell];
    } else if (transaction) {
      payload.method = "run_script_level_transaction";
      payload.params = [...payload.params, transaction];
    }
    return await this.server.call(payload);
  }

  /**
   * Retrieves a list of methods.
   * @param {number} offset - The offset for the methods.
   * @param {number} limit - The limit for the methods.
   * @returns {Promise<Bytes[]>} A promise that resolves to a list of methods.
   */
  async getMethods(
    offset = 0,
    limit = 0,
  ): Promise<ccc.Bytes[]> {
    const rawResult = await this.callMethod(
      "SSRI.get_methods",
      [
        ccc.hexFrom(ccc.numToBytes(offset, 4)),
        ccc.hexFrom(ccc.numToBytes(limit, 4)),
      ],
      );
    const decodedResult = ccc.bytesFrom(rawResult);
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
   */
  async hasMethods(methods: ccc.Bytes[]): Promise<boolean> {
    const flattenedMethods = ccc.bytesConcat(...methods);
    const methodsEncoded = ccc.hexFrom(flattenedMethods);
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
   * @tag cache
   */
  async version(): Promise<number> {
    const rawResult = await this.callMethod("SSRI.version", []);
    return Number(rawResult);
  }
}

/**
 * Represents an SSRI server. Shall connect to an external server.
 */
export class Server {
  client: ccc.Client;
  serverURL?: string;

  /**
   * Creates an instance of SSRI Server.
   * @param {ccc.Client} client - The client instance.
   * @param {string} [serverURL] - The external server URL.
   */
  constructor(client: ccc.Client, serverURL?: string) {
    this.client = client;
    this.serverURL = serverURL;
  }

  /**
   * Makes a JSON-RPC call to the SSRI server.
   * @param {unknown} payload - The JSON-RPC payload to send to the server.
   * @returns {Promise<ccc.Hex>} The hexadecimal result from the server
   * @throws {Error} Throws if the server request fails or returns an error
   */
  async call(payload: unknown): Promise<ccc.Hex> {
    try {
      const response = await axios.post(this.serverURL!, payload, {
        headers: { "Content-Type": "application/json" },
      });
      return response.data.result as ccc.Hex;
    } catch (error) {
      throw new Error(error as string);
    }
  }
}

export const utils = {
  recalibrateCapacity(tx: ccc.Transaction): ccc.Transaction {
    return ccc.Transaction.fromBytes(tx.toBytes());
  },
};

type PayloadType = {
  id: number;
  jsonrpc: string;
  method: string;
  params: ParamType[];
};

type ScriptLike = {
  code_hash: ccc.HexLike;
  hash_type: ccc.HashTypeLike;
  args: ccc.HexLike;
};
type ParamType =
  | string
  | number
  | bigint
  | ArrayBuffer
  | ArrayLike<number>
  | string[]
  | ScriptLike
  | CellOutputWithData
  | Transaction;

type CellOutputWithData = {
  cell_output: CellOutput;
  hex_data: ccc.Hex;
};

type Transaction = {
  inner: ccc.TransactionLike;
  hash: ccc.Hex;
};

type Script = {
  code_hash: ccc.Hex;
  hash_type: ccc.HashType;
  args: ccc.Hex;
};

type CellOutput = {
  capacity: string;
  lock: Script;
  type?: Script;
};
