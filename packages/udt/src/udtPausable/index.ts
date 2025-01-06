import { ccc, mol } from "@ckb-ccc/core";
import { ssri } from "@ckb-ccc/ssri";
import { UDT } from "../udt/index.js";
import { u832Codec, u832VecCodec, udtPausableDataCodec } from "./advanced.js";

/**
 * Represents a UDT (User Defined Token) with pausable functionality.
 * @extends {UDT} This must be a SSRI UDT that does not fallback to xUDT.
 * @public
 */
export class UDTPausable extends UDT {
  /**
   * Constructs a new Pausable UDT (User Defined Token) contract instance.
   * Unlike `UDT`, `UDTPausable` contract cannot be instantiated in legacy mode.
   *
   * @param {ccc.ScriptLike} script - The script defining the UDT contract's location.
   * @param {ccc.CellDepLike} cellDep - The contract code cell dependency of the Pausable UDT.
   * @param {ssri.Server | string} ssriServer - The SSRI server instance or URL.
   * @example
   * ```typescript
   * const udtPausable = new UDTPausable(script, cellDep, "https://localhost:9090");
   * ```
   */
  constructor(
    script: ccc.ScriptLike,
    cellDep: ccc.CellDepLike,
    ssriServer: ssri.Server | string,
  ) {
    super(script, cellDep, ssriServer);
  }

  /**
   * Pauses the UDT for the specified lock hashes. Pausing/Unpause without lock hashes should take effect on the global level. Note that this method is only available if the pausable UDT uses external pause list.
   * @param {ccc.TransactionLike} [tx] - The transaction to be used.
   * @param {ccc.HexLike[]} lockHashes - The array of lock hashes to be paused.
   * @returns {Promise<ccc.Transaction>} The transaction result.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction to be sent.
   */
  async pause(
    tx: ccc.TransactionLike | undefined,
    lockHashes: ccc.HexLike[],
  ): Promise<ccc.Transaction> {
    const txEncodedHex = tx ? ccc.hexFrom(ccc.Transaction.encode(tx)) : "0x";

    const lockHashU832Array = [];
    for (const lockHash of lockHashes) {
      lockHashU832Array.push(u832Codec.encode(lockHash));
    }
    const lockHashU832ArrayEncoded = u832VecCodec.encode(lockHashU832Array);
    const lockHashU832ArrayEncodedHex = ccc.hexFrom(lockHashU832ArrayEncoded);
    const rawResult = await this.ssriServer.callMethod(
      "UDTPausable.pause",
      [txEncodedHex, lockHashU832ArrayEncodedHex],
      this.cellDep.outPoint,
      { script: this.type },
    );
    const pauseTx = ccc.Transaction.decode(rawResult);
    // TODO: Fill in missing TypeID args.
    return pauseTx;
  }

  /**
   * Unpauses the UDT for the specified lock hashes. Note that this method is only available if the pausable UDT uses external pause list.
   * @param {ccc.TransactionLike} tx - The transaction to be used.
   * @param {ccc.HexLike[]} lockHashes - The array of lock hashes to be unpaused.
   * @returns {Promise<ccc.Transaction>} The transaction result.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction to be sent.
   */
  async unpause(
    tx: ccc.TransactionLike | undefined,
    lockHashes: ccc.HexLike[],
  ): Promise<ccc.Transaction> {
    const txEncodedHex = tx ? ccc.hexFrom(ccc.Transaction.encode(tx)) : "0x";
    const lockHashU832Array = [];
    for (const lockHash of lockHashes) {
      lockHashU832Array.push(u832Codec.encode(lockHash));
    }
    const lockHashU832ArrayEncoded = u832VecCodec.encode(lockHashU832Array);
    const lockHashU832ArrayEncodedHex = ccc.hexFrom(lockHashU832ArrayEncoded);
    const rawResult = await this.ssriServer.callMethod(
      "UDTPausable.unpause",
      [txEncodedHex, lockHashU832ArrayEncodedHex],
      this.cellDep.outPoint,
      { script: this.type },
    );
    return ccc.Transaction.decode(rawResult);
  }

  /**
   * Checks if the UDT is paused for the specified lock hashes within a transaction. If not using external pause list, it can also be run on Code environment level.
   * @param {ccc.HexLike[]} [lockHashes] - The lock hash to check.
   * @returns {Promise<boolean>} True if any of the lock hashes are paused, false otherwise.
   */
  async isPaused(lockHashes: ccc.HexLike[]): Promise<boolean[]> {
    const lockHashU832Array = [];
    for (const lockHash of lockHashes) {
      lockHashU832Array.push(u832Codec.encode(lockHash));
    }
    const lockHashU832ArrayEncoded = u832VecCodec.encode(lockHashU832Array);
    const lockHashU832ArrayEncodedHex = ccc.hexFrom(lockHashU832ArrayEncoded);
    const rawResult = await this.ssriServer.callMethod(
      "UDTPausable.is_paused",
      [lockHashU832ArrayEncodedHex],
      this.cellDep.outPoint,
      { script: this.type },
    );
    const resultBytes = ccc.bytesFrom(rawResult);
    return Array.from(resultBytes).map((byte) => byte === 1);
  }

  /**
   * Enumerates all paused lock hashes in UDTPausableData.
   * @returns {Promise<UDTPausableData[]>} The array of UDTPausableData.
   */
  async enumeratePaused(offset?: ccc.Num, limit?: ccc.Num): Promise<unknown[]> {
    const rawResult = await this.ssriServer.callMethod(
      "UDTPausable.enumerate_paused",
      [ccc.numToHex(offset ?? 0), ccc.numToHex(limit ?? 0)],
      this.cellDep.outPoint,
      { script: this.type },
    );
    const udtPausableDataInBytesVec = mol.BytesVec.decode(rawResult);
    const udtPausableDataArray = [];
    for (const udtPausableDataInBytes of udtPausableDataInBytesVec) {
      const udtPausableData = udtPausableDataCodec.decode(
        udtPausableDataInBytes,
      );
      udtPausableDataArray.push(udtPausableData);
    }
    return udtPausableDataArray;
  }
}
