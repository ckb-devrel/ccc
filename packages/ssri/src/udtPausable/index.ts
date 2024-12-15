import { ccc, Hex, numToBytes, TransactionLike, mol } from "@ckb-ccc/core";
import { SSRICallParams, ssriUtils } from "../ssri/index.js";
import { UDT } from "../index.js";

/**
 * Represents a pausable functionality for a UDT (User Defined Token).
 * @extends {UDT} in a composition style.
 * @public
 */
export class UDTPausable extends UDT {
  cache: Map<string, unknown> = new Map();
  private static readonly u832Codec = mol.array(mol.Uint8, 32);
  private static readonly u832VecCodec = mol.vector(this.u832Codec);
  private static readonly udtPausableDataCodec = mol.table({
    pause_list: this.u832VecCodec,
    next_type_script: mol.option(mol.Script),
  });

  /**
   * Pauses the UDT for the specified lock hashes. Pausing/Unpause without lock hashes should take effect on the global level. Note that this method is only available if the pausable UDT uses external pause list.
   * @param {TransactionLike} [tx] - The transaction to be used.
   * @param {HexLike[]} lockHashes - The array of lock hashes to be paused.
   * @returns {Promise<TransactionLike>} The transaction result.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction to be sent.
   */
  async pause(
    tx: TransactionLike | undefined,
    lockHashes: Hex[],
    params?: SSRICallParams,
  ): Promise<TransactionLike> {
    // NOTE: In case that Pausable UDT doesn't have external pause list, a signer would be required to generate the first external pause list.
    ssriUtils.validateSSRIParams(params, { signer: true, tx: true });
    const txEncodedHex = tx
      ? ssriUtils.encodeHex(mol.Transaction.encode(tx))
      : "0x";

    const { script: ownerLock } =
      await params!.signer!.getRecommendedAddressObj();
    if (!params?.cell) {
      const dummy_typeid_script = await ccc.Script.fromKnownScript(
        this.server.client,
        ccc.KnownScript.TypeId,
        "0x",
      );
      params!.cell = {
        cell_output: {
          capacity: BigInt(0),
          lock: {
            code_hash: ownerLock.codeHash,
            args: ownerLock.args,
            hash_type: ownerLock.hashType,
          },
          type: {
            code_hash: dummy_typeid_script.codeHash,
            args: dummy_typeid_script.args,
            hash_type: dummy_typeid_script.hashType,
          },
        },
        hex_data: `0x`,
      };
    }

    const lockHashU832Array = [];
    for (const lockHash of lockHashes) {
      lockHashU832Array.push(numToBytes(String(lockHash), 32).reverse());
    }
    const lockHashU832ArrayEncoded =
      udtPausableUtils.encodeU832Array(lockHashU832Array);
    const lockHashU832ArrayEncodedHex = ssriUtils.encodeHex(
      lockHashU832ArrayEncoded,
    );
    const rawResult = await this.callMethod(
      "UDTPausable.pause",
      [txEncodedHex, lockHashU832ArrayEncodedHex],
      { ...params },
    );
    const pauseTx = mol.Transaction.decode(rawResult);
    const cccPauseTx = ssriUtils.recalibrateCapacity(
      ccc.Transaction.from(pauseTx),
    );
    return cccPauseTx;
  }

