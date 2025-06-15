import { ccc } from "@ckb-ccc/core";
import { ssri } from "@ckb-ccc/ssri";

/**
 * Error thrown when there are insufficient UDT coins to complete a transaction.
 * This error provides detailed information about the shortfall, including the
 * exact amount needed, the UDT type script, and an optional custom reason.
 *
 * @public
 * @category Error
 * @category UDT
 *
 * @example
 * ```typescript
 * // This error is typically thrown automatically by UDT methods
 * try {
 *   await udt.completeInputsByBalance(tx, signer);
 * } catch (error) {
 *   if (error instanceof ErrorUdtInsufficientCoin) {
 *     console.log(`Error: ${error.message}`);
 *     console.log(`Shortfall: ${error.amount} UDT tokens`);
 *     console.log(`UDT type script: ${error.type.toHex()}`);
 *   }
 * }
 * ```
 */
export class ErrorUdtInsufficientCoin extends Error {
  /**
   * The amount of UDT coins that are insufficient (shortfall amount).
   * This represents how many more UDT tokens are needed to complete the operation.
   */
  public readonly amount: ccc.Num;

  /**
   * The type script of the UDT that has insufficient balance.
   * This identifies which specific UDT token is lacking sufficient funds.
   */
  public readonly type: ccc.Script;

  /**
   * Creates a new ErrorUdtInsufficientCoin instance.
   *
   * @param info - Configuration object for the error
   * @param info.amount - The amount of UDT coins that are insufficient (shortfall amount)
   * @param info.type - The type script of the UDT that has insufficient balance
   * @param info.reason - Optional custom reason message. If not provided, a default message will be generated
   *
   * @example
   * ```typescript
   * // Manual creation (typically not needed as the error is thrown automatically)
   * const error = new ErrorUdtInsufficientCoin({
   *   amount: ccc.numFrom(1000),
   *   type: udtScript,
   *   reason: "Custom insufficient balance message"
   * });
   *
   * // More commonly, catch the error when it's thrown by UDT methods
   * try {
   *   const result = await udt.completeInputsByBalance(tx, signer);
   * } catch (error) {
   *   if (error instanceof ErrorUdtInsufficientCoin) {
   *     // Handle the insufficient balance error
   *     console.error(`Insufficient UDT: need ${error.amount} more tokens`);
   *   }
   * }
   * ```
   *
   * @remarks
   * The error message format depends on whether a custom reason is provided:
   * - With custom reason: "Insufficient coin, {custom reason}"
   * - Without custom reason: "Insufficient coin, need {amount} extra coin"
   */
  constructor(info: {
    amount: ccc.NumLike;
    type: ccc.ScriptLike;
    reason?: string;
  }) {
    const amount = ccc.numFrom(info.amount);
    const type = ccc.Script.from(info.type);
    super(`Insufficient coin, ${info.reason ?? `need ${amount} extra coin`}`);
    this.amount = amount;
    this.type = type;
  }
}

/**
 * Represents a User Defined Token (UDT) script compliant with the SSRI protocol.
 *
 * This class provides a comprehensive implementation for interacting with User Defined Tokens,
 * supporting various token operations such as querying metadata, checking balances, and performing transfers.
 * It supports both SSRI-compliant UDTs and legacy sUDT/xUDT standard tokens.
 *
 * @public
 * @category Blockchain
 * @category Token
 */
export class Udt extends ssri.Trait {
  public readonly script: ccc.Script;

  /**
   * Constructs a new UDT (User Defined Token) script instance.
   * By default it is a SSRI-compliant UDT. This class supports both SSRI-compliant UDTs and legacy sUDT/xUDT standard tokens.
   *
   * @param code - The script code cell outpoint of the UDT
   * @param script - The type script of the UDT
   * @param config - Optional configuration object
   * @param config.executor - The SSRI executor instance for advanced UDT operations
   * @example
   * ```typescript
   * const udt = new Udt(
   *   { txHash: "0x...", index: 0 }, // code outpoint
   *   { codeHash: "0x...", hashType: "type", args: "0x..." } // type script
   * );
   * ```
   */
  constructor(
    code: ccc.OutPointLike,
    script: ccc.ScriptLike,
    config?: {
      executor?: ssri.Executor | null;
    } | null,
  ) {
    super(code, config?.executor);
    this.script = ccc.Script.from(script);
  }

  /**
   * Retrieves the human-readable name of the User Defined Token.
   * This method queries the UDT script to get the token's display name,
   * which is typically used in user interfaces and wallets.
   *
   * @param context - Optional script execution context for additional parameters
   * @returns A promise resolving to an ExecutorResponse containing the token's name,
   *          or undefined if the name is not available or the script doesn't support this method
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   * const nameResponse = await udt.name();
   * if (nameResponse.res) {
   *   console.log(`Token name: ${nameResponse.res}`);
   * }
   * ```
   */
  async name(
    context?: ssri.ContextScript,
  ): Promise<ssri.ExecutorResponse<string | undefined>> {
    if (this.executor) {
      const res = await this.executor.runScriptTry(this.code, "UDT.name", [], {
        script: this.script,
        ...context,
      });
      if (res) {
        return res.map((res) => ccc.bytesTo(res, "utf8"));
      }
    }

    return ssri.ExecutorResponse.new(undefined);
  }

