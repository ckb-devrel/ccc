import {
  Address,
  ccc,
  Hex,
  OutPointLike,
  Script,
  Transaction,
  TransactionLike,
  mol,
} from "@ckb-ccc/core";
import { SSRICallParams, SSRIContract, SSRIServer, ssriUtils } from "../ssri/index.js";
import { getBalanceOf } from "./udt.advanced.js";

/**
 * Represents a User Defined Token (UDT) contract compliant with the SSRI protocol.
 * 
 * This class provides a comprehensive implementation for interacting with User Defined Tokens,
 * supporting various token operations such as querying metadata, checking balances, and performing transfers.
 * 
 * Key Features:
 * - Metadata retrieval (name, symbol, decimals)
 * - Balance checking for individual cells and addresses
 * - Token transfer and minting capabilities
 * - Caching mechanism for improved performance
 * 
 * @public
 * @extends {SSRIContract}
 * @category Blockchain
 * @category Token
 */
export class UDT extends SSRIContract {
  /**
   * Internal cache to store and retrieve token-related data efficiently.
   * Helps reduce redundant network calls by storing previously fetched information.
   * 
   * @private
   * @type {Map<string, unknown>}
   */
  cache: Map<string, unknown> = new Map();

  /**
   * Constructs a new UDT (User Defined Token) contract instance.
   * 
   * @param {SSRIServer} server - The SSRI server instance used for blockchain interactions.
   * @param {OutPointLike} codeOutPoint - The code out point defining the UDT contract's location.
   * 
   * @example
   * ```typescript
   * const udt = new UDT(ssriServer, { txHash: '0x...', index: 0 });
   * ```
   */
  constructor(
    server: SSRIServer,
    codeOutPoint: OutPointLike,
  ) {
    super(server, codeOutPoint);
  }

  /**
   * Retrieves the human-readable name of the User Defined Token.
   * 
   * This method fetches the token's name from the blockchain, with optional caching
   * to improve performance and reduce unnecessary network calls.
   * 
   * @param {SSRICallParams} [params] - Optional parameters to customize the call behavior.
   * @param {boolean} [params.noCache=false] - If true, bypasses the internal cache.
   * 
   * @returns {Promise<string>} A promise resolving to the token's name.
   * 
   * @throws {Error} If the name cannot be retrieved from the blockchain.
   * 
   * @example
   * ```typescript
   * const tokenName = await udt.name(); // e.g., "My Custom Token"
   * ```
   * 
   * @category Metadata
   * @category Query
   */
  async name(params?: SSRICallParams): Promise<string> {
    let rawResult: Hex;
    if (!params?.noCache && this.cache.has("name")) {
      rawResult = this.cache.get("name") as Hex;
    } else {
      rawResult = await this.callMethod("UDT.name", [], params);
      this.cache.set("name", rawResult);
    }
    const nameBytes = Buffer.from(ssriUtils.decodeHex(rawResult));
    return nameBytes.toString('utf8');
  }

  /**
   * Retrieves the symbol of the UDT.
   * @param {SSRICallParams} [params] - The parameters for the call.
   * @returns {Promise<string>} The symbol of the UDT.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Cache
   */
  async symbol(params?: SSRICallParams): Promise<string> {
    let rawResult: Hex;
    if (!params?.noCache && this.cache.has("symbol")) {
      rawResult = this.cache.get("symbol") as Hex;
    } else {
      rawResult = await this.callMethod("UDT.symbol", [], params);
      this.cache.set("symbol", rawResult);
    }
    const symbolBytes = Buffer.from(ssriUtils.decodeHex(rawResult));
    return symbolBytes.toString('utf8');
  }

  /**
   * Retrieves the decimals of the UDT.
   * @param {SSRICallParams} [params] - The parameters for the call.
   * @returns {Promise<bigint>} The decimals of the UDT.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Cache
   */
  async decimals(params?: SSRICallParams): Promise<bigint> {
    let rawResult: Hex;
    if (!params?.noCache && this.cache.has("decimals")) {
      rawResult = this.cache.get("decimals") as Hex;
    } else {
      rawResult = await this.callMethod("UDT.decimals", [], params);
      this.cache.set("decimals", rawResult);
    }
    return BigInt(rawResult);
  }