  /**
   * Unpauses the UDT for the specified lock hashes. Pausing/Unpause without lock hashes should take effect on the global level. Note that this method is only available if the pausable UDT uses external pause list.
   * @param {TransactionLike} tx - The transaction to be used.
   * @param {HexLike[]} lockHashes - The array of lock hashes to be unpaused.
   * @returns {Promise<TransactionLike>} The transaction result.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction to be sent.
   */
  async unpause(
    tx: TransactionLike | undefined,
    lockHashes: Hex[],
    params?: SSRICallParams,
  ): Promise<TransactionLike> {
    ssriUtils.validateSSRIParams(params, { tx: true });
    const txEncodedHex = tx
      ? ssriUtils.encodeHex(mol.Transaction.encode(tx))
      : "0x";
    const lockHashU832Array = [];
    for (const lockHash of lockHashes) {
      lockHashU832Array.push(numToBytes(String(lockHash), 32).reverse());
    }
    const lockHashU832ArrayEncoded =
      udtPausableUtils.encodeU832Array(lockHashU832Array);
    const lockHashU832ArrayEncodedHex = ssriUtils.encodeHex(
      lockHashU832ArrayEncoded,
    );
    const rawResult = await this.callMethod(
      "UDTPausable.unpause",
      [txEncodedHex, lockHashU832ArrayEncodedHex],
      { ...params },
    );
    const unPauseTx = mol.Transaction.decode(rawResult);
    const cccPauseTx = ssriUtils.recalibrateCapacity(
      ccc.Transaction.from(unPauseTx),
    );
    return cccPauseTx;
  }

  /**
   * Checks if the UDT is paused for the specified lock hashes within a transaction. If not using external pause list, it can also be run on Code environment level.
   * @param {HexLike[]} [lockHashes] - The lock hash to check.
   * @returns {Promise<boolean>} True if any of the lock hashes are paused, false otherwise.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Transaction
   */
  async isPaused(lockHashes: Hex[], params?: SSRICallParams): Promise<boolean> {
    ssriUtils.validateSSRIParams(params, {});
    const lockHashU832Array = [];
    for (const lockHash of lockHashes) {
      lockHashU832Array.push(numToBytes(String(lockHash), 32).reverse());
    }
    const lockHashU832ArrayEncoded =
      udtPausableUtils.encodeU832Array(lockHashU832Array);
    const lockHashU832ArrayEncodedHex = ssriUtils.encodeHex(
      lockHashU832ArrayEncoded,
    );
    const rawResult = await this.callMethod(
      "UDTPausable.is_paused",
      [lockHashU832ArrayEncodedHex],
      { ...params },
    );
    return rawResult === "0x01";
  }

  /**
   * Enumerates all paused lock hashes.
   * @returns {Promise<HexLike[]>} The array of paused lock hashes.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Transaction
   */
  async enumeratePaused(
    offset = 0,
    limit = 0,
    params?: SSRICallParams,
  ): Promise<unknown[]> {
    let rawResult: Hex;
    if (
      !params?.noCache &&
      this.cache.has("enumeratePaused") &&
      offset === 0 &&
      limit === 0
    ) {
      rawResult = this.cache.get("enumeratePaused") as Hex;
    } else {
      rawResult = await this.callMethod(
        "UDTPausable.enumerate_paused",
        [
          ssriUtils.encodeHex(numToBytes(offset, 4)),
          ssriUtils.encodeHex(numToBytes(limit, 4)),
        ],
        params,
      );
      this.cache.set("enumeratePaused", rawResult);
    }
    const udtPausableDataInBytesVec = mol.BytesVec.decode(rawResult);
    const udtPausableDataArray = [];
    for (const udtPausableDataInBytes of udtPausableDataInBytesVec) {
      const udtPausableData = UDTPausable.udtPausableDataCodec.decode(
        udtPausableDataInBytes,
      );
      udtPausableDataArray.push(udtPausableData);
    }
    return udtPausableDataArray;
  }
}

export const udtPausableUtils = {
  encodeU832Array(val: Array<Uint8Array>): Uint8Array {
    if (val.some((arr) => arr.length !== 32)) {
      throw new Error("Each inner array must be exactly 32 bytes.");
    }

    // Convert the length to a 4-byte little-endian array
    const lengthBytes = new Uint8Array(new Uint32Array([val.length]).buffer);

    // Flatten the 2D array of 32-byte elements into a single array
    const flattenedBytes = val.reduce((acc, curr) => {
      acc.push(...curr);
      return acc;
    }, [] as number[]);

    // Combine the length bytes with the flattened byte array
    return new Uint8Array([...lengthBytes, ...flattenedBytes]);
  },
};