  /**
   * Retrieves the symbol (ticker) of the User Defined Token.
   * The symbol is typically a short abbreviation used to identify the token,
   * similar to stock ticker symbols (e.g., "BTC", "ETH", "USDT").
   *
   * @param context - Optional script execution context for additional parameters
   * @returns A promise resolving to an ExecutorResponse containing the token's symbol,
   *          or undefined if the symbol is not available or the script doesn't support this method
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   * const symbolResponse = await udt.symbol();
   * if (symbolResponse.res) {
   *   console.log(`Token symbol: ${symbolResponse.res}`);
   * }
   * ```
   */
  async symbol(
    context?: ssri.ContextScript,
  ): Promise<ssri.ExecutorResponse<string | undefined>> {
    if (this.executor) {
      const res = await this.executor.runScriptTry(
        this.code,
        "UDT.symbol",
        [],
        {
          script: this.script,
          ...context,
        },
      );
      if (res) {
        return res.map((res) => ccc.bytesTo(res, "utf8"));
      }
    }

    return ssri.ExecutorResponse.new(undefined);
  }

  /**
   * Retrieves the number of decimal places for the User Defined Token.
   * This value determines how the token amount should be displayed and interpreted.
   * For example, if decimals is 8, then a balance of 100000000 represents 1.0 tokens.
   *
   * @param context - Optional script execution context for additional parameters
   * @returns A promise resolving to an ExecutorResponse containing the number of decimals,
   *          or undefined if decimals are not specified or the script doesn't support this method
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   * const decimalsResponse = await udt.decimals();
   * if (decimalsResponse.res !== undefined) {
   *   console.log(`Token decimals: ${decimalsResponse.res}`);
   *   // Convert raw amount to human-readable format
   *   const humanReadable = rawAmount / (10 ** Number(decimalsResponse.res));
   * }
   * ```
   */
  async decimals(
    context?: ssri.ContextScript,
  ): Promise<ssri.ExecutorResponse<ccc.Num | undefined>> {
    if (this.executor) {
      const res = await this.executor.runScriptTry(
        this.code,
        "UDT.decimals",
        [],
        {
          script: this.script,
          ...context,
        },
      );
      if (res) {
        return res.map((res) => ccc.numFromBytes(res));
      }
    }

    return ssri.ExecutorResponse.new(undefined);
  }

  /**
   * Retrieves the icon URL or data URI for the User Defined Token.
   * This can be used to display a visual representation of the token in user interfaces.
   * The returned value may be a URL pointing to an image file or a data URI containing
   * the image data directly.
   *
   * @param context - Optional script execution context for additional parameters
   * @returns A promise resolving to an ExecutorResponse containing the icon URL/data,
   *          or undefined if no icon is available or the script doesn't support this method
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   * const iconResponse = await udt.icon();
   * if (iconResponse.res) {
   *   // Use the icon in UI
   *   const imgElement = document.createElement('img');
   *   imgElement.src = iconResponse.res;
   * }
   * ```
   */
  async icon(
    context?: ssri.ContextScript,
  ): Promise<ssri.ExecutorResponse<string | undefined>> {
    if (this.executor) {
      const res = await this.executor.runScriptTry(this.code, "UDT.icon", [], {
        script: this.script,
        ...context,
      });
      if (res) {
        return res.map((res) => ccc.bytesTo(res, "utf8"));
      }
    }

    return ssri.ExecutorResponse.new(undefined);
  }