  /**
   * Retrieves the balance of the UDT of a specific cell. Use the elevated method `balanceOf` for address balance.
   * @param {SSRICallParams} [params] - The parameters for the call.
   * @returns {Promise<number>} The balance of the UDT.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Cell
   */
  async balance(params?: SSRICallParams): Promise<bigint> {
    console.log("Into Balance")
    ssriUtils.validateSSRIParams(params, { level: "cell" });
    const rawResult = await this.callMethod("UDT.balance", [], params);
    const result = ccc.numLeFromBytes(ssriUtils.decodeHex(rawResult));
    return result;
  }

  /**
   * Retrieves the balance of the UDT for a specific address across the chain.
   * 
   * This method calculates the token balance for a given address, taking into account 
   * the token's decimal places and performing a comprehensive balance lookup.
   * 
   * @param {string} address - The blockchain address to retrieve the balance for.
   * @param {SSRICallParams} [params] - Optional parameters to customize the balance retrieval.
   * @param {boolean} [params.noCache=false] - If true, bypasses any internal caching mechanism.
   * 
   * @returns {Promise<number>} The balance of the specified address, adjusted for token decimals.
   * 
   * @throws {Error} If the address is invalid or the balance cannot be retrieved.
   * 
   * @example
   * ```typescript
   * const balance = await udt.balanceOf('ckb1...'); // Returns balance with decimal adjustment
   * ```
   * 
   * @tag Elevated - This method is elevated with CCC and not available in raw SSRI call
   * @tag Query - Performs a read-only balance query
   */
  async balanceOf(address: string, params?: SSRICallParams): Promise<number> {
    const addressObj = await Address.fromString(address, this.server.client);
    return await getBalanceOf(this, addressObj, params);
  }

  /**
   * Transfers UDT to specified addresses.
   * @param {TransactionLike} [tx] - Transfer on the basis of an existing transaction to achieve combined actions. If not provided, a new transaction will be created.
   * @param {ScriptLike[]} toLockArray - The array of lock scripts for the recipients.
   * @param {number[]} amountArray - The array of amounts to be transferred.
   * @param {SSRICallParams} [params] - The parameters for the call.
   * @returns {Promise<{ tx: Transaction }>} The transaction result.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Script - This method requires a script level call.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction to be sent.
   */
  async transfer(
    tx: TransactionLike | undefined,
    toLockArray: Script[],
    toAmountArray: number[],
    params?: SSRICallParams,
  ): Promise<{
    tx: Transaction;
  }> {
    console.log("Into Transfer")
    console.log("toLockArray", toLockArray)
    console.log("toAmountArray", toAmountArray)
    console.log("params", params)
    if (toLockArray.length !== toAmountArray.length) {
      throw new Error("The number of lock scripts and amounts must match");
    }
    const txEncodedHex = tx
      ? ssriUtils.encodeHex(mol.Transaction.encode(tx))
      : "0x";
    ssriUtils.validateSSRIParams(params, { level: "script" });
    const toLockArrayEncoded = udtUtils.encodeLockArray(toLockArray);
    console.log("toLockArrayEncoded", toLockArrayEncoded)
    const toLockArrayEncodedHex = ssriUtils.encodeHex(toLockArrayEncoded);
    // const decimals = await this.decimals();
    const toAmountArrayEncoded = udtUtils.encodeAmountArray(
      toAmountArray,
      BigInt(8)
    );
    console.log("toAmountArrayEncoded", toAmountArrayEncoded)
    const toAmountArrayEncodedHex = ssriUtils.encodeHex(toAmountArrayEncoded);
    console.log("toAmountArrayEncodedHex", toAmountArrayEncodedHex)
    const rawResult = await this.callMethod(
      "UDT.transfer",
      [txEncodedHex, toLockArrayEncodedHex, toAmountArrayEncodedHex],
      { ...params },
    );
    console.log("rawResult", rawResult)
    const resultDecodedArray = ssriUtils.decodeHex(rawResult);
    console.log("resultDecodedArray", resultDecodedArray)
    const rawResultDecoded = mol.Transaction.decode(resultDecodedArray);
    console.log("rawResultDecoded", rawResultDecoded)
    return { tx: ccc.Transaction.from(rawResultDecoded) };
  }

