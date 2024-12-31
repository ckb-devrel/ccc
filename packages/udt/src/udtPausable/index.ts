import { ccc, mol } from "@ckb-ccc/core";
import { SSRICallParams, ssriUtils } from "@ckb-ccc/ssri";
import { UDT } from "../index.js";
import { udtPausableDataCodec } from "./advanced.js";

/**
 * Represents a pausable functionality for a UDT (User Defined Token).
 * @extends {UDT} in a composition style.
 * @public
 */
export class UDTPausable extends UDT {
  cache: Map<string, unknown> = new Map();
  

  /**
   * Pauses the UDT for the specified lock hashes. Pausing/Unpause without lock hashes should take effect on the global level. Note that this method is only available if the pausable UDT uses external pause list.
   * @param {TransactionLike} [tx] - The transaction to be used.
   * @param {Hex[]} lockHashes - The array of lock hashes to be paused.
   * @returns {Promise<Transaction>} The transaction result.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction to be sent.
   */
  async pause(
    tx: ccc.Transaction | undefined,
    lockHashes: ccc.Hex[],
    params?: SSRICallParams,
  ): Promise<ccc.Transaction> {
    // NOTE: In case that Pausable UDT doesn't have external pause list, a signer would be required to generate the first external pause list.
    ssriUtils.validateSSRIParams(params, { signer: true });
    const txEncodedHex = tx
      ? ssriUtils.encodeHex(ccc.Transaction.encode(tx))
      : "0x";
    if (!params) {
      throw new Error("Params are required");
    }
    if (!params.signer) {
      throw new Error("Signer is required");
    }
    const { script: ownerLock } =
      await params.signer.getRecommendedAddressObj();
    if (!params.cell) {
      const dummy_typeid_script = await ccc.Script.fromKnownScript(
        this.server.client,
        ccc.KnownScript.TypeId,
        "0x",
      );
      params.cell = {
        cell_output: {
          capacity: ccc.numToHex(0),
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
      lockHashU832Array.push(ccc.numToBytes(String(lockHash), 32).reverse());
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
    const pauseTx = ccc.Transaction.decode(rawResult);
    const cccPauseTx = ssriUtils.recalibrateCapacity(
      ccc.Transaction.from(pauseTx),
    );
    return cccPauseTx;
  }

  /**
   * Unpauses the UDT for the specified lock hashes. Note that this method is only available if the pausable UDT uses external pause list.
   * @param {TransactionLike} tx - The transaction to be used.
   * @param {Hex[]} lockHashes - The array of lock hashes to be unpaused.
   * @returns {Promise<Transaction>} The transaction result.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction to be sent.
   */
  async unpause(
    tx: ccc.Transaction | undefined,
    lockHashes: ccc.Hex[],
    params?: SSRICallParams,
  ): Promise<ccc.Transaction> {
    const txEncodedHex = tx
      ? ssriUtils.encodeHex(ccc.Transaction.encode(tx))
      : "0x";
    const lockHashU832Array = [];
    for (const lockHash of lockHashes) {
      lockHashU832Array.push(ccc.numToBytes(String(lockHash), 32).reverse());
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
    const unPauseTx = ccc.Transaction.decode(rawResult);
    const cccPauseTx = ssriUtils.recalibrateCapacity(
      ccc.Transaction.from(unPauseTx),
    );
    return cccPauseTx;
  }

  /**
   * Checks if the UDT is paused for the specified lock hashes within a transaction. If not using external pause list, it can also be run on Code environment level.
   * @param {Hex[]} [lockHashes] - The lock hash to check.
   * @returns {Promise<boolean>} True if any of the lock hashes are paused, false otherwise.
   */
  async isPaused(
    lockHashes: ccc.Hex[],
    params?: SSRICallParams,
  ): Promise<boolean> {
    ssriUtils.validateSSRIParams(params, {});
    const lockHashU832Array = [];
    for (const lockHash of lockHashes) {
      lockHashU832Array.push(ccc.numToBytes(String(lockHash), 32).reverse());
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
   * Enumerates all paused lock hashes in UDTPausableData.
   * @returns {Promise<UDTPausableData[]>} The array of UDTPausableData.
   */
  async enumeratePaused(
    offset?: bigint,
    limit?: bigint,
    params?: SSRICallParams,
  ): Promise<unknown[]> {
    let rawResult: ccc.Hex;
    if (
      !params?.noCache &&
      this.cache.has("enumeratePaused") &&
      !offset &&
      !limit
    ) {
      rawResult = this.cache.get("enumeratePaused") as ccc.Hex;
    } else {
      rawResult = await this.callMethod(
        "UDTPausable.enumerate_paused",
        [
          ssriUtils.encodeHex(ccc.numToBytes(offset ?? 0, 4)),
          ssriUtils.encodeHex(ccc.numToBytes(limit ?? 0, 4)),
        ],
        params,
      );
      this.cache.set("enumeratePaused", rawResult);
    }
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

export const udtPausableUtils = {
  encodeU832Array(val: Array<ccc.Bytes>): ccc.Bytes {
    if (val.some((arr) => arr.length !== 32)) {
      throw new Error("Each inner array must be exactly 32 bytes.");
    }

    // Convert the length to a 4-byte little-endian array
    const lengthBytes = ccc.bytesFrom(new Uint32Array([val.length]));

    // Flatten the 2D array of 32-byte elements into a single array
    const flattenedBytes = val.reduce((acc, curr) => {
      acc = ccc.bytesConcat(acc, curr);
      return acc;
    }, ccc.bytesFrom("0x"));

    // Combine the length bytes with the flattened byte array
    return ccc.bytesConcat(lengthBytes, flattenedBytes);
  },
};
