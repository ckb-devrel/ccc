import { ccc } from "@ckb-ccc/core";
import { ssri } from "@ckb-ccc/ssri";
import { amountArrayCodec, getBalanceOf, lockArrayCodec } from "./udt.advanced.js";

/**
 * Represents a User Defined Token (UDT) contract compliant with the SSRI protocol.
 *
 * This class provides a comprehensive implementation for interacting with User Defined Tokens,
 * supporting various token operations such as querying metadata, checking balances, and performing transfers.
 * It supports both SSRI-compliant UDTs and legacy xUDT standard tokens.
 *
 * Key Features:
 * - Metadata retrieval (name, symbol, decimals)
 * - Balance checking for individual cells and addresses
 * - Token transfer and minting capabilities
 * - legacy support for xUDT standard tokens
 *
 * @public
 * @extends {ssri.Contract}
 * @category Blockchain
 * @category Token
 */
export class UDT extends ssri.Contract {
  client: ccc.Client;
  legacyModeConfigs:
    | {
        type: ccc.Script;
        name: string;
        symbol: string;
        decimals: ccc.Num;
        icon?: ccc.Hex;
      }
    | undefined;

  /**
   * Constructs a new UDT (User Defined Token) contract instance.
   * By default it is a SSRI-compliant UDT. By providing `xudtType`, it is compatible with the legacy xUDT.
   *
   * @param {ccc.Client} client - The CCC client instance used for blockchain interactions.
   * @param {string} ssriServerURL - The URL of the SSRI server.
   * @param {ccc.OutPointLike} codeOutPoint - The code out point defining the UDT contract's location.
   * @param {ccc.Script} xudtType - The type script of the legacy xUDT. Take precedence over `ssriServerURL` and `codeOutPoint`.
   * @example
   * ```typescript
   * const udtSSRI = new UDT(client, "https://localhost:9090", { txHash: '0x...', index: 0 }};
   * const udtLegacyXudt = new UDT(client, undefined, undefined, xudtType);
   * ```
   */
  constructor(
    client: ccc.Client,
    ssriServerURL?: string,
    codeOutPoint?: ccc.OutPointLike,
    xudtType?: ccc.Script,
  ) {
    const ssriServer = new ssri.Server(client, ssriServerURL ?? "https://localhost:9090");
    super(ssriServer, codeOutPoint ?? {
      txHash: "0x",
      index: 0,
    } as ccc.OutPointLike);
    if (xudtType) {
      // TODO: Obtain the name, symbol, decimals, and icon from ckb-udt-indexer
      throw new Error("ckb-udt-indexer is not implemented yet");
      // legacyModeUDTContract.legacyModeConfigs = {
      //   type: xudtType,
      //   name: name ?? "",
      //   symbol: symbol ?? "",
      //   decimals: decimals ?? 6n,
      //   icon,
      // };
    } else {
      if (!codeOutPoint || !ssriServerURL) {
        throw new Error(
          "codeOutPoint and ssriServerURL are required unless in legacy mode",
        );
      }
      const ssriServer = new ssri.Server(client, ssriServerURL);
      super(ssriServer, codeOutPoint);
      this.client = client;
    }
  }

  /**
   * Retrieves the human-readable name of the User Defined Token.
   *
   * This method fetches the token's name from the blockchain.
   *
   * @returns {Promise<string>} A promise resolving to the token's name.
   * @tag Legacy - Supports xUDT legacy behavior.
   */
  async name(): Promise<string> {
    let rawResult: ccc.Hex;
    if (this.legacyModeConfigs) {
      return this.legacyModeConfigs.name;
    } else {
      rawResult = await this.callMethod("UDT.name", []);
    }
    const nameBytes = Buffer.from(ccc.bytesFrom(rawResult));
    return nameBytes.toString("utf8");
  }

  /**
   * Retrieves the symbol of the UDT.
   * @returns {Promise<string>} The symbol of the UDT.
   * @tag Legacy - Supports xUDT legacy behavior.
   */
  async symbol(): Promise<string> {
    let rawResult: ccc.Hex;
    if (this.legacyModeConfigs) {
      return this.legacyModeConfigs.symbol;
    } else {
      rawResult = await this.callMethod("UDT.symbol", []);
    }
    const symbolBytes = Buffer.from(ccc.bytesFrom(rawResult));
    return symbolBytes.toString("utf8");
  }

