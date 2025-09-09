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
 * Configuration object type for UDT instances.
 * This type defines the optional configuration parameters that can be passed
 * when creating a UDT instance to customize its behavior.
 *
 * @public
 * @category Configuration
 * @category UDT
 */
export type UdtConfigLike = {
  /**
   * Optional SSRI executor instance for advanced UDT operations.
   * When provided, enables SSRI-compliant features like metadata queries
   * and advanced transfer operations.
   */
  executor?: ssri.Executor | null;

  /**
   * Optional custom search filter for finding UDT cells.
   * If not provided, a default filter will be created that matches
   * cells with the UDT's type script and valid output data length.
   */
  filter?: ccc.ClientIndexerSearchKeyFilterLike | null;
};

/**
 * Configuration class for UDT instances.
 * This class provides a structured way to handle UDT configuration parameters
 * and includes factory methods for creating instances from configuration-like objects.
 *
 * @public
 * @category Configuration
 * @category UDT
 *
 * @example
 * ```typescript
 * // Create configuration with executor
 * const config = new UdtConfig(ssriExecutor);
 *
 * // Create configuration with both executor and filter
 * const config = new UdtConfig(
 *   ssriExecutor,
 *   ccc.ClientIndexerSearchKeyFilter.from({
 *     script: udtScript,
 *     outputDataLenRange: [16, 32]
 *   })
 * );
 *
 * // Create from configuration-like object
 * const config = UdtConfig.from({
 *   executor: ssriExecutor,
 *   filter: { script: udtScript, outputDataLenRange: [16, "0xffffffff"] }
 * });
 * ```
 */
export class UdtConfig {
  /**
   * Creates a new UdtConfig instance.
   *
   * @param executor - Optional SSRI executor for advanced UDT operations
   * @param filter - Optional search filter for finding UDT cells
   */
  constructor(
    public readonly executor?: ssri.Executor,
    public readonly filter?: ccc.ClientIndexerSearchKeyFilter,
  ) {}

  /**
   * Creates a UdtConfig instance from a configuration-like object.
   * This factory method provides a convenient way to create UdtConfig instances
   * from plain objects, automatically converting filter-like objects to proper
   * ClientIndexerSearchKeyFilter instances.
   *
   * @param configLike - Configuration-like object containing executor and/or filter
   * @returns A new UdtConfig instance with the specified configuration
   *
   * @example
   * ```typescript
   * // Create from object with executor only
   * const config = UdtConfig.from({ executor: ssriExecutor });
   *
   * // Create from object with filter only
   * const config = UdtConfig.from({
   *   filter: {
   *     script: udtScript,
   *     outputDataLenRange: [16, "0xffffffff"]
   *   }
   * });
   *
   * // Create from object with both
   * const config = UdtConfig.from({
   *   executor: ssriExecutor,
   *   filter: { script: udtScript, outputDataLenRange: [16, 32] }
   * });
   * ```
   */
  static from(configLike: UdtConfigLike) {
    return new UdtConfig(
      configLike.executor ?? undefined,
      configLike.filter
        ? ccc.ClientIndexerSearchKeyFilter.from(configLike.filter)
        : undefined,
    );
  }
}

/**
 * Represents a UDT information-like object.
 * This is used as a flexible input for creating `UdtInfo` instances.
 *
 * @public
 * @category UDT
 */
export type UdtInfoLike =
  | {
      /** The UDT balance. */
      balance?: ccc.NumLike | null;
      /** The total CKB capacity of the UDT cells. */
      capacity?: ccc.NumLike | null;
      /** The number of UDT cells. */
      count?: number | null;
    }
  | undefined
  | null;

/**
 * Represents aggregated information about a set of UDT cells.
 * This class encapsulates the total balance, total CKB capacity, and the number of cells.
 *
 * @public
 * @category UDT
 */
export class UdtInfo {
  /**
   * Creates an instance of UdtInfo.
   *
   * @param balance - The total UDT balance.
   * @param capacity - The total CKB capacity of the UDT cells.
   * @param count - The number of UDT cells.
   */
  constructor(
    public balance: ccc.Num,
    public capacity: ccc.Num,
    public count: number,
  ) {}

