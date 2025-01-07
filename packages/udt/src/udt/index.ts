import { ccc, mol } from "@ckb-ccc/core";
import { ssri } from "@ckb-ccc/ssri";
import { amountArrayCodec } from "./advanced";

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
 * - Legacy support for xUDT standard tokens
 *
 * @public
 * @extends {ssri.Contract}
 * @category Blockchain
 * @category Token
 */
export class UDT extends ssri.Contract {
  type: ccc.Script;
  ssriServer: ssri.Server;
  /**
   * Constructs a new UDT (User Defined Token) contract instance.
   * By default it is a SSRI-compliant UDT. By providing `xudtType`, it is compatible with the legacy xUDT.
   *
   * @param {ccc.ScriptLike} type - The type script of the UDT.
   * @param {ccc.CellDepLike} cellDep - The contract code cell dependency of the UDT.
   * @param {ssri.Server | string} ssriServer - The SSRI server instance or URL.
   * @example
   * ```typescript
   * const udtSSRI = new UDT(client, { ssriServerURL: "https://localhost:9090", codeOutPoint: { txHash: '0x...', index: 0 } });
   * const udtLegacyXudt = new UDT(client, { xudtType: xudtType });
   * ```
   */
  constructor(
    type: ccc.ScriptLike,
    cellDep: ccc.CellDepLike,
    ssriServer: ssri.Server | string,
  ) {
    if (typeof ssriServer === "string") {
      ssriServer = new ssri.Server(ssriServer);
    }
    super(cellDep, ssriServer);
    this.type = ccc.Script.from(type);
    this.ssriServer = ssriServer;
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
    try {
      const rawResult = await this.ssriServer.callMethod(
        "UDT.name",
        [],
        this.cellDep.outPoint,
        {
          script: this.type,
        },
      );
      return ccc.bytesTo(rawResult, "utf8");
    } catch (_error) {
      throw new Error(
        "UDT.name method not found and ckb-udt-indexer not implemented yet",
      );
    }
  }

  /**
   * Retrieves the symbol of the UDT.
   * @returns {Promise<string>} The symbol of the UDT.
   * @tag Legacy - Supports xUDT legacy behavior.
   */
  async symbol(): Promise<string> {
    try {
      const rawResult = await this.ssriServer.callMethod(
        "UDT.symbol",
        [],
        this.cellDep.outPoint,
        {
          script: this.type,
        },
      );
      return ccc.bytesTo(rawResult, "utf8");
    } catch (_error) {
      throw new Error(
        "UDT.symbol method not found and ckb-udt-indexer not implemented yet",
      );
    }
  }

  /**
   * Retrieves the decimals of the UDT.
   * @returns {Promise<ccc.Num>} The decimals of the UDT.
   * @tag Legacy - Supports xUDT legacy behavior.
   */
  async decimals(): Promise<ccc.Num> {
    try {
      const rawResult = await this.ssriServer.callMethod(
        "UDT.decimals",
        [],
        this.cellDep.outPoint,
        {
          script: this.type,
        },
      );
      return ccc.numFromBytes(rawResult);
    } catch (_error) {
      throw new Error(
        "UDT.decimals method not found and ckb-udt-indexer not implemented yet",
      );
    }
  }

  /**
   * Retrieves the raw balance of the UDT of a specific cell. Use the elevated method `balanceOf` for address balance.
   * @returns {Promise<ccc.Num>} The raw balance of the UDT.
   * @tag Legacy - Supports xUDT legacy behavior.
   */
  async balance(cell: ccc.CellLike): Promise<ccc.Num> {
    try {
      const rawResult = await this.ssriServer.callMethod(
        "UDT.balance",
        [],
        this.cellDep.outPoint,
        {
          cell,
        },
      );
      return ccc.numLeFromBytes(ccc.bytesFrom(rawResult));
    } catch (_error) {
      return ccc.numLeFromBytes(ccc.bytesFrom(cell.outputData));
    }
  }

