import { ccc, mol } from "@ckb-ccc/core";
import { ssri } from "@ckb-ccc/ssri";
import { getBalanceOf } from "./udt.advanced.js";

/**
 * Represents a User Defined Token (UDT) contract compliant with the SSRI protocol.
 *
 * This class provides a comprehensive implementation for interacting with User Defined Tokens,
 * supporting various token operations such as querying metadata, checking balances, and performing transfers.
 * It supports both SSRI-compliant UDTs and can fallback to xUDT standard tokens.
 *
 * Key Features:
 * - Metadata retrieval (name, symbol, decimals)
 * - Balance checking for individual cells and addresses
 * - Token transfer and minting capabilities
 * - Caching mechanism for improved performance
 * - Fallback support for xUDT standard tokens
 *
 * @public
 * @extends {ssri.Contract}
 * @category Blockchain
 * @category Token
 */
export class UDT extends ssri.Contract {
  /**
   * Internal cache to store and retrieve token-related data efficiently.
   * Helps reduce redundant network calls by storing previously fetched information.
   *
   * @private
   * @type {Map<string, unknown>}
   */
  cache: Map<string, unknown> = new Map();
  fallbackArguments:
    | {
        client: ccc.Client;
        type: ccc.Script;
        name: string;
        symbol: string;
        decimals: bigint;
        icon?: ccc.Hex;
      }
    | undefined;

  /**
   * Constructs a new UDT (User Defined Token) contract instance.
   * By default it is a SSRI-compliant UDT. Use `fallbackToXudt` instead to initialize a fallback xUDT.
   *
   * @param {ssri.Server} server - The SSRI server instance used for blockchain interactions.
   * @param {ccc.OutPointLike} codeOutPoint - The code out point defining the UDT contract's location.
   *
   * @example
   * ```typescript
   * const udt = new UDT(ssriServer, { txHash: '0x...', index: 0 });
   * ```
   */
  constructor(server: ssri.Server, codeOutPoint: ccc.OutPointLike) {
    super(server, codeOutPoint);
  }

  /**
   * Creates a UDT instance that falls back to xUDT standard behavior.
   * This is useful when interacting with non-SSRI UDTs that follow the xUDT standard.
   * This is made compatible by providing a placeholder SSRI server. You can either manually provide the name, symbol, decimals, and icon, or obtain them from ckb-udt-indexer (TBD).
   *
   * @param {ccc.Client} client - The CKB client instance
   * @param {ccc.Script} type - The type script defining the UDT
   * @param {string} [name] - Optional token name. If not provided, it will be fetched from ckb-udt-indexer (TBD).
   * @param {string} [symbol] - Optional token symbol. If not provided, it will be fetched from ckb-udt-indexer (TBD).
   * @param {bigint} [decimals] - Optional number of decimal places (defaults to 6). If not provided, it will be fetched from ckb-udt-indexer (TBD).
   * @param {ccc.Hex} [icon] - Optional token icon as hex string encoded in base64. If not provided, it will be fetched from ckb-udt-indexer (TBD).
   * @returns {UDT} A UDT instance configured to use xUDT fallback behavior
   * @static
   */
  static fallbackToXudt(
    client: ccc.Client,
    type: ccc.Script,
    name?: string,
    symbol?: string,
    decimals?: bigint,
    icon?: ccc.Hex,
  ): UDT {
    const placeHolderSSRIServer = new ssri.Server(
      client,
      "https://localhost:9090",
    );
    const fallbackXudt = new UDT(placeHolderSSRIServer, {
      txHash: "0x...",
      index: 0,
    });
    // TODO: Obtain the name, symbol, decimals, and icon from ckb-udt-indexer
    fallbackXudt.fallbackArguments = {
      client,
      type,
      name: name ?? "",
      symbol: symbol ?? "",
      decimals: decimals ?? 6n,
      icon,
    };
    return fallbackXudt;
  }

  /**
   * Retrieves the human-readable name of the User Defined Token.
   *
   * This method fetches the token's name from the blockchain, with optional caching
   * to improve performance and reduce unnecessary network calls.
   *
   * @param {ssri.CallParams} [params] - Optional parameters to customize the call behavior.
   * @param {boolean} [params.noCache=false] - If true, bypasses the internal cache.
   * @returns {Promise<string>} A promise resolving to the token's name.
   * @tag Cache - This method supports caching to improve performance.
   * @tag Fallback - Supports xUDT fallback behavior when initialized with fallbackToXudt.
   */
  async name(params?: ssri.CallParams): Promise<string> {
    let rawResult: ccc.Hex;
    if (this.fallbackArguments) {
      return this.fallbackArguments.name;
    } else if (!params?.noCache && this.cache.has("name")) {
      rawResult = this.cache.get("name") as ccc.Hex;
    } else {
      rawResult = await this.callMethod("UDT.name", [], params);
      this.cache.set("name", rawResult);
    }
    const nameBytes = Buffer.from(ssri.utils.decodeHex(rawResult));
    return nameBytes.toString("utf8");
  }