  /**
   * Retrieves the decimals of the UDT.
   * @returns {Promise<ccc.Num>} The decimals of the UDT.
   * @tag Legacy - Supports xUDT legacy.
   */
  async decimals(): Promise<ccc.Num> {
    let rawResult: ccc.Hex;
    if (this.legacyModeConfigs) {
      return this.legacyModeConfigs.decimals;
    } else {
      rawResult = await this.callMethod("UDT.decimals", [],);
    }
    return ccc.numFromBytes(rawResult);
  }

  /**
   * Retrieves the balance of the UDT of a specific cell. Use the elevated method `balanceOf` for address balance.
   * @returns {Promise<number>} The balance of the UDT.
   * @tag Cell - This method requires a cell level call.
   * @tag Legacy - Supports xUDT legacy behavior.
   */
  async balance(cell: ccc.Cell): Promise<ccc.Num> {
    if (this.legacyModeConfigs) {
      if (!cell) {
        throw new Error("Cell is required");
      }
      const balance = ccc.udtBalanceFrom(cell.outputData);
      return balance;
    } else {
      const rawResult = await this.callMethod("UDT.balance", [], undefined, {
        cell_output: {
          capacity: cell.cellOutput.capacity.toString(),
          lock: {
            code_hash: cell.cellOutput.lock.codeHash,
            hash_type: cell.cellOutput.lock.hashType,
            args: cell.cellOutput.lock.args,
          },
          type: cell.cellOutput.type ? {
            code_hash: cell.cellOutput.type.codeHash,
            hash_type: cell.cellOutput.type.hashType,
            args: cell.cellOutput.type.args,
          } : undefined,
        },
        hex_data: cell.outputData,
      });
      const balance = ccc.numLeFromBytes(ccc.bytesFrom(rawResult));
      return balance;
    }
  }

  /**
   * Retrieves the balance of the UDT for a specific address across the chain.
   *
   * This method calculates the token balance for a given address, taking into account
   * the token's decimal places and performing a comprehensive balance lookup.
   *
   * @param {ccc.Address} address - The blockchain address to retrieve the balance for.
   * @returns {Promise<number>} The balance of the specified address, adjusted for token decimals.
   * @example
   * ```typescript
   * const balance = await udt.balanceOf('ckb1...'); // Returns balance with decimal adjustment
   * ```
   * @tag Elevated - This method is elevated with CCC and not available in raw SSRI call
   * @tag Script - This method requires a script level call. The script is the target Type Script for the UDT.
   * @tag Legacy - Supports xUDT legacy behavior.
   */
  async balanceOf(address: ccc.Address, script: ccc.Script): Promise<number> {
    return await getBalanceOf(this, address, script);
  }