  /**
   * Transfers UDT to specified addresses.
   * This method creates a transaction that transfers UDT tokens to one or more recipients.
   * It can build upon an existing transaction to achieve combined actions.
   *
   * @param signer - The signer that will authorize and potentially pay for the transaction
   * @param transfers - Array of transfer operations to perform
   * @param transfers.to - The lock script of the recipient who will receive the tokens
   * @param transfers.amount - The amount of tokens to transfer to this recipient (in smallest unit)
   * @param tx - Optional existing transaction to build upon. If not provided, a new transaction will be created
   * @returns A promise resolving to an ExecutorResponse containing the transaction with transfer operations
   *
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction object.
   * @example
   * ```typescript
   * const { script: change } = await signer.getRecommendedAddressObj();
   * const { script: to } = await ccc.Address.fromString(receiver, signer.client);
   *
   * const udt = new Udt(
   *   {
   *     txHash: "0x4e2e832e0b1e7b5994681b621b00c1e65f577ee4b440ef95fa07db9bb3d50269",
   *     index: 0,
   *   },
   *   {
   *     codeHash: "0xcc9dc33ef234e14bc788c43a4848556a5fb16401a04662fc55db9bb201987037",
   *     hashType: "type",
   *     args: "0x71fd1985b2971a9903e4d8ed0d59e6710166985217ca0681437883837b86162f"
   *   },
   * );
   *
   * const { res: tx } = await udt.transfer(
   *   signer,
   *   [{ to, amount: 100 }],
   * );
   *
   * const completedTx = await udt.completeBy(tx, signer);
   * await completedTx.completeInputsByCapacity(signer);
   * await completedTx.completeFeeBy(signer);
   * const transferTxHash = await signer.sendTransaction(completedTx);
   * ```
   */
  async transfer(
    signer: ccc.Signer,
    transfers: {
      to: ccc.ScriptLike;
      amount: ccc.NumLike;
    }[],
    tx?: ccc.TransactionLike | null,
  ): Promise<ssri.ExecutorResponse<ccc.Transaction>> {
    let resTx;
    if (this.executor) {
      const txReq = ccc.Transaction.from(tx ?? {});
      await txReq.completeInputsAtLeastOne(signer);

      const res = await this.executor.runScriptTry(
        this.code,
        "UDT.transfer",
        [
          txReq.toBytes(),
          ccc.ScriptVec.encode(transfers.map(({ to }) => to)),
          ccc.mol.Uint128Vec.encode(transfers.map(({ amount }) => amount)),
        ],
        {
          script: this.script,
        },
      );
      if (res) {
        resTx = res.map((res) => ccc.Transaction.fromBytes(res));
      }
    }

    if (!resTx) {
      const transfer = ccc.Transaction.from(tx ?? {});
      for (const { to, amount } of transfers) {
        transfer.addOutput(
          {
            lock: to,
            type: this.script,
          },
          ccc.numLeToBytes(amount, 16),
        );
      }
      resTx = ssri.ExecutorResponse.new(transfer);
    }
    resTx.res.addCellDeps({
      outPoint: this.code,
      depType: "code",
    });
    return resTx;
  }

  /**
   * Mints new tokens to specified addresses.
   * This method creates new UDT tokens and assigns them to the specified recipients.
   * The minting operation requires appropriate permissions and may be restricted
   * based on the UDT's implementation.
   *
   * @param signer - The signer that will authorize and potentially pay for the transaction
   * @param mints - Array of mint operations to perform
   * @param mints.to - The lock script of the recipient who will receive the minted tokens
   * @param mints.amount - The amount of tokens to mint for this recipient (in smallest unit)
   * @param tx - Optional existing transaction to build upon. If not provided, a new transaction will be created
   * @returns A promise resolving to an ExecutorResponse containing the transaction with mint operations
   *
   * @tag Mutation - This method represents a mutation of the onchain state
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   * const { script: recipientLock } = await ccc.Address.fromString(recipientAddress, signer.client);
   *
   * const mintResponse = await udt.mint(
   *   signer,
   *   [
   *     { to: recipientLock, amount: ccc.fixedPointFrom(1000) }, // Mint 1000 tokens
   *     { to: anotherLock, amount: ccc.fixedPointFrom(500) }     // Mint 500 tokens
   *   ]
   * );
   *
   * // Complete the transaction
   * const tx = mintResponse.res;
   * await tx.completeInputsByCapacity(signer);
   * await tx.completeFeeBy(signer, changeLock);
   *
   * const txHash = await signer.sendTransaction(tx);
   * ```
   *
   * @throws May throw if the signer doesn't have minting permissions or if the UDT doesn't support minting
   */
  async mint(
    signer: ccc.Signer,
    mints: {
      to: ccc.ScriptLike;
      amount: ccc.NumLike;
    }[],
    tx?: ccc.TransactionLike | null,
  ): Promise<ssri.ExecutorResponse<ccc.Transaction>> {
    let resTx;
    if (this.executor) {
      const txReq = ccc.Transaction.from(tx ?? {});
      await txReq.completeInputsAtLeastOne(signer);

      const res = await this.executor.runScriptTry(
        this.code,
        "UDT.mint",
        [
          txReq.toBytes(),
          ccc.ScriptVec.encode(mints.map(({ to }) => to)),
          ccc.mol.Uint128Vec.encode(mints.map(({ amount }) => amount)),
        ],
        {
          script: this.script,
        },
      );
      if (res) {
        resTx = res.map((res) => ccc.Transaction.fromBytes(res));
      }
    }

    if (!resTx) {
      const mint = ccc.Transaction.from(tx ?? {});
      for (const { to, amount } of mints) {
        mint.addOutput(
          {
            lock: to,
            type: this.script,
          },
          ccc.numLeToBytes(amount),
        );
      }
      resTx = ssri.ExecutorResponse.new(mint);
    }
    resTx.res.addCellDeps({
      outPoint: this.code,
      depType: "code",
    });
    return resTx;
  }