  /**
   * Retrieves the symbol of the UDT.
   * @param {ssri.CallParams} [params] - The parameters for the call.
   * @returns {Promise<string>} The symbol of the UDT.
   * @tag Cache - This method supports caching to improve performance.
   * @tag Fallback - Supports xUDT fallback behavior when initialized with fallbackToXudt.
   */
  async symbol(params?: ssri.CallParams): Promise<string> {
    let rawResult: ccc.Hex;
    if (this.fallbackArguments) {
      return this.fallbackArguments.symbol;
    } else if (!params?.noCache && this.cache.has("symbol")) {
      rawResult = this.cache.get("symbol") as ccc.Hex;
    } else {
      rawResult = await this.callMethod("UDT.symbol", [], params);
      this.cache.set("symbol", rawResult);
    }
    const symbolBytes = Buffer.from(ssri.utils.decodeHex(rawResult));
    return symbolBytes.toString("utf8");
  }

  /**
   * Retrieves the decimals of the UDT.
   * @param {ssri.CallParams} [params] - The parameters for the call.
   * @returns {Promise<bigint>} The decimals of the UDT.
   * @tag Cache - This method supports caching to improve performance.
   * @tag Fallback - Supports xUDT fallback behavior when initialized with fallbackToXudt.
   */
  async decimals(params?: ssri.CallParams): Promise<bigint> {
    let rawResult: ccc.Hex;
    if (this.fallbackArguments) {
      return this.fallbackArguments.decimals;
    } else if (!params?.noCache && this.cache.has("decimals")) {
      rawResult = this.cache.get("decimals") as ccc.Hex;
    } else {
      rawResult = await this.callMethod("UDT.decimals", [], params);
      this.cache.set("decimals", rawResult);
    }
    return BigInt(rawResult);
  }

  /**
   * Retrieves the balance of the UDT of a specific cell. Use the elevated method `balanceOf` for address balance.
   * @param {ssri.CallParams} [params] - The parameters for the call.
   * @returns {Promise<number>} The balance of the UDT.
   * @tag Cell - This method requires a cell level call.
   * @tag Fallback - Supports xUDT fallback behavior when initialized with fallbackToXudt.
   */
  async balance(params?: ssri.CallParams): Promise<bigint> {
    ssri.utils.validateParams(params, { level: "cell" });
    if (this.fallbackArguments) {
      if (!params?.cell) {
        throw new Error("Cell is required");
      }
      const balance = ccc.udtBalanceFrom(params.cell.hex_data);
      return balance;
    } else {
      const rawResult = await this.callMethod("UDT.balance", [], params);
      const balance = ccc.numLeFromBytes(ssri.utils.decodeHex(rawResult));
      return balance;
    }
  }

  /**
   * Retrieves the balance of the UDT for a specific address across the chain.
   *
   * This method calculates the token balance for a given address, taking into account
   * the token's decimal places and performing a comprehensive balance lookup.
   *
   * @param {string} address - The blockchain address to retrieve the balance for.
   * @param {ssri.CallParams} [params] - Optional parameters to customize the balance retrieval.
   * @param {boolean} [params.noCache=false] - If true, bypasses any internal caching mechanism.
   * @returns {Promise<number>} The balance of the specified address, adjusted for token decimals.
   * @example
   * ```typescript
   * const balance = await udt.balanceOf('ckb1...'); // Returns balance with decimal adjustment
   * ```
   * @tag Elevated - This method is elevated with CCC and not available in raw SSRI call
   * @tag Fallback - Supports xUDT fallback behavior when initialized with fallbackToXudt.
   */
  async balanceOf(address: string, params?: ssri.CallParams): Promise<number> {
    let client: ccc.Client;
    if (this.fallbackArguments) {
      client = this.fallbackArguments.client;
      params = {
        ...params,
        script: {
          code_hash: this.fallbackArguments.type.codeHash,
          hash_type: this.fallbackArguments.type.hashType,
          args: this.fallbackArguments.type.args,
        },
      };
    } else {
      client = this.server.client;
    }
    const addressObj = await ccc.Address.fromString(address, client);
    return await getBalanceOf(this, addressObj, params);
  }