  /**
   * Transfers UDT to specified addresses.
   * @param {ccc.Transaction | undefined} [tx] - Transfer on the basis of an existing transaction to achieve combined actions. If not provided, a new transaction will be created.
   * @param {ccc.Script[]} toLockArray - The array of lock scripts for the recipients.
   * @param {number[]} toAmountArray - The array of amounts to be transferred.
   * @returns {Promise<{ tx: Transaction }>} The transaction result.
   * @tag Script - This method requires a script level call. The script is the target Type Script for the UDT.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction object.
   * @tag Legacy - Supports xUDT legacy behavior.
   */
  async transfer(
    tx: ccc.Transaction | undefined,
    toLockArray: ccc.Script[],
    toAmountArray: number[],
    script: ccc.Script,
  ): Promise<ccc.Transaction> {
    if (toLockArray.length !== toAmountArray.length) {
      throw new Error("The number of lock scripts and amounts must match");
    }
    if (this.legacyModeConfigs) {
      const decimals = await this.decimals();
      if (!tx) {
        tx = ccc.Transaction.from({
          outputs: toLockArray.map((lock, index) => ({
            lock,
            type: this.legacyModeConfigs?.type,
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
              type: this.legacyModeConfigs?.type,
              capacity: ccc.fixedPointFrom(
                toAmountArray[i] * 10 ** Number(decimals),
              ),
            },
            ccc.numLeToBytes(toAmountArray[i] * 10 ** Number(decimals), 16),
          );
        }
      }
      await tx.addCellDepsOfKnownScripts(this.client, [
        ccc.KnownScript.XUdt,
      ]);
      return tx;
    }
    const txEncodedHex = tx ? ccc.hexFrom(tx.toBytes()) : "0x";
    const toLockArrayEncoded = lockArrayCodec.encode(toLockArray);
    const toLockArrayEncodedHex = ccc.hexFrom(toLockArrayEncoded);
    const decimals = await this.decimals();
    const toAmountRawArray = toAmountArray.map((amount) =>
      ccc.numLeToBytes(amount * 10 ** Number(decimals), 16),
    );
    const toAmountArrayEncoded = amountArrayCodec.encode(
      toAmountRawArray,
    );
    const toAmountArrayEncodedHex = ccc.hexFrom(toAmountArrayEncoded);
    const rawResult = await this.callMethod(
      "UDT.transfer",
      [txEncodedHex, toLockArrayEncodedHex, toAmountArrayEncodedHex],
      {
        code_hash: script.codeHash,
        hash_type: script.hashType,
        args: script.args,
      }
    );
    const resultDecodedArray = ccc.bytesFrom(rawResult);
    return ccc.Transaction.decode(resultDecodedArray);
  }

  /**
   * Mints new tokens to specified addresses.
   * @param {ccc.Transaction | undefined} [tx] - Optional existing transaction to build upon
   * @param {ccc.Script[]} toLockArray - Array of recipient lock scripts
   * @param {number[]} toAmountArray - Array of amounts to mint to each recipient
   * @returns {Promise<ccc.Transaction>} The transaction containing the mint operation
   * @tag Script - This method requires a script level call. The script is the target Type Script for the UDT.
   * @tag Mutation - This method represents a mutation of the onchain state
   * @tag Legacy - Supports xUDT legacy behavior.
   */
  async mint(
    tx: ccc.Transaction | undefined,
    toLockArray: ccc.Script[],
    toAmountArray: number[],
    script: ccc.Script
  ): Promise<ccc.Transaction> {
    if (toLockArray.length !== toAmountArray.length) {
      throw new Error("The number of lock scripts and amounts must match");
    }
    if (this.legacyModeConfigs) {
      const decimals = await this.decimals();
      if (!tx) {
        tx = ccc.Transaction.from({
          outputs: toLockArray.map((lock, index) => ({
            lock,
            type: this.legacyModeConfigs?.type,
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
              type: this.legacyModeConfigs?.type,
              capacity: ccc.fixedPointFrom(
                toAmountArray[i] * 10 ** Number(decimals),
              ),
            },
            ccc.numLeToBytes(toAmountArray[i] * 10 ** Number(decimals), 16),
          );
        }
      }
      await tx.addCellDepsOfKnownScripts(this.client, [
        ccc.KnownScript.XUdt,
      ]);
      return tx;
    }
    const txEncodedHex = tx
      ? ccc.hexFrom(ccc.Transaction.encode(tx))
      : "0x";
    const toLockArrayEncoded = lockArrayCodec.encode(toLockArray);
    const toLockArrayEncodedHex = ccc.hexFrom(toLockArrayEncoded);
    const decimals = await this.decimals();
    const toAmountRawArray = toAmountArray.map((amount) =>
      ccc.numLeToBytes(amount * 10 ** Number(decimals), 16),
    );
    const toAmountArrayEncoded = amountArrayCodec.encode(toAmountRawArray);
    const toAmountArrayEncodedHex = ccc.hexFrom(toAmountArrayEncoded);
    const rawResult = await this.callMethod(
      "UDT.mint",
      [txEncodedHex, toLockArrayEncodedHex, toAmountArrayEncodedHex],
      {
        code_hash: script.codeHash,
        hash_type: script.hashType,
        args: script.args,
      }
    );
    const rawResultDecoded = ccc.Transaction.decode(rawResult);
    return ccc.Transaction.from(rawResultDecoded);
  }

  /**
   * Retrieves the icon of the UDT encoded in base64.
   * @returns {Promise<ccc.Bytes>} The icon of the UDT.
   * @tag Legacy - Supports xUDT legacy behavior when initialized with legacyToXudt.
   */
  async icon(): Promise<ccc.Bytes> {
    let rawResult: ccc.Hex;
    if (this.legacyModeConfigs) {
      rawResult = this.legacyModeConfigs.icon ?? ("0x" as ccc.Hex);
    } else {
      rawResult = await this.callMethod("UDT.icon", []);
    }
    const iconBytes = Buffer.from(ccc.bytesFrom(rawResult));
    return iconBytes;
  }
}