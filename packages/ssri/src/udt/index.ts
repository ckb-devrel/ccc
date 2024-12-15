import {
  Address,
  ccc,
  Hex,
  HexLike,
  OutPointLike,
  Script,
  Transaction,
  TransactionLike,
  mol,
  numToBytes
} from "@ckb-ccc/core";
import { SSRICallParams, SSRIContract, SSRIServer } from "../ssri";
import { ssriUtils } from "../ssri/index";
import { getBalanceOf } from "./udt.advanced";

/**
 * Represents a UDT (User Defined Token) contract compliant to SSRI protocol. Use composition style to allow customized combinations of UDT features including UDTExtended, UDTMetadata, UDTPausable.
 * @public
 * @extends {SSRIContract}
 */
export class UDT extends SSRIContract {
  cache: Map<string, unknown> = new Map();

  /**
   * Creates an instance of UDT.
   * @param {SSRIServer} server - The SSRI server instance.
   * @param {OutPointLike} codeOutPoint - The code out point.
   * @param {boolean} [pausable=false] - Whether to include pausable functionality.
   */
  constructor(
    server: SSRIServer,
    codeOutPoint: OutPointLike,
  ) {
    super(server, codeOutPoint);
  }

  /**
   * Retrieves the name of the UDT.
   * @param {SSRICallParams} [params] - The parameters for the call.
   * @returns {Promise<string>} The name of the UDT.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Cache
   */
  async name(params?: SSRICallParams): Promise<string> {
    let rawResult: HexLike;
    if (!params?.noCache && this.cache.has("name")) {
      rawResult = this.cache.get("name") as HexLike;
    } else {
      rawResult = await this.callMethod("UDT.name", [], params);
      this.cache.set("name", rawResult);
    }
    return mol.String.decode(rawResult);
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
    return mol.String.decode(rawResult);
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
    ssriUtils.validateSSRIParams(params, { level: "cell" });
    const rawResult = await this.callMethod("UDT.balance", [], params);
    return BigInt(rawResult);
  }

  /**
   * Retrieves the balance in decimals of the specified address across the chain.
   * @param {Address} address - The address to retrieve the balance for
   * @returns {Promise<number>} The balance of the specified address adjusted for decimals
   * @throws {Error} If the balance cannot be retrieved
   * @tag Elevated - This method is elevated with CCC and not available in raw SSRI call
   */
  async balanceOf(address: Address, params?: SSRICallParams): Promise<number> {
    return await getBalanceOf(this, address, params);
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
    if (toLockArray.length !== toAmountArray.length) {
      throw new Error("The number of lock scripts and amounts must match");
    }
    const txEncodedHex = tx
      ? ssriUtils.encodeHex(mol.Transaction.encode(tx))
      : "0x";
    ssriUtils.validateSSRIParams(params, { level: "script" });
    const toLockArrayEncoded = udtUtils.encodeLockArray(toLockArray);
    const toLockArrayEncodedHex = ssriUtils.encodeHex(toLockArrayEncoded);
    const toAmountArrayEncoded = udtUtils.encodeAmountArray(
      toAmountArray,
      await this.decimals(),
    );
    const toAmountArrayEncodedHex = ssriUtils.encodeHex(toAmountArrayEncoded);
    const rawResult = await this.callMethod(
      "UDT.transfer",
      [txEncodedHex, toLockArrayEncodedHex, toAmountArrayEncodedHex],
      { ...params },
    );
    const rawResultDecoded = mol.Transaction.decode(rawResult);
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
    return mol.BytesVec.encode([...val.map((lock) => lock.toBytes())]);
  },

  /**
   * Encodes an array of numbers into a Uint128 array format with decimal adjustment.
   * @param {number[]} val - Array of numbers to encode
   * @param {bigint} decimals - Number of decimal places to adjust values by
   * @returns {Uint8Array} Encoded byte array of Uint128 values
   * @throws {Error} If values cannot be properly encoded
   */
  encodeAmountArray(val: Array<number>, decimals: bigint): Uint8Array {
    // Convert the length to a 4-byte little-endian array
    const lengthBytes = new Uint8Array(new Uint32Array([val.length]).buffer);

    // Flatten the array of Uint128 elements into a single array
    const flattenedBytes = val.flatMap((curr) => {
      const amountBytes = ccc.numLeToBytes(
        Math.floor(Number(curr) * 10 ** Number(decimals)),
        16,
      );
      const amountUint128 = mol.Uint128.decode(amountBytes);
      return Array.from(numToBytes(amountUint128));
    });

    // Combine the length bytes with the flattened byte array
    return new Uint8Array([...lengthBytes, ...flattenedBytes]);
  },
};