  /**
   * Transfers UDT to specified addresses.
   * @param {ccc.Transaction | undefined} [tx] - Transfer on the basis of an existing transaction to achieve combined actions. If not provided, a new transaction will be created.
   * @param {ccc.Script} toLockArray - The array of lock scripts for the recipients.
   * @param {number[]} toAmountArray - The array of amounts to be transferred.
   * @param {ssri.CallParams} [params] - The parameters for the call.
   * @returns {Promise<{ tx: Transaction }>} The transaction result.
   * @tag Script - This method requires a script level call. The script is the target Type Script for the UDT.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction to be sent.
   * @tag Fallback - Supports xUDT fallback behavior when initialized with fallbackToXudt.
   */
  async transfer(
    tx: ccc.Transaction | undefined,
    toLockArray: ccc.Script[],
    toAmountArray: number[],
    params?: ssri.CallParams,
  ): Promise<ccc.Transaction> {
    if (toLockArray.length !== toAmountArray.length) {
      throw new Error("The number of lock scripts and amounts must match");
    }
    if (this.fallbackArguments) {
      const decimals = await this.decimals();
      if (!tx) {
        tx = ccc.Transaction.from({
          outputs: toLockArray.map((lock, index) => ({
            lock,
            type: this.fallbackArguments?.type,
            capacity: ccc.fixedPointFrom(
              toAmountArray[index] * 10 ** Number(decimals),
            ),
          })),
          outputsData: toAmountArray.map((amount) =>
            ccc.numLeToBytes(amount * 10 ** Number(decimals), 16),
          ),
        });
      } else {
        for (let i = 0; i < toLockArray.length; i++) {
          tx.addOutput(
            {
              lock: toLockArray[i],
              type: this.fallbackArguments?.type,
              capacity: ccc.fixedPointFrom(
                toAmountArray[i] * 10 ** Number(decimals),
              ),
            },
            ccc.numLeToBytes(toAmountArray[i] * 10 ** Number(decimals), 16),
          );
        }
      }
      await tx.addCellDepsOfKnownScripts(this.fallbackArguments.client, [
        ccc.KnownScript.XUdt,
      ]);
      return tx;
    }
    const txEncodedHex = tx ? ssri.utils.encodeHex(tx.toBytes()) : "0x";
    ssri.utils.validateParams(params, { level: "script" });
    const toLockArrayEncoded = udtUtils.encodeLockArray(toLockArray);
    const toLockArrayEncodedHex = ssri.utils.encodeHex(toLockArrayEncoded);
    const toAmountArrayEncoded = udtUtils.encodeAmountArray(
      toAmountArray,
      await this.decimals(),
    );
    const toAmountArrayEncodedHex = ssri.utils.encodeHex(toAmountArrayEncoded);
    const rawResult = await this.callMethod(
      "UDT.transfer",
      [txEncodedHex, toLockArrayEncodedHex, toAmountArrayEncodedHex],
      { ...params },
    );
    const resultDecodedArray = ssri.utils.decodeHex(rawResult);
    return ccc.Transaction.decode(resultDecodedArray);
  }