  /**
   * Checks if a cell is a valid UDT cell for this token.
   * A valid UDT cell must have this UDT's type script and contain at least 16 bytes of output data
   * (the minimum required for storing the UDT balance as a 128-bit little-endian integer).
   *
   * @param cellOutputLike - The cell output to check
   * @param outputData - The output data of the cell
   * @returns True if the cell is a valid UDT cell for this token, false otherwise
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   * const cellOutput = { lock: someLock, type: udt.script };
   * const outputData = ccc.numLeToBytes(1000, 16); // 1000 UDT balance
   *
   * const isValid = udt.isUdtCell(cellOutput, outputData);
   * console.log(`Is valid UDT cell: ${isValid}`); // true
   * ```
   *
   * @remarks
   * The method checks two conditions:
   * 1. The cell's type script matches this UDT's script
   * 2. The output data is at least 16 bytes long (required for UDT balance storage)
   */
  isUdtCell(cellOutputLike: ccc.CellOutputLike, outputData: ccc.HexLike) {
    return (
      (ccc.CellOutput.from(cellOutputLike).type?.eq(this.script) ?? false) &&
      ccc.bytesFrom(outputData).length >= 16
    );
  }

  /**
   * Retrieves comprehensive information about UDT inputs in a transaction.
   * This method analyzes all input cells and returns detailed statistics including
   * total UDT balance, total capacity occupied, and the number of UDT cells.
   *
   * @param txLike - The transaction to analyze
   * @param client - The client to fetch input cell data
   * @returns A promise resolving to an object containing:
   *          - balance: Total UDT balance from all input cells
   *          - capacity: Total capacity occupied by all UDT input cells
   *          - count: Number of UDT input cells
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   * const tx = ccc.Transaction.from(existingTransaction);
   *
   * const inputsInfo = await udt.getInputsInfo(tx, client);
   * console.log(`UDT inputs: ${inputsInfo.count} cells`);
   * console.log(`Total UDT balance: ${inputsInfo.balance}`);
   * console.log(`Total capacity: ${inputsInfo.capacity}`);
   * ```
   *
   * @remarks
   * This method provides more comprehensive information than `getInputsBalance`,
   * making it useful for transaction analysis, fee calculation, and UI display.
   * Only cells with this UDT's type script are included in the statistics.
   */
  async getInputsInfo(
    txLike: ccc.TransactionLike,
    client: ccc.Client,
  ): Promise<{
    balance: ccc.Num;
    capacity: ccc.Num;
    count: number;
  }> {
    const tx = ccc.Transaction.from(txLike);
    const [balance, capacity, count] = await ccc.reduceAsync(
      tx.inputs,
      async (acc, input) => {
        const { cellOutput, outputData } = await input.getCell(client);
        if (!this.isUdtCell(cellOutput, outputData)) {
          return acc;
        }

        return [
          acc[0] + ccc.udtBalanceFrom(outputData),
          acc[1] + cellOutput.capacity,
          acc[2] + 1,
        ];
      },
      [ccc.Zero, ccc.Zero, 0],
    );

    return {
      balance,
      capacity,
      count,
    };
  }

  /**
   * Calculates the total UDT balance from all inputs in a transaction.
   * This method examines each input cell and sums up the UDT amounts
   * for cells that have this UDT's type script.
   *
   * @param txLike - The transaction to analyze
   * @param client - The client to fetch input cell data
   * @returns A promise resolving to the total UDT balance from all inputs
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   * const tx = ccc.Transaction.from(existingTransaction);
   *
   * const inputBalance = await udt.getInputsBalance(tx, client);
   * console.log(`Total UDT input balance: ${inputBalance}`);
   * ```
   *
   * @remarks
   * This method only counts inputs that have the same type script as this UDT instance.
   * Inputs without a type script or with different type scripts are ignored.
   */
  async getInputsBalance(
    txLike: ccc.TransactionLike,
    client: ccc.Client,
  ): Promise<ccc.Num> {
    return (await this.getInputsInfo(txLike, client)).balance;
  }