  /**
   * Transfers UDT to specified addresses.
   * @param {ccc.Transaction | undefined} [tx] - Transfer on the basis of an existing transaction to achieve combined actions. If not provided, a new transaction will be created.
   * @param {ccc.Script[]} toLockArray - The array of lock scripts for the recipients.
   * @param {number[]} toAmountArray - The array of amounts to be transferred.
   * @returns {Promise<{ tx: Transaction }>} The transaction result.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction object.
   * @tag Legacy - Supports xUDT legacy behavior.
   * @example
   * ```typescript
   * const receiver = await signer.getRecommendedAddress();
   * const { script: changeLock } = await signer.getRecommendedAddressObj();
   * const { script: receiverLock } = await ccc.Address.fromString(receiver, signer.client);
   *
   * const usdiScript = {
   *   codeHash: "0xcc9dc33ef234e14bc788c43a4848556a5fb16401a04662fc55db9bb201987037",
   *   hashType: ccc.HashType.type,
   *   args: "0x71fd1985b2971a9903e4d8ed0d59e6710166985217ca0681437883837b86162f"
   * } as ccc.Script;
   *
   * const codeCellDep : CellDepLike = {
   *   outPoint: {
   *     txHash: "0x4e2e832e0b1e7b5994681b621b00c1e65f577ee4b440ef95fa07db9bb3d50269",
   *     index: 0,
   *   },
   *   depType: 'code',
   * }
   *
   * const transferTx = await udtContract.transfer(
   *   [receiverLock],
   *   [100],
   *   {
   *     code_hash: usdiScript.codeHash,
   *     hash_type: usdiScript.hashType,
   *     args: usdiScript.args,
   *   }
   * )
   *
   * await transferTx.completeInputsByUdt(signer, usdiScript)
   * const balanceDiff =
   *   (await transferTx.getInputsUdtBalance(signer.client, usdiScript)) -
   *   transferTx.getOutputsUdtBalance(usdiScript);
   * if (balanceDiff > ccc.Zero) {
   *   cccTransferTx.addOutput(
   *     {
   *       lock: changeLock,
   *       type: usdiScript,
   *     },
   *     ccc.numLeToBytes(balanceDiff, 16),
   *   )
   * }
   * await transferTx.addCellDeps(codeCellDep)
   * await transferTx.completeInputsByCapacity(signer)
   * await transferTx.completeFeeBy(signer)
   * const transferTxHash = await signer.sendTransaction(transferTx)
   * ```
   */
  async transfer(
    tx: ccc.TransactionLike | undefined,
    toLockArray: ccc.ScriptLike[],
    toAmountArray: ccc.NumLike[],
  ): Promise<ccc.Transaction> {
    if (toLockArray.length !== toAmountArray.length) {
      throw new Error("The number of lock scripts and amounts must match");
    }
    try {
      const txEncodedHex = tx
        ? ccc.hexFrom(ccc.Transaction.from(tx).toBytes())
        : "0x";
      const parsedToLockArray = toLockArray.map((lock) =>
        ccc.Script.from(lock),
      );

      const toLockArrayEncoded = mol.BytesVec.encode(
        parsedToLockArray.map((lock) => lock.toBytes()),
      );
      const toLockArrayEncodedHex = ccc.hexFrom(toLockArrayEncoded);
      const toAmountArrayEncoded = amountArrayCodec.encode(toAmountArray);
      const toAmountArrayEncodedHex = ccc.hexFrom(toAmountArrayEncoded);
      const rawResult = await this.ssriServer.callMethod(
        "UDT.transfer",
        [txEncodedHex, toLockArrayEncodedHex, toAmountArrayEncodedHex],
        this.cellDep.outPoint,
        {
          script: this.type,
        },
      );
      const resultDecodedArray = ccc.bytesFrom(rawResult);
      return ccc.Transaction.decode(resultDecodedArray);
    } catch (_error) {
      let parsedTx: ccc.Transaction;
      if (!tx) {
        parsedTx = ccc.Transaction.from({
          outputs: toLockArray.map((lock) => ({
            lock,
            type: this.type,
          })),
          outputsData: toAmountArray.map((amount) => ccc.numLeToBytes(amount)),
        });
      } else {
        parsedTx = ccc.Transaction.from(tx);
        for (let i = 0; i < toLockArray.length; i++) {
          parsedTx.addOutput(
            {
              lock: toLockArray[i],
              type: this.type,
            },
            ccc.numLeToBytes(toAmountArray[i]),
          );
        }
      }
      return parsedTx;
    }
  }

