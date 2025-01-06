import { ccc } from "@ckb-ccc/core";
import axios from "axios";
import { methodsPathCodec } from "./advanced";

/**
 * Abstract class representing an SSRI contract. Should be used as the base of all SSRI contracts.
 */
export abstract class Contract {
  cellDep: ccc.CellDepLike;
  server: Server;

  /**
   * Creates an instance of SSRI Contract.
   * @param {ccc.CellDepLike} cellDep - The cell dependency.
   * @param {Server} server - The SSRI server instance.
   */
  constructor(cellDep: ccc.CellDepLike, server: Server) {
    this.server = server;
    this.cellDep = cellDep;
  }

  /**
   * Retrieves a list of methods.
   * @param {ccc.NumLike} offset - The offset for the methods.
   * @param {ccc.NumLike} limit - The limit for the methods.
   * @returns {Promise<Bytes[]>} A promise that resolves to a list of methods.
   */
  async getMethods(
    offset: ccc.NumLike = 0,
    limit: ccc.NumLike = 0,
  ): Promise<ccc.Num[]> {
    const rawResult = await this.server.callMethod(
      "SSRI.get_methods",
      [ccc.numToHex(offset ?? 0), ccc.numToHex(limit ?? 0)],
      this.cellDep.outPoint,
    );
    const decodedResult = ccc.bytesFrom(rawResult);
    // Chunk the results into arrays of 8 bytes

    return methodsPathCodec.decode(decodedResult);
  }

  /**
   * Checks if the specified methods exist.
   * @param {string[]} methodNames - The methods to check.
   * @returns {Promise<boolean[]>} A promise that resolves to a boolean indicating if the methods exist. True means all methods exist, false means at least one method does not exist.
   */
  async hasMethods(methodNames: string[]): Promise<boolean[]> {
    const methodsNamesHash = methodNames.map((name) =>
      ccc.hashCkb(ccc.bytesFrom(name)),
    );
    const flattenedMethodsNamesHash = ccc.bytesConcat(...methodsNamesHash);
    const flattenedMethodsNamesHashHex = ccc.bytesTo(
      flattenedMethodsNamesHash,
      "hex",
    ) as ccc.Hex;
    const rawResult = await this.server.callMethod(
      "SSRI.has_methods",
      [flattenedMethodsNamesHashHex],
      this.cellDep.outPoint,
    );
    const resultBytes = ccc.bytesFrom(rawResult);
    return Array.from(resultBytes).map((byte) => byte === 1);
  }

  /**
   * Retrieves the version of the contract.
   * @returns {Promise<ccc.Num>} A promise that resolves to the version number.
   */
  async version(): Promise<ccc.Num> {
    const rawResult = await this.server.callMethod(
      "SSRI.version",
      [],
      this.cellDep.outPoint,
    );
    return ccc.numFrom(rawResult);
  }
}

/**
 * Represents an SSRI server. Shall connect to an external server.
 */
export class Server {
  serverURL: string;

  /**
   * Creates an instance of SSRI Server.
   * @param {string} [serverURL] - The external server URL.
   */
  constructor(serverURL: string) {
    this.serverURL = serverURL;
  }

  /**
   * Makes a JSON-RPC call to the SSRI server.
   * @param {unknown} payload - The JSON-RPC payload to send to the server.
   * @returns {Promise<ccc.Hex>} The hexadecimal result from the server
   */
  async call(payload: unknown): Promise<ccc.Hex> {
    const response = await axios.post(this.serverURL, payload, {
      headers: { "Content-Type": "application/json" },
    });
    return response.data.result as ccc.Hex;
  }

  /**
   * Calls a method on the SSRI server through SSRI Server.
   * @param {string} path - The path to the method.
   * @param {ccc.HexLike[]} argsHex - The arguments for the method.
   * @param {ccc.OutPointLike} codeOutPoint - The code OutPoint.
   * @param {{ script: ccc.ScriptLike } | { cell: ccc.CellLike } | { transaction: ccc.TransactionLike } | undefined} context - The SSRI context for the method.
   * @param {ccc.ScriptLike} context.script - The script level parameters.
   * @param {ccc.CellLike} context.cell - The cell level parameters. Take precedence over script.
   * @param {ccc.TransactionLike} context.transaction - The transaction level parameters. Take precedence over cell.
   * @returns {Promise<ccc.Hex>} The result of the call.
   * @private
   */
  async callMethod(
    path: string,
    argsHex: ccc.HexLike[],
    codeOutPoint: ccc.OutPointLike,
    context?:
      | { script: ccc.ScriptLike }
      | { cell: ccc.CellLike }
      | { transaction: ccc.TransactionLike },
  ): Promise<ccc.Hex> {
    const pathHex = ccc.hashCkb(ccc.bytesFrom(path));
    const parsedArgsHex = argsHex.map((arg) => ccc.hexFrom(arg));
    const payload = {
      id: 2,
      jsonrpc: "2.0",
      method: "run_script_level_code",
      params: [
        codeOutPoint.txHash,
        codeOutPoint.index,
        [pathHex, ...parsedArgsHex],
      ],
    } as PayloadType;
    if (context && "script" in context) {
      payload.method = "run_script_level_script";
      const parsedScript = ccc.Script.from(context.script);
      const contextScript: Script = {
        code_hash: ccc.hexFrom(parsedScript.codeHash),
        hash_type: parsedScript.hashType,
        args: ccc.hexFrom(parsedScript.args),
      };
      payload.params = [...payload.params, contextScript];
    } else if (context && "cell" in context) {
      payload.method = "run_script_level_cell";
      const parsedCell = ccc.Cell.from(context.cell);
      const contextCell: CellOutputWithData = {
        cell_output: {
          capacity: ccc.numToHex(parsedCell.cellOutput.capacity),
          lock: {
            code_hash: ccc.hexFrom(parsedCell.cellOutput.lock.codeHash),
            hash_type: parsedCell.cellOutput.lock.hashType,
            args: ccc.hexFrom(parsedCell.cellOutput.lock.args),
          },
        },
        hex_data: ccc.hexFrom(parsedCell.outputData),
      };
      payload.params = [...payload.params, contextCell];
    } else if (context && "transaction" in context) {
      payload.method = "run_script_level_transaction";
      const parsedTransaction = ccc.Transaction.from(context.transaction);
      const contextTransaction: Transaction = {
        inner: parsedTransaction,
        hash: ccc.hexFrom(parsedTransaction.hash()),
      };
      payload.params = [...payload.params, contextTransaction];
    }
    return await this.call(payload);
  }
}

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