  /**
   * Retrieves comprehensive information about UDT outputs in a transaction.
   * This method analyzes all output cells and returns detailed statistics including
   * total UDT balance, total capacity occupied, and the number of UDT cells.
   *
   * @param txLike - The transaction to analyze
   * @param _client - The client parameter (unused for outputs since data is already available)
   * @returns A promise resolving to an object containing:
   *          - balance: Total UDT balance from all output cells
   *          - capacity: Total capacity occupied by all UDT output cells
   *          - count: Number of UDT output cells
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   * const tx = ccc.Transaction.from({
   *   outputs: [
   *     { lock: recipientLock, type: udt.script },
   *     { lock: changeLock, type: udt.script }
   *   ],
   *   outputsData: [
   *     ccc.numLeToBytes(1000, 16), // 1000 UDT to recipient
   *     ccc.numLeToBytes(500, 16)   // 500 UDT as change
   *   ]
   * });
   *
   * const outputsInfo = await udt.getOutputsInfo(tx, client);
   * console.log(`UDT outputs: ${outputsInfo.count} cells`);
   * console.log(`Total UDT balance: ${outputsInfo.balance}`); // 1500
   * console.log(`Total capacity: ${outputsInfo.capacity}`);
   * ```
   *
   * @remarks
   * This method provides more comprehensive information than `getOutputsBalance`,
   * making it useful for transaction validation, analysis, and UI display.
   * Only cells with this UDT's type script are included in the statistics.
   * This is an async method for consistency with `getInputsInfo`, though it doesn't
   * actually need to fetch data since output information is already available.
   */
  async getOutputsInfo(
    txLike: ccc.TransactionLike,
    _client: ccc.Client,
  ): Promise<{
    balance: ccc.Num;
    capacity: ccc.Num;
    count: number;
  }> {
    const tx = ccc.Transaction.from(txLike);
    const [balance, capacity, count] = tx.outputs.reduce(
      (acc, output, i) => {
        if (!this.isUdtCell(output, tx.outputsData[i])) {
          return acc;
        }

        return [
          acc[0] + ccc.udtBalanceFrom(tx.outputsData[i]),
          acc[1] + output.capacity,
          acc[2] + 1,
        ];
      },
      [ccc.Zero, ccc.Zero, 0],
    );

    return {
      balance,
      capacity,
      count,
    };
  }

  /**
   * Calculates the total UDT balance from all outputs in a transaction.
   * This method examines each output cell and sums up the UDT amounts
   * for cells that have this UDT's type script.
   *
   * @param txLike - The transaction to analyze
   * @param client - The client parameter (passed to getOutputsInfo for consistency)
   * @returns A promise resolving to the total UDT balance from all outputs
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   * const tx = ccc.Transaction.from({
   *   outputs: [
   *     { lock: recipientLock, type: udt.script },
   *     { lock: changeLock, type: udt.script }
   *   ],
   *   outputsData: [
   *     ccc.numLeToBytes(1000, 16), // 1000 UDT to recipient
   *     ccc.numLeToBytes(500, 16)   // 500 UDT as change
   *   ]
   * });
   *
   * const outputBalance = await udt.getOutputsBalance(tx, client);
   * console.log(`Total UDT output balance: ${outputBalance}`); // 1500
   * ```
   *
   * @remarks
   * This method only counts outputs that have the same type script as this UDT instance.
   * Outputs without a type script or with different type scripts are ignored.
   * This method is a convenience wrapper around `getOutputsInfo` that returns only the balance.
   */
  async getOutputsBalance(
    txLike: ccc.TransactionLike,
    client: ccc.Client,
  ): Promise<ccc.Num> {
    return (await this.getOutputsInfo(txLike, client)).balance;
  }

  /**
   * Calculates the net UDT balance that would be burned (destroyed) in a transaction.
   * This is the difference between the total UDT balance in inputs and outputs.
   * A positive value indicates UDT tokens are being burned, while a negative value
   * indicates more UDT is being created than consumed (which may require minting permissions).
   *
   * @param txLike - The transaction to analyze
   * @param client - The client to fetch input cell data
   * @returns A promise resolving to the net UDT balance burned (inputs - outputs)
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   * const tx = ccc.Transaction.from(existingTransaction);
   *
   * const burned = await udt.getBalanceBurned(tx, client);
   * if (burned > 0) {
   *   console.log(`${burned} UDT tokens will be burned`);
   * } else if (burned < 0) {
   *   console.log(`${-burned} UDT tokens will be created`);
   * } else {
   *   console.log('UDT balance is conserved');
   * }
   * ```
   *
   * @remarks
   * This method is useful for:
   * - Validating transaction balance conservation
   * - Calculating how much UDT is being destroyed in burn operations
   * - Detecting minting operations (negative burned balance)
   * - Ensuring sufficient UDT inputs are provided for transfers
   */
  async getBalanceBurned(
    txLike: ccc.TransactionLike,
    client: ccc.Client,
  ): Promise<ccc.Num> {
    const tx = ccc.Transaction.from(txLike);
    return (
      (await this.getInputsBalance(tx, client)) -
      (await this.getOutputsBalance(tx, client))
    );
  }