  /**
   * Creates a `UdtInfo` instance from a `UdtInfoLike` object.
   *
   * @param infoLike - A `UdtInfoLike` object or an instance of `UdtInfo`.
   * @returns A new `UdtInfo` instance.
   */
  static from(infoLike?: UdtInfoLike) {
    if (infoLike instanceof UdtInfo) {
      return infoLike;
    }

    return new UdtInfo(
      ccc.numFrom(infoLike?.balance ?? ccc.Zero),
      ccc.numFrom(infoLike?.capacity ?? ccc.Zero),
      infoLike?.count ?? 0,
    );
  }

  /**
   * Creates a default `UdtInfo` instance with all values set to zero.
   * @returns A new `UdtInfo` instance with zero balance, capacity, and count.
   */
  static default() {
    return UdtInfo.from();
  }

  /**
   * Clones the `UdtInfo` instance.
   * @returns A new `UdtInfo` instance that is a copy of the current one.
   */
  clone() {
    return new UdtInfo(this.balance, this.capacity, this.count);
  }

  /**
   * Adds the values from another `UdtInfoLike` object to this instance (in-place).
   *
   * @param infoLike - The `UdtInfoLike` object to add.
   * @returns The current, modified `UdtInfo` instance.
   */
  addEq(infoLike: UdtInfoLike) {
    const info = UdtInfo.from(infoLike);

    this.balance += info.balance;
    this.capacity += info.capacity;
    this.count += info.count;

    return this;
  }