  /**
   * Mints new tokens to specified addresses. See the example in `transfer` as they are similar.
   * @param {ccc.TransactionLike | undefined} [tx] - Optional existing transaction to build upon
   * @param {ccc.ScriptLike[]} toLockArray - Array of recipient lock scripts
   * @param {ccc.NumLike[]} toAmountArray - Array of amounts to mint to each recipient
   * @returns {Promise<ccc.Transaction>} The transaction containing the mint operation
   * @tag Mutation - This method represents a mutation of the onchain state
   * @tag Legacy - Supports xUDT legacy behavior.
   */
  async mint(
    tx: ccc.TransactionLike | undefined,
    toLockArray: ccc.ScriptLike[],
    toAmountArray: ccc.NumLike[],
  ): Promise<ccc.Transaction> {
    if (toLockArray.length !== toAmountArray.length) {
      throw new Error("The number of lock scripts and amounts must match");
    }
    try {
      const txEncodedHex = tx
        ? ccc.hexFrom(ccc.Transaction.from(tx).toBytes())
        : "0x";
      const toLockArrayEncoded = mol.BytesVec.encode(
        toLockArray.map((lock) => ccc.Script.from(lock).toBytes()),
      );
      const toLockArrayEncodedHex = ccc.hexFrom(toLockArrayEncoded);
      const toAmountArrayEncoded = amountArrayCodec.encode(toAmountArray);
      const toAmountArrayEncodedHex = ccc.hexFrom(toAmountArrayEncoded);
      const rawResult = await this.ssriServer.callMethod(
        "UDT.mint",
        [txEncodedHex, toLockArrayEncodedHex, toAmountArrayEncodedHex],
        this.cellDep.outPoint,
        {
          script: this.type,
        },
      );
      const rawResultDecoded = ccc.Transaction.decode(rawResult);
      return ccc.Transaction.from(rawResultDecoded);
    } catch (_error) {
      let parsedTx: ccc.Transaction;
      if (!tx) {
        parsedTx = ccc.Transaction.from({
          outputs: toLockArray.map((lock) => ({
            lock,
            type: this.type,
          })),
          outputsData: toAmountArray.map((amount) => ccc.numLeToBytes(amount)),
        });
      } else {
        parsedTx = ccc.Transaction.from(tx);
        for (let i = 0; i < toLockArray.length; i++) {
          parsedTx.addOutput(
            {
              lock: toLockArray[i],
              type: this.type,
            },
            ccc.numLeToBytes(toAmountArray[i]),
          );
        }
      }
      return parsedTx;
    }
  }

  /**
   * Retrieves the icon of the UDT encoded in base64.
   * @returns {Promise<ccc.Bytes>} The icon of the UDT.
   * @tag Legacy - Supports xUDT legacy behavior.
   */
  async icon(): Promise<ccc.Bytes> {
    try {
      const rawResult = await this.ssriServer.callMethod(
        "UDT.icon",
        [],
        this.cellDep.outPoint,
        {
          script: this.type,
        },
      );
      const iconBytes = Buffer.from(ccc.bytesFrom(rawResult));
      return iconBytes;
    } catch (_error) {
      throw new Error(
        "UDT.icon method not found and ckb-udt-indexer not implemented yet",
      );
    }
  }
}