  /**
   * Low-level method to complete UDT inputs for a transaction using a custom accumulator function.
   * This method provides maximum flexibility for input selection by allowing custom logic
   * through the accumulator function. It's primarily used internally by other completion methods.
   *
   * @template T - The type of the accumulator value
   * @param txLike - The transaction to complete with UDT inputs
   * @param from - The signer that will provide UDT inputs
   * @param accumulator - Function that determines when to stop adding inputs based on accumulated state
   * @param init - Initial value for the accumulator
   * @returns A promise resolving to an object containing:
   *          - tx: The transaction with added inputs
   *          - addedCount: Number of inputs that were added
   *          - accumulated: Final accumulator value (undefined if target was reached)
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   *
   * // Custom accumulator to track both balance and capacity
   * const result = await udt.completeInputs(
   *   tx,
   *   signer,
   *   ([balanceAcc, capacityAcc], cell) => {
   *     const balance = ccc.udtBalanceFrom(cell.outputData);
   *     const newBalance = balanceAcc + balance;
   *     const newCapacity = capacityAcc + cell.cellOutput.capacity;
   *
   *     // Stop when we have enough balance and capacity
   *     return newBalance >= requiredBalance && newCapacity >= requiredCapacity
   *       ? undefined  // Stop adding inputs
   *       : [newBalance, newCapacity];  // Continue with updated accumulator
   *   },
   *   [ccc.Zero, ccc.Zero]  // Initial [balance, capacity]
   * );
   * ```
   *
   * @remarks
   * This is a low-level method that most users won't need to call directly.
   * Use `completeInputsByBalance` for typical UDT input completion needs.
   * The accumulator function should return `undefined` to stop adding inputs,
   * or return an updated accumulator value to continue.
   */
  async completeInputs<T>(
    txLike: ccc.TransactionLike,
    from: ccc.Signer,
    accumulator: (
      acc: T,
      v: ccc.Cell,
      i: number,
      array: ccc.Cell[],
    ) => Promise<T | undefined> | T | undefined,
    init: T,
  ): Promise<{
    tx: ccc.Transaction;
    addedCount: number;
    accumulated?: T;
  }> {
    const tx = ccc.Transaction.from(txLike);
    const res = await tx.completeInputs(
      from,
      {
        script: this.script,
        outputDataLenRange: [16, ccc.numFrom("0xffffffff")],
      },
      accumulator,
      init,
    );

    return {
      ...res,
      tx,
    };
  }

  /**
   * Completes UDT inputs for a transaction to cover the required output balance.
   * This method automatically adds UDT inputs from the signer's available cells
   * to ensure the transaction has sufficient UDT balance to cover all outputs,
   * while also considering the capacity balance for transaction fees.
   *
   * @param txLike - The transaction to complete with UDT inputs
   * @param from - The signer that will provide UDT inputs
   * @param balanceTweak - Optional additional UDT balance to account for (e.g., for extra requirements)
   * @param capacityTweak - Optional additional CKB capacity to account for (e.g., for extra requirements)
   * @returns A promise resolving to the number of inputs added to the transaction
   *
   * @throws {ErrorUdtInsufficientCoin} When there are insufficient UDT cells to cover the required balance
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   *
   * // Create a transaction that needs 1000 UDT
   * const tx = ccc.Transaction.from({
   *   outputs: [
   *     { lock: recipientLock, type: udt.script }
   *   ],
   *   outputsData: [ccc.numLeToBytes(1000, 16)]
   * });
   *
   * // Add UDT inputs to cover the 1000 UDT requirement
   * const { addedCount } = await udt.completeInputsByBalance(tx, signer);
   * console.log(`Added ${addedCount} UDT inputs to the transaction`);
   * ```
   *
   * @remarks
   * This method implements smart input selection with dual balance consideration:
   * - Calculates the required UDT balance (outputs + balanceTweak)
   * - Considers both UDT balance and capacity balance for optimal selection
   * - If existing inputs already cover the required UDT balance and capacity is non-negative, no new inputs are added
   * - Adds inputs until both UDT balance requirement is met and capacity balance is non-negative
   * - Uses accumulator pattern to track both UDT balance and capacity during input selection
   * - Throws an error if the signer doesn't have sufficient UDT balance
   */
  async completeInputsByBalance(
    txLike: ccc.TransactionLike,
    from: ccc.Signer,
    balanceTweak?: ccc.NumLike,
    capacityTweak?: ccc.NumLike,
  ): Promise<{
    addedCount: number;
    tx: ccc.Transaction;
  }> {
    const tx = ccc.Transaction.from(txLike);
    const balanceBurned =
      (await this.getBalanceBurned(tx, from.client)) -
      ccc.numFrom(balanceTweak ?? 0);
    const capacityBurned =
      (await tx.getFee(from.client)) - ccc.numFrom(capacityTweak ?? 0);

    if (balanceBurned >= ccc.Zero && capacityBurned >= ccc.Zero) {
      return { addedCount: 0, tx };
    }

    const {
      tx: txRes,
      addedCount,
      accumulated,
    } = await this.completeInputs(
      tx,
      from,
      ([balanceAcc, capacityAcc], { cellOutput: { capacity }, outputData }) => {
        const balance = ccc.udtBalanceFrom(outputData);
        const balanceBurned = balanceAcc + balance;
        const capacityBurned = capacityAcc + capacity;

        // Try to provide enough capacity with UDT cells to avoid extra occupation
        return balanceBurned >= ccc.Zero && capacityBurned >= ccc.Zero
          ? undefined
          : [balanceBurned, capacityBurned];
      },
      [balanceBurned, capacityBurned],
    );

    if (accumulated === undefined || accumulated[0] >= ccc.Zero) {
      return { tx: txRes, addedCount };
    }

    throw new ErrorUdtInsufficientCoin({
      amount: -accumulated[0],
      type: this.script,
    });
  }