  /**
   * Creates a new `UdtInfo` instance by adding the values from another `UdtInfoLike` object to the current one.
   * This method is not in-place.
   *
   * @param infoLike - The `UdtInfoLike` object to add.
   * @returns A new `UdtInfo` instance with the summed values.
   */
  add(infoLike: UdtInfoLike) {
    return this.clone().addEq(infoLike);
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
  /**
   * The type script that uniquely identifies this UDT token.
   * This script is used to distinguish UDT cells from other cell types and
   * to identify which cells belong to this specific UDT token.
   *
   * @remarks
   * The script contains:
   * - `codeHash`: Hash of the UDT script code
   * - `hashType`: How the code hash should be interpreted ("type" or "data")
   * - `args`: Arguments that make this UDT unique (often contains token-specific data)
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   * console.log(`UDT script hash: ${udt.script.hash()}`);
   * console.log(`UDT args: ${udt.script.args}`);
   *
   * // Check if a cell belongs to this UDT
   * const isUdt = udt.isUdt(cell);
   * ```
   */
  public readonly script: ccc.Script;

  /**
   * The search filter used to find UDT cells controlled by signers.
   * This filter is automatically configured to match cells with this UDT's type script
   * and appropriate output data length (minimum 16 bytes for UDT balance storage).
   *
   * @remarks
   * The filter includes:
   * - `script`: Set to this UDT's type script
   * - `outputDataLenRange`: [16, "0xffffffff"] to ensure valid UDT cells
   *
   * This filter is used internally by methods like:
   * - `calculateInfo()` and `calculateBalance()` for scanning all UDT cells
   * - `completeInputs()` and related methods for finding suitable input cells
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   *
   * // The filter is used internally, but you can access it if needed
   * console.log(`Filter script: ${udt.filter.script?.hash()}`);
   * console.log(`Output data range: ${udt.filter.outputDataLenRange}`);
   *
   * // Manually find cells using the same filter
   * for await (const cell of signer.findCells(udt.filter)) {
   *   console.log(`Found UDT cell with balance: ${udt.balanceFrom(signer.client, cell)}`);
   * }
   * ```
   */
  public readonly filter: ccc.ClientIndexerSearchKeyFilter;

  /**
   * Constructs a new UDT (User Defined Token) script instance.
   * By default it is a SSRI-compliant UDT. This class supports both SSRI-compliant UDTs and legacy sUDT/xUDT standard tokens.
   *
   * @param code - The script code cell outpoint of the UDT. This points to the cell containing the UDT script code
   * @param script - The type script of the UDT that uniquely identifies this token
   * @param config - Optional configuration object for advanced settings
   * @param config.executor - The SSRI executor instance for advanced UDT operations. If provided, enables SSRI-compliant features
   * @param config.filter - Custom search filter for finding UDT cells. If not provided, a default filter will be created
   *
   * @example
   * ```typescript
   * // Basic UDT instance
   * const udt = new Udt(
   *   { txHash: "0x...", index: 0 }, // code outpoint
   *   { codeHash: "0x...", hashType: "type", args: "0x..." } // type script
   * );
   *
   * // UDT with SSRI executor for advanced features
   * const ssriUdt = new Udt(
   *   codeOutPoint,
   *   typeScript,
   *   { executor: ssriExecutor }
   * );
   *
   * // UDT with custom filter (advanced usage)
   * const customUdt = new Udt(
   *   codeOutPoint,
   *   typeScript,
   *   {
   *     filter: {
   *       script: typeScript,
   *       outputDataLenRange: [16, 32], // Only cells with 16-32 bytes output data
   *     }
   *   }
   * );
   * ```
   *
   * @remarks
   * **Default Filter Behavior:**
   * If no custom filter is provided, a default filter is created with:
   * - `script`: Set to the provided UDT type script
   * - `outputDataLenRange`: [16, "0xffffffff"] to match valid UDT cells
   *
   * **SSRI Compliance:**
   * When an executor is provided, the UDT instance can use SSRI-compliant features like:
   * - Advanced transfer operations
   * - Metadata queries (name, symbol, decimals, icon)
   * - Custom UDT logic execution
   *
   * **Legacy Support:**
   * Even without an executor, the UDT class supports basic operations for legacy sUDT/xUDT tokens.
   */
  constructor(
    code: ccc.OutPointLike,
    script: ccc.ScriptLike,
    config?: UdtConfigLike | null,
  ) {
    super(code, config?.executor);
    this.script = ccc.Script.from(script);
    this.filter = ccc.ClientIndexerSearchKeyFilter.from(
      config?.filter ?? {
        script: this.script,
        outputDataLenRange: [16, "0xffffffff"],
      },
    );
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
   * Extracts the UDT balance from raw output data without validation.
   *
   * ⚠️ **Warning**: This is an unsafe method. The caller must ensure that the
   * provided `outputData` is from a valid UDT cell. This method does not
   * verify the cell's type script or data length, and it assumes the data is
   * at least 16 bytes long. For safe balance extraction from a cell, use
   * `balanceFrom`.
   *
   * @param outputData - The raw output data of a cell, as a hex string or byte array.
   * @returns The UDT balance as a `ccc.Num`. Returns `0` if the data is empty.
   * @internal
   */
  static balanceFromUnsafe(outputData: ccc.HexLike): ccc.Num {
    const data = ccc.bytesFrom(outputData).slice(0, 16);
    return data.length === 0 ? ccc.Zero : ccc.numFromBytes(data);
  }

  /**
   * Extracts UDT information (balance, capacity, count) from a list of cells.
   *
   * This method iterates through the provided cells, filters for valid UDT cells
   * belonging to this token, and aggregates their information.
   *
   * @param _client - The client instance, which may be used by subclasses for network requests.
   * @param cells - A list or a nested list of cells to process.
   * @param acc - An optional `UdtInfoLike` object to accumulate results into.
   * @returns A promise resolving to a `UdtInfo` object with the total balance, capacity,
   *          and count of valid UDT cells found in the list.
   *
   * @remarks
   * The base implementation of this method operates locally on the provided cell data
   * and does not perform any network requests. However, subclasses may override this
   * method to introduce network requests for more complex logic.
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   * const cells = [cell1, cell2, nonUdtCell];
   *
   * const { balance, capacity, count } = await udt.infoFrom(client, cells);
   *
   * console.log(`Total UDT balance: ${balance}`);
   * console.log(`Total capacity of UDT cells: ${capacity}`);
   * console.log(`Number of UDT cells: ${count}`);
   * ```
   */
  async infoFrom(
    _client: ccc.Client,
    cells: ccc.CellAnyLike | ccc.CellAnyLike[],
    acc?: UdtInfoLike,
  ): Promise<UdtInfo> {
    return [cells].flat().reduce((acc, cellLike) => {
      const cell = ccc.CellAny.from(cellLike);
      if (!this.isUdt(cell)) {
        return acc;
      }

      return acc.addEq({
        balance: Udt.balanceFromUnsafe(cell.outputData),
        capacity: cell.cellOutput.capacity,
        count: 1,
      });
    }, UdtInfo.from(acc).clone());
  }

  /**
   * Calculates the total UDT balance from a list of cells.
   * This is a convenience method that wraps `infoFrom` and returns only the balance.
   *
   * @param client - The client instance.
   * @param cells - A list or a nested list of cells to process.
   * @param acc - An optional initial balance to accumulate on.
   * @returns A promise resolving to the total UDT balance from the provided cells.
   *
   * @example
   * ```typescript
   * const cell1 = await client.getLiveCell(outpoint1);
   * const cell2 = await client.getLiveCell(outpoint2);
   * const totalBalance = await udt.balanceFrom(client, [cell1, cell2]);
   * console.log(`Balance from selected cells: ${totalBalance}`);
   * ```
   */
  async balanceFrom(
    client: ccc.Client,
    cells: ccc.CellAnyLike | ccc.CellAnyLike[],
    acc?: ccc.NumLike | null,
  ): Promise<ccc.Num> {
    return (await this.infoFrom(client, cells, { balance: acc })).balance;
  }

  /**
   * Calculates comprehensive information about all UDT cells controlled by the signer.
   * This method scans through every UDT cell that the signer controls and aggregates
   * their balance, capacity, and count information.
   *
   * ⚠️ **Performance Warning**: This is an expensive operation that scales with the number
   * of UDT cells. For addresses with many UDT cells (hundreds or thousands), this method
   * can take significant time and resources. Use sparingly and consider caching results.
   *
   * @param signer - The signer whose UDT cells to scan and analyze
   * @param options - Optional configuration for the calculation
   * @param options.source - Data source to use: "chain" (default) for on-chain data, "local" for local indexer cache
   * @returns A promise resolving to a `UdtInfo` object containing the aggregated balance, capacity, and count.
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   *
   * // Calculate comprehensive UDT information from chain (default)
   * const info = await udt.calculateInfo(signer);
   * console.log(`Total UDT balance: ${info.balance}`);
   * console.log(`Total capacity used: ${info.capacity} CKB`);
   * console.log(`Number of UDT cells: ${info.count}`);
   *
   * // Use local cache for faster response (may be less up-to-date)
   * const localInfo = await udt.calculateInfo(signer, { source: "local" });
   * console.log(`Local cached balance: ${localInfo.balance}`);
   *
   * // Use for wallet balance display
   * const balanceInTokens = ccc.fixedPointToString(info.balance, 8); // Assuming 8 decimals
   * console.log(`Balance: ${balanceInTokens} tokens in ${info.count} cells`);
   * ```
   *
   * @remarks
   * **Performance Considerations:**
   * - Execution time is O(n) where n is the number of UDT cells
   * - Network requests are made for each cell discovery when using "chain" source
   * - "local" source is faster but may not reflect the most recent state
   * - Consider implementing client-side caching for frequently accessed data
   * - For transaction-specific calculations, use `getInputsInfo()` or `getOutputsInfo()` instead
   *
   * **Data Source Options:**
   * - `"chain"` (default): Queries the blockchain directly for the most up-to-date information
   * - `"local"`: Uses local indexer cache, faster but potentially stale data
   *
   * **Use Cases:**
   * - Wallet balance display and portfolio overview
   * - UDT cell consolidation planning
   * - Comprehensive account analysis
   * - Debugging and development tools
   *
   * **Alternative Methods:**
   * - Use `calculateBalance()` if you only need the total balance
   * - Use `completeInputsAll()` if you need to collect all cells for a transaction
   * - Use transaction-specific methods for partial calculations
   */
  async calculateInfo(
    signer: ccc.Signer,
    options?: { source?: "chain" | "local" | null },
  ): Promise<UdtInfo> {
    const isFromLocal = (options?.source ?? "chain") === "local";

    return ccc.reduceAsync(
      isFromLocal
        ? signer.findCells(this.filter)
        : signer.findCellsOnChain(this.filter),
      (acc, cell) => this.infoFrom(signer.client, cell, acc),
      UdtInfo.default(),
    );
  }

  /**
   * Calculates the total UDT balance across all cells controlled by the signer.
   * This method provides a convenient way to get the complete UDT balance without
   * needing the additional capacity and count information.
   *
   * ⚠️ **Performance Warning**: This is an expensive operation that scans all UDT cells.
   * For addresses with many UDT cells, this method can be slow and resource-intensive.
   * Consider caching results and using sparingly in production applications.
   *
   * @param signer - The signer whose total UDT balance to calculate
   * @param options - Optional configuration for the calculation
   * @param options.source - Data source to use: "chain" (default) for on-chain data, "local" for local indexer cache
   * @returns A promise resolving to the total UDT balance across all cells
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   *
   * // Get total balance for wallet display (from chain)
   * const totalBalance = await udt.calculateBalance(signer);
   * console.log(`Total UDT balance: ${totalBalance}`);
   *
   * // Get balance from local cache for faster response
   * const cachedBalance = await udt.calculateBalance(signer, { source: "local" });
   * console.log(`Cached UDT balance: ${cachedBalance}`);
   *
   * // Convert to human-readable format (assuming 8 decimals)
   * const decimals = await udt.decimals();
   * if (decimals.res !== undefined) {
   *   const humanReadable = ccc.fixedPointToString(totalBalance, Number(decimals.res));
   *   console.log(`Balance: ${humanReadable} tokens`);
   * }
   *
   * // Check if user has sufficient balance for a transfer
   * const requiredAmount = ccc.fixedPointFrom(100);
   * if (totalBalance >= requiredAmount) {
   *   console.log("Sufficient balance for transfer");
   * } else {
   *   console.log(`Insufficient balance. Need ${requiredAmount - totalBalance} more`);
   * }
   * ```
   *
   * @remarks
   * **Performance Considerations:**
   * - This method internally calls `calculateInfo()` and extracts only the balance
   * - Execution time scales linearly with the number of UDT cells
   * - Network overhead increases with cell count when using "chain" source
   * - "local" source is faster but may not reflect the most recent state
   * - Results should be cached when used multiple times
   *
   * **Data Source Options:**
   * - `"chain"` (default): Queries the blockchain directly for the most up-to-date balance
   * - `"local"`: Uses local indexer cache, faster but potentially stale data
   *
   * **When to Use:**
   * - Wallet balance display
   * - Transfer amount validation
   * - Portfolio calculations
   * - Simple balance checks
   *
   * **When NOT to Use:**
   * - In transaction loops or frequent operations
   * - When you also need capacity or count information (use `calculateInfo()` instead)
   * - For transaction input/output analysis (use transaction-specific methods)
   *
   * **Alternative Methods:**
   * - Use `calculateInfo()` if you need additional information beyond balance
   * - Use `getInputsBalance()` for transaction input analysis
   * - Use `getOutputsBalance()` for transaction output analysis
   */
  async calculateBalance(
    signer: ccc.Signer,
    options?: { source?: "chain" | "local" | null },
  ): Promise<ccc.Num> {
    return (await this.calculateInfo(signer, options)).balance;
  }

  /**
   * Adds the UDT script code as a cell dependency to the transaction.
   * This method ensures that the transaction includes the necessary cell dependency
   * for the UDT script code, which is required for any transaction that uses this UDT.
   *
   * @param txLike - The transaction to add the cell dependency to
   * @returns A new transaction with the UDT code cell dependency added
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   *
   * // Create a basic transaction
   * let tx = ccc.Transaction.from({
   *   outputs: [{ lock: recipientLock, type: udt.script }],
   *   outputsData: [ccc.numLeToBytes(100, 16)]
   * });
   *
   * // Add UDT code dependency
   * tx = udt.addCellDeps(tx);
   *
   * // Now the transaction can be completed and sent
   * await tx.completeInputsByCapacity(signer);
   * await tx.completeFeeBy(signer);
   * ```
   *
   * @remarks
   * **When to Use:**
   * - When manually constructing transactions that involve UDT cells
   * - Before sending any transaction that creates or consumes UDT cells
   * - This is automatically called by methods like `transfer()` and `mint()`
   *
   * **Cell Dependency Details:**
   * - Adds the UDT script code outpoint as a "code" type dependency
   * - This allows the transaction to reference and execute the UDT script
   * - Required for script validation during transaction processing
   *
   * **Note:** Most high-level UDT methods automatically add this dependency,
   * so manual usage is typically only needed for custom transaction construction.
   */
  addCellDeps(txLike: ccc.TransactionLike): ccc.Transaction {
    const tx = ccc.Transaction.from(txLike);
    tx.addCellDeps({
      outPoint: this.code,
      depType: "code",
    });
    return tx;
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

    return resTx.map((tx) => this.addCellDeps(tx));
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

    return resTx.map((tx) => this.addCellDeps(tx));
  }

  /**
   * Checks if a cell is a valid UDT cell for this token.
   * A valid UDT cell must have this UDT's type script and contain at least 16 bytes of output data
   * (the minimum required for storing the UDT balance as a 128-bit little-endian integer).
   *
   * @param cellLike - The cell to check, which can be a `ccc.Cell` or a `ccc.CellLike` object.
   * @returns True if the cell is a valid UDT cell for this token, false otherwise
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   * const cell = {
   *   cellOutput: { lock: someLock, type: udt.script },
   *   outputData: ccc.numLeToBytes(1000, 16) // 1000 UDT balance
   * };
   *
   * const isValid = udt.isUdt(cell);
   * console.log(`Is valid UDT cell: ${isValid}`); // true
   * ```
   *
   * @remarks
   * The method checks two conditions:
   * 1. The cell's type script matches this UDT's script
   * 2. The output data is at least 16 bytes long (required for UDT balance storage)
   */
  isUdt(cellLike: ccc.CellAnyLike) {
    const cell = ccc.CellAny.from(cellLike);
    return (
      (cell.cellOutput.type?.eq(this.script) ?? false) &&
      ccc.bytesFrom(cell.outputData).length >= 16
    );
  }

  /**
   * Retrieves comprehensive information about UDT inputs in a transaction.
   * This method analyzes all input cells and returns detailed statistics including
   * total UDT balance, total capacity occupied, and the number of UDT cells.
   *
   * @param client - The client to fetch input cell data
   * @param txLike - The transaction to analyze
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
   * const inputsInfo = await udt.getInputsInfo(client, tx);
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
    client: ccc.Client,
    txLike: ccc.TransactionLike,
  ): Promise<UdtInfo> {
    const tx = ccc.Transaction.from(txLike);
    return ccc.reduceAsync(
      tx.inputs,
      async (acc, input) =>
        this.infoFrom(client, await input.getCell(client), acc),
      UdtInfo.default(),
    );
  }

  /**
   * Calculates the total UDT balance from all inputs in a transaction.
   * This method examines each input cell and sums up the UDT amounts
   * for cells that have this UDT's type script.
   *
   * @param client - The client to fetch input cell data
   * @param txLike - The transaction to analyze
   * @returns A promise resolving to the total UDT balance from all inputs
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   * const tx = ccc.Transaction.from(existingTransaction);
   *
   * const inputBalance = await udt.getInputsBalance(client, tx);
   * console.log(`Total UDT input balance: ${inputBalance}`);
   * ```
   *
   * @remarks
   * This method only counts inputs that have the same type script as this UDT instance.
   * Inputs without a type script or with different type scripts are ignored.
   */
  async getInputsBalance(
    client: ccc.Client,
    txLike: ccc.TransactionLike,
  ): Promise<ccc.Num> {
    return (await this.getInputsInfo(client, txLike)).balance;
  }

  /**
   * Retrieves comprehensive information about UDT outputs in a transaction.
   * This method analyzes all output cells and returns detailed statistics including
   * total UDT balance, total capacity occupied, and the number of UDT cells.
   *
   * @param client - The client parameter (unused for outputs since data is already available)
   * @param txLike - The transaction to analyze
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
   * const outputsInfo = await udt.getOutputsInfo(client, tx);
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
    client: ccc.Client,
    txLike: ccc.TransactionLike,
  ): Promise<UdtInfo> {
    const tx = ccc.Transaction.from(txLike);
    return ccc.reduceAsync(
      tx.outputCells,
      (acc, cell) => this.infoFrom(client, cell, acc),
      UdtInfo.default(),
    );
  }

  /**
   * Calculates the total UDT balance from all outputs in a transaction.
   * This method examines each output cell and sums up the UDT amounts
   * for cells that have this UDT's type script.
   *
   * @param client - The client parameter (passed to getOutputsInfo for consistency)
   * @param txLike - The transaction to analyze
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
   * const outputBalance = await udt.getOutputsBalance(client, tx);
   * console.log(`Total UDT output balance: ${outputBalance}`); // 1500
   * ```
   *
   * @remarks
   * This method only counts outputs that have the same type script as this UDT instance.
   * Outputs without a type script or with different type scripts are ignored.
   * This method is a convenience wrapper around `getOutputsInfo` that returns only the balance.
   */
  async getOutputsBalance(
    client: ccc.Client,
    txLike: ccc.TransactionLike,
  ): Promise<ccc.Num> {
    return (await this.getOutputsInfo(client, txLike)).balance;
  }

  /**
   * Calculates the net UDT balance that would be burned (destroyed) in a transaction.
   * This is the difference between the total UDT balance in inputs and outputs.
   * A positive value indicates UDT tokens are being burned, while a negative value
   * indicates more UDT is being created than consumed (which may require minting permissions).
   *
   * @param client - The client to fetch input cell data
   * @param txLike - The transaction to analyze
   * @returns A promise resolving to the net UDT balance burned (inputs - outputs)
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   * const tx = ccc.Transaction.from(existingTransaction);
   *
   * const burned = await udt.getBalanceBurned(client, tx);
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
    client: ccc.Client,
    txLike: ccc.TransactionLike,
  ): Promise<ccc.Num> {
    const tx = ccc.Transaction.from(txLike);
    return (
      (await this.getInputsBalance(client, tx)) -
      (await this.getOutputsBalance(client, tx))
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
   *     const balance = Udt.balanceFromUnsafe(cell.outputData);
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
    const res = await tx.completeInputs(from, this.filter, accumulator, init);

    return {
      ...res,
      tx,
    };
  }

  /**
   * Completes UDT inputs for a transaction to satisfy both UDT balance and capacity requirements.
   * This method implements intelligent input selection that considers both UDT token balance
   * and cell capacity constraints, optimizing for minimal cell usage while meeting all requirements.
   * It uses sophisticated balance calculations and early exit optimizations for efficiency.
   *
   * @param txLike - The transaction to complete with UDT inputs
   * @param from - The signer that will provide UDT inputs
   * @param balanceTweak - Optional additional UDT balance requirement beyond outputs (default: 0)
   * @param capacityTweak - Optional additional CKB capacity requirement beyond outputs (default: 0)
   * @returns A promise resolving to an object containing:
   *          - tx: The modified transaction with added UDT inputs
   *          - addedCount: Number of UDT input cells that were added
   *
   * @throws {ErrorUdtInsufficientCoin} When there are insufficient UDT cells to cover the required balance
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   *
   * // Basic usage: add inputs to cover UDT outputs
   * const tx = ccc.Transaction.from({
   *   outputs: [{ lock: recipientLock, type: udt.script }],
   *   outputsData: [ccc.numLeToBytes(1000, 16)]
   * });
   *
   * const { tx: completedTx, addedCount } = await udt.completeInputsByBalance(tx, signer);
   * console.log(`Added ${addedCount} UDT inputs to cover 1000 UDT requirement`);
   *
   * // Advanced usage: with balance and capacity tweaks
   * const { tx: advancedTx, addedCount: advancedCount } = await udt.completeInputsByBalance(
   *   tx,
   *   signer,
   *   ccc.numFrom(100), // Extra 100 UDT balance needed
   *   ccc.fixedPointFrom(5000) // Extra 5000 capacity needed
   * );
   * ```
   *
   * @remarks
   * This method implements sophisticated dual-constraint input selection with the following logic:
   *
   * **Constraint Calculations:**
   * - **UDT Balance Deficit**: `(input UDT balance) - (output UDT balance) - balanceTweak`
   * - **Capacity Deficit**: `min((input UDT capacity) - (output UDT capacity), total_tx_fee) - capacityTweak`
   *   The capacity calculation determines how much capacity from UDT cells is available to cover CKB requirements (like transaction fees).
   *   It's capped by the total transaction fee to avoid over-providing capacity from UDT cells if not needed.
   * - The capacity calculation tries to avoid extra occupation by UDT cells and compress UDT state
   *
   * **Early Exit Optimization:**
   * - Returns immediately with `addedCount: 0` if both balance and capacity constraints are satisfied
   * - Avoids unnecessary input addition when existing inputs are sufficient
   *
   * **Smart Input Selection:**
   * - Uses accumulator pattern to track both UDT balance and capacity during selection
   * - Continues adding inputs until both constraints are satisfied: `balanceAcc >= 0 && capacityAcc >= 0`
   * - Prioritizes providing sufficient capacity through UDT cells to avoid extra non-UDT inputs
   *
   * **Error Handling:**
   * - Throws `ErrorUdtInsufficientCoin` with exact shortfall amount if insufficient UDT balance
   * - Only throws error if UDT balance cannot be satisfied (capacity issues don't cause errors)
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
    const { balance: inBalance, capacity: inCapacity } =
      await this.getInputsInfo(from.client, tx);
    const { balance: outBalance, capacity: outCapacity } =
      await this.getOutputsInfo(from.client, tx);

    const balanceBurned =
      inBalance - outBalance - ccc.numFrom(balanceTweak ?? 0);
    // Try to avoid extra occupation by UDT and also try to compress UDT state
    const capacityBurned =
      ccc.numMin(inCapacity - outCapacity, await tx.getFee(from.client)) -
      ccc.numFrom(capacityTweak ?? 0);

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
      async (acc, cell) => {
        const info = await this.infoFrom(from.client, cell, acc);

        // Try to provide enough capacity with UDT cells to avoid extra occupation
        return info.balance >= ccc.Zero && info.capacity >= ccc.Zero
          ? undefined
          : info;
      },
      { balance: balanceBurned, capacity: capacityBurned },
    );

    if (accumulated === undefined || accumulated.balance >= ccc.Zero) {
      return { tx: txRes, addedCount };
    }

    throw new ErrorUdtInsufficientCoin({
      amount: -accumulated.balance,
      type: this.script,
    });
  }

  /**
   * Adds ALL available UDT cells from the signer as inputs to the transaction.
   * Unlike `completeInputsByBalance` which adds only the minimum required inputs,
   * this method collects every available UDT cell that the signer controls,
   * regardless of the transaction's actual UDT requirements.
   *
   * @param txLike - The transaction to add UDT inputs to
   * @param from - The signer that will provide all available UDT inputs
   * @returns A promise resolving to an object containing:
   *          - tx: The transaction with all available UDT inputs added
   *          - addedCount: Number of UDT input cells that were added
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   *
   * // Create a transaction (can be empty or have existing outputs)
   * const tx = ccc.Transaction.from({
   *   outputs: [{ lock: recipientLock, type: udt.script }],
   *   outputsData: [ccc.numLeToBytes(100, 16)] // Send 100 UDT
   * });
   *
   * // Add ALL available UDT cells as inputs
   * const { tx: completedTx, addedCount } = await udt.completeInputsAll(tx, signer);
   * console.log(`Added ${addedCount} UDT cells as inputs`);
   *
   * // The transaction now contains all UDT cells the signer controls
   * const totalInputBalance = await udt.getInputsBalance(completedTx, client);
   * console.log(`Total UDT input balance: ${totalInputBalance}`);
   * ```
   *
   * @remarks
   * **Use Cases:**
   * - **UDT Consolidation**: Combining multiple small UDT cells into fewer larger ones
   * - **Complete Balance Transfer**: Moving all UDT tokens from one address to another
   * - **Wallet Cleanup**: Reducing the number of UDT cells for better wallet performance
   * - **Batch Operations**: When you need to process all UDT holdings at once
   *
   * **Important Considerations:**
   * - This method will likely create a large excess balance that needs to be handled with change outputs
   * - The resulting transaction may be large and expensive due to many inputs
   * - Use `completeInputsByBalance` instead if you only need specific amounts
   * - Always handle the excess balance with appropriate change outputs after calling this method
   *
   * **Behavior:**
   * - Adds every UDT cell that the signer controls and that isn't already used in the transaction
   * - The accumulator tracks total capacity of added cells (used internally for optimization)
   * - Does not stop until all available UDT cells are added
   * - Skips cells that are already present as inputs in the transaction
   */
  async completeInputsAll(
    txLike: ccc.TransactionLike,
    from: ccc.Signer,
  ): Promise<{
    addedCount: number;
    tx: ccc.Transaction;
  }> {
    const tx = ccc.Transaction.from(txLike);

    return this.completeInputs(
      tx,
      from,
      (acc, { cellOutput: { capacity } }) => acc + capacity,
      ccc.Zero,
    );
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
    let tx = this.addCellDeps(ccc.Transaction.from(txLike));

    /* === Figure out the balance to change === */
    if (options?.shouldAddInputs ?? true) {
      tx = (await this.completeInputsByBalance(tx, signer)).tx;
    }

    const balanceBurned = await this.getBalanceBurned(signer.client, tx);

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

    const balanceToChange = await this.getBalanceBurned(signer.client, tx);
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
    const cellOutput = tx.outputs[index];
    const outputData = ccc.bytesFrom(tx.outputsData[index]);

    if (!this.isUdt({ cellOutput: tx.outputs[index], outputData })) {
      throw new Error("Change output must be a UDT cell");
    }

    return this.complete(
      tx,
      signer,
      async (tx, balance, shouldModify) => {
        if (shouldModify) {
          const balanceData = ccc.numLeToBytes(
            await this.balanceFrom(
              signer.client,
              {
                cellOutput,
                outputData,
              },
              balance,
            ),
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