  /**
   * Mints new tokens to specified addresses.
   * @param {TransactionLike} [tx] - Optional existing transaction to build upon
   * @param {Script[]} toLockArray - Array of recipient lock scripts
   * @param {number[]} toAmountArray - Array of amounts to mint to each recipient
   * @param {SSRICallParams} [params] - Optional SSRI call parameters
   * @returns {Promise<Transaction>} The transaction containing the mint operation
   * @throws {Error} If minting fails or invalid parameters provided
   * @tag Script - This method requires a script level call
   * @tag Mutation - This method represents a mutation of the onchain state
   */
  async mint(
    tx: TransactionLike | undefined,
    toLockArray: Script[],
    toAmountArray: number[],
    params?: SSRICallParams,
  ): Promise<Transaction> {
    if (toLockArray.length !== toAmountArray.length) {
      throw new Error("The number of lock scripts and amounts must match");
    }
    ssriUtils.validateSSRIParams(params, { level: "script" });
    const txEncodedHex = tx
      ? ssriUtils.encodeHex(mol.Transaction.encode(tx))
      : "0x";
    const toLockArrayEncoded = udtUtils.encodeLockArray(toLockArray);
    const toLockArrayEncodedHex = ssriUtils.encodeHex(toLockArrayEncoded);
    const toAmountArrayEncoded = udtUtils.encodeAmountArray(
      toAmountArray,
      await this.decimals(),
    );
    const toAmountArrayEncodedHex = ssriUtils.encodeHex(toAmountArrayEncoded);
    const rawResult = await this.callMethod(
      "UDT.mint",
      [txEncodedHex, toLockArrayEncodedHex, toAmountArrayEncodedHex],
      { ...params },
    );
    const rawResultDecoded = mol.Transaction.decode(rawResult);
    return ccc.Transaction.from(rawResultDecoded);
  }
}

export const udtUtils = {
  /**
   * Encodes an array of lock scripts into a Uint8Array format suitable for UDT operations.
   * @param {Script[]} val - Array of Script objects to encode
   * @returns {Uint8Array} Encoded Uint8Array representation of the lock scripts
   */
  encodeLockArray(val: Array<Script>): Uint8Array {
    console.log("Into encodeLockArray")
    // const result = mol.BytesVec.encode([...val.map((lock) => lock.toBytes())]);
    const lockBytesArray = []
    for (const lock of val) {
      console.log("lock", lock)
      const lockBytes = mol.Script.encode(lock)
      console.log("lockBytes", lockBytes)
      lockBytesArray.push(lockBytes)
    }
    console.log("lockBytesArray", lockBytesArray)
    const result = mol.BytesVec.encode(lockBytesArray);
    console.log("result", result)
    return result;
  },

  /**
   * Encodes an array of numbers into a Uint8Array format with decimal adjustment.
   * @param {number[]} val - Array of numbers to encode
   * @param {bigint} decimals - Number of decimal places to adjust values by
   * @returns {Uint8Array} Encoded byte array of Uint128 values
   * @throws {Error} If values cannot be properly encoded
   */
  encodeAmountArray(val: Array<number>, decimals: bigint): Uint8Array {
    console.log("Into encodeAmountArray")
    // Convert the length to a 4-byte little-endian array
    const lengthBytes = new Uint8Array(new Uint32Array([val.length]).buffer);

    // Flatten the array of Uint128 elements into a single array
    const flattenedBytes = val.flatMap((curr) => {
      const amountBytes = ccc.numLeToBytes(
        Math.floor(Number(curr) * 10 ** Number(decimals)),
        16,
      );
      console.log("amountBytes", amountBytes)
      return Array.from(amountBytes);
    });

    // Combine the length bytes with the flattened byte array
    return new Uint8Array([...lengthBytes, ...flattenedBytes]);
  },
};