  /**
   * Completes a UDT transaction by adding inputs and handling change with a custom change function.
   * This is a low-level method that provides maximum flexibility for handling UDT transaction completion.
   * The change function is called to handle excess UDT balance and can return the capacity cost of the change.
   *
   * @param txLike - The transaction to complete
   * @param signer - The signer that will provide UDT inputs
   * @param change - Function to handle excess UDT balance. Called with (tx, balance, shouldModify)
   *                 where shouldModify indicates if the function should actually modify the transaction
   * @param options - Optional configuration
   * @param options.shouldAddInputs - Whether to automatically add inputs. Defaults to true
   * @returns A promise resolving to the completed transaction
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   *
   * const completedTx = await udt.complete(
   *   tx,
   *   signer,
   *   (tx, balance, shouldModify) => {
   *     if (shouldModify && balance > 0) {
   *       // Add change output
   *       const changeData = ccc.numLeToBytes(balance, 16);
   *       tx.addOutput({ lock: changeLock, type: udt.script }, changeData);
   *       return ccc.CellOutput.from({ lock: changeLock, type: udt.script }, changeData).capacity;
   *     }
   *     return 0;
   *   }
   * );
   * ```
   *
   * @remarks
   * The change function is called twice:
   * 1. First with shouldModify=false to calculate capacity requirements
   * 2. Then with shouldModify=true to actually modify the transaction
   * This two-phase approach ensures proper input selection considering capacity requirements.
   */
  async complete(
    txLike: ccc.TransactionLike,
    signer: ccc.Signer,
    change: (
      tx: ccc.Transaction,
      balance: ccc.Num,
      shouldModify: boolean,
    ) => Promise<ccc.NumLike> | ccc.NumLike,
    options?: { shouldAddInputs?: boolean },
  ): Promise<ccc.Transaction> {
    let tx = ccc.Transaction.from(txLike);

    /* === Figure out the balance to change === */
    if (options?.shouldAddInputs ?? true) {
      tx = (await this.completeInputsByBalance(tx, signer)).tx;
    }

    const balanceBurned = await this.getBalanceBurned(tx, signer.client);

    if (balanceBurned < ccc.Zero) {
      throw new ErrorUdtInsufficientCoin({
        amount: -balanceBurned,
        type: this.script,
      });
    } else if (balanceBurned === ccc.Zero) {
      return tx;
    }
    /* === Some balance need to change === */

    if (!(options?.shouldAddInputs ?? true)) {
      await Promise.resolve(change(tx, balanceBurned, true));
      return tx;
    }

    // Different with `Transaction.completeFee`, we don't need the modified tx to track updated fee
    // So one attempt should be enough
    const extraCapacity = ccc.numFrom(
      await Promise.resolve(change(tx, balanceBurned, false)),
    ); // Extra capacity introduced by change cell
    tx = (
      await this.completeInputsByBalance(tx, signer, ccc.Zero, extraCapacity)
    ).tx;

    const balanceToChange = await this.getBalanceBurned(tx, signer.client);
    await Promise.resolve(change(tx, balanceToChange, true));

    return tx;
  }