  /**
   * Mints new tokens to specified addresses.
   * @param {ccc.Transaction | undefined} [tx] - Optional existing transaction to build upon
   * @param {ccc.Script[]} toLockArray - Array of recipient lock scripts
   * @param {number[]} toAmountArray - Array of amounts to mint to each recipient
   * @param {ssri.CallParams} [params] - Optional SSRI call parameters
   * @returns {Promise<ccc.Transaction>} The transaction containing the mint operation
   * @tag Script - This method requires a script level call
   * @tag Mutation - This method represents a mutation of the onchain state
   * @tag Fallback - Supports xUDT fallback behavior when initialized with fallbackToXudt.
   */
  async mint(
    tx: ccc.Transaction | undefined,
    toLockArray: ccc.Script[],
    toAmountArray: number[],
    params?: ssri.CallParams,
  ): Promise<ccc.Transaction> {
    if (toLockArray.length !== toAmountArray.length) {
      throw new Error("The number of lock scripts and amounts must match");
    }
    if (this.fallbackArguments) {
      const decimals = await this.decimals();
      if (!tx) {
        tx = ccc.Transaction.from({
          outputs: toLockArray.map((lock, index) => ({
            lock,
            type: this.fallbackArguments?.type,
            capacity: ccc.fixedPointFrom(
              toAmountArray[index] * 10 ** Number(decimals),
            ),
          })),
          outputsData: toAmountArray.map((amount) =>
            ccc.numLeToBytes(amount * 10 ** Number(decimals), 16),
          ),
        });
      } else {
        for (let i = 0; i < toLockArray.length; i++) {
          tx.addOutput(
            {
              lock: toLockArray[i],
              type: this.fallbackArguments?.type,
              capacity: ccc.fixedPointFrom(
                toAmountArray[i] * 10 ** Number(decimals),
              ),
            },
            ccc.numLeToBytes(toAmountArray[i] * 10 ** Number(decimals), 16),
          );
        }
      }
      await tx.addCellDepsOfKnownScripts(this.fallbackArguments.client, [
        ccc.KnownScript.XUdt,
      ]);
      return tx;
    }
    ssri.utils.validateParams(params, { level: "script" });
    const txEncodedHex = tx
      ? ssri.utils.encodeHex(ccc.Transaction.encode(tx))
      : "0x";
    const toLockArrayEncoded = udtUtils.encodeLockArray(toLockArray);
    const toLockArrayEncodedHex = ssri.utils.encodeHex(toLockArrayEncoded);
    const toAmountArrayEncoded = udtUtils.encodeAmountArray(
      toAmountArray,
      await this.decimals(),
    );
    const toAmountArrayEncodedHex = ssri.utils.encodeHex(toAmountArrayEncoded);
    const rawResult = await this.callMethod(
      "UDT.mint",
      [txEncodedHex, toLockArrayEncodedHex, toAmountArrayEncodedHex],
      { ...params },
    );
    const rawResultDecoded = ccc.Transaction.decode(rawResult);
    return ccc.Transaction.from(rawResultDecoded);
  }

  /**
   * Retrieves the icon of the UDT encoded in base64.
   * @param {ssri.CallParams} [params] - The parameters for the call.
   * @returns {Promise<ccc.Bytes>} The icon of the UDT.
   * @tag Fallback - Supports xUDT fallback behavior when initialized with fallbackToXudt.
   */
  async icon(params?: ssri.CallParams): Promise<ccc.Bytes> {
    let rawResult: ccc.Hex;
    if (this.fallbackArguments) {
      rawResult = this.fallbackArguments.icon ?? ("0x" as ccc.Hex);
    } else if (!params?.noCache && this.cache.has("icon")) {
      rawResult = this.cache.get("icon") as ccc.Hex;
    } else {
      rawResult = await this.callMethod("UDT.icon", [], params);
      this.cache.set("icon", rawResult);
    }
    const iconBytes = Buffer.from(ssri.utils.decodeHex(rawResult));
    return iconBytes;
  }
}

export const udtUtils = {
  /**
   * Encodes an array of lock scripts into a ccc.Bytes format suitable for UDT operations.
   * @param {ccc.Script[]} val - Array of Script objects to encode
   * @returns {ccc.Bytes} Encoded ccc.Bytes representation of the lock scripts
   */
  encodeLockArray(val: Array<ccc.Script>): ccc.Bytes {
    console.log("Into encodeLockArray");
    const lockBytesArray = [];
    for (const lock of val) {
      console.log("lock", lock);
      const lockBytes = ccc.Script.encode(lock);
      console.log("lockBytes", lockBytes);
      lockBytesArray.push(lockBytes);
    }
    console.log("lockBytesArray", lockBytesArray);
    const result = mol.BytesVec.encode(lockBytesArray);
    console.log("result", result);
    return result;
  },

  /**
   * Encodes an array of numbers into a ccc.Bytes format with decimal adjustment.
   * @param {number[]} val - Array of numbers to encode
   * @param {bigint} decimals - Number of decimal places to adjust values by
   * @returns {ccc.Bytes} Encoded ccc.Bytes representation of the amount array
   */
  encodeAmountArray(val: Array<number>, decimals: bigint): ccc.Bytes {
    console.log("Into encodeAmountArray");
    // Convert the length to a 4-byte little-endian array
    const lengthBytes = ccc.bytesFrom(new Uint32Array([val.length]));

    // Flatten the array of Uint128 elements into a single array
    const flattenedBytes = val.flatMap((curr) => {
      const amountBytes = ccc.numLeToBytes(
        Math.floor(Number(curr) * 10 ** Number(decimals)),
        16,
      );
      console.log("amountBytes", amountBytes);
      return ccc.bytesFrom(amountBytes);
    });

    // Combine the length bytes with the flattened byte array
    return ccc.bytesConcat(lengthBytes, ...flattenedBytes);
  },
};