  /**
   * Completes a UDT transaction by adding change to an existing output at the specified index.
   * This method modifies an existing UDT output in the transaction to include any excess
   * UDT balance as change, rather than creating a new change output.
   *
   * @param txLike - The transaction to complete
   * @param signer - The signer that will provide UDT inputs
   * @param indexLike - The index of the output to modify with change balance
   * @param options - Optional configuration
   * @param options.shouldAddInputs - Whether to automatically add inputs. Defaults to true
   * @returns A promise resolving to the completed transaction
   *
   * @throws {Error} When the specified output is not a valid UDT cell
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   *
   * // Create transaction with a UDT output that will receive change
   * const tx = ccc.Transaction.from({
   *   outputs: [
   *     { lock: recipientLock, type: udt.script },
   *     { lock: changeLock, type: udt.script }  // This will receive change
   *   ],
   *   outputsData: [
   *     ccc.numLeToBytes(1000, 16), // Send 1000 UDT
   *     ccc.numLeToBytes(0, 16)     // Change output starts with 0
   *   ]
   * });
   *
   * // Complete with change going to output index 1
   * const completedTx = await udt.completeChangeToOutput(tx, signer, 1);
   * // Output 1 now contains the excess UDT balance
   * ```
   *
   * @remarks
   * This method is useful when you want to consolidate change into an existing output
   * rather than creating a new output, which can save on transaction size and fees.
   * The specified output must already be a valid UDT cell with this UDT's type script.
   */
  async completeChangeToOutput(
    txLike: ccc.TransactionLike,
    signer: ccc.Signer,
    indexLike: ccc.NumLike,
    options?: { shouldAddInputs?: boolean },
  ) {
    const tx = ccc.Transaction.from(txLike);
    const index = Number(ccc.numFrom(indexLike));
    const outputData = ccc.bytesFrom(tx.outputsData[index]);

    if (!this.isUdtCell(tx.outputs[index], outputData)) {
      throw new Error("Change output must be a UDT cell");
    }

    return this.complete(
      tx,
      signer,
      (tx, balance, shouldModify) => {
        if (shouldModify) {
          const balanceData = ccc.numLeToBytes(
            ccc.udtBalanceFrom(outputData) + balance,
            16,
          );

          tx.outputsData[index] = ccc.hexFrom(
            ccc.bytesConcatTo([], balanceData, outputData.slice(16)),
          );
        }

        return 0;
      },
      options,
    );
  }

  /**
   * Completes a UDT transaction by adding necessary inputs and handling change.
   * This method automatically adds UDT inputs to cover the required output amounts
   * and creates a change output if there's excess UDT balance.
   *
   * @param tx - The transaction to complete, containing UDT outputs
   * @param signer - The signer that will provide UDT inputs
   * @param changeLike - The lock script where any excess UDT balance should be sent as change
   * @param options - Optional configuration for the completion process
   * @param options.shouldAddInputs - Whether to automatically add inputs. Defaults to true
   * @returns A promise resolving to the completed transaction with inputs and change output added
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   *
   * // Create a transaction with UDT outputs
   * const tx = ccc.Transaction.from({
   *   outputs: [
   *     { lock: recipientLock, type: udt.script }
   *   ],
   *   outputsData: [ccc.numLeToBytes(1000, 16)] // Send 1000 UDT
   * });
   *
   * // Complete with change going to sender's address
   * const { script: changeLock } = await signer.getRecommendedAddressObj();
   * const completedTx = await udt.completeChangeToLock(tx, signer, changeLock);
   *
   * // The transaction now has:
   * // - Sufficient UDT inputs to cover the 1000 UDT output
   * // - A change output if there was excess UDT balance
   * ```
   *
   * @remarks
   * This method performs the following operations:
   * 1. Adds UDT inputs using `completeInputsByBalance`
   * 2. Calculates the difference between input and output UDT balances
   * 3. Creates a change output if there's excess UDT balance
   */
  async completeChangeToLock(
    tx: ccc.TransactionLike,
    signer: ccc.Signer,
    changeLike: ccc.ScriptLike,
    options?: { shouldAddInputs?: boolean },
  ) {
    const change = ccc.Script.from(changeLike);

    return this.complete(
      tx,
      signer,
      (tx, balance, shouldModify) => {
        const balanceData = ccc.numLeToBytes(balance, 16);
        const changeOutput = ccc.CellOutput.from(
          { lock: change, type: this.script },
          balanceData,
        );
        if (shouldModify) {
          tx.addOutput(changeOutput, balanceData);
        }

        return changeOutput.capacity;
      },
      options,
    );
  }

  /**
   * Completes a UDT transaction using the signer's recommended address for change.
   * This is a convenience method that automatically uses the signer's recommended
   * address as the change destination, making it easier to complete UDT transactions
   * without manually specifying a change address.
   *
   * @param tx - The transaction to complete, containing UDT outputs
   * @param from - The signer that will provide UDT inputs and receive change
   * @param options - Optional configuration for the completion process
   * @param options.shouldAddInputs - Whether to automatically add inputs. Defaults to true
   * @returns A promise resolving to the completed transaction with inputs and change output added
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   *
   * // Create a transfer transaction
   * const transferResponse = await udt.transfer(
   *   signer,
   *   [{ to: recipientLock, amount: 1000 }]
   * );
   *
   * // Complete the transaction (change will go to signer's address)
   * const completedTx = await udt.completeBy(transferResponse.res, signer);
   *
   * // Add capacity inputs and fee
   * await completedTx.completeInputsByCapacity(signer);
   * await completedTx.completeFeeBy(signer, changeLock);
   *
   * const txHash = await signer.sendTransaction(completedTx);
   * ```
   *
   * @see {@link completeChangeToLock} for more control over the change destination
   */
  async completeBy(
    tx: ccc.TransactionLike,
    from: ccc.Signer,
    options?: { shouldAddInputs?: boolean },
  ) {
    const { script } = await from.getRecommendedAddressObj();

    return this.completeChangeToLock(tx, from, script, options);
  }
}
