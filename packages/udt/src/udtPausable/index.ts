import { ccc, mol } from "@ckb-ccc/core";
import { ssri } from "@ckb-ccc/ssri";
import { UDT } from "../udt/index.js";
import { udtPausableDataCodec, u832VecCodec } from "./advanced.js";

/**
 * Represents a pausable functionality for a UDT (User Defined Token).
 * @extends {UDT} This must be a SSRI UDT that does not fallback to xUDT.
 * @public
 */
export class UDTPausable extends UDT {
  cache: Map<string, unknown> = new Map();
  

  /**
   * Pauses the UDT for the specified lock hashes. Pausing/Unpause without lock hashes should take effect on the global level. Note that this method is only available if the pausable UDT uses external pause list.
   * @param {ccc.Transaction} [tx] - The transaction to be used.
   * @param {ccc.Hex[]} lockHashes - The array of lock hashes to be paused.
   * @returns {Promise<ccc.Transaction>} The transaction result.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction to be sent.
   * @tag Cell - This method accepts one of the pausable data cell; if not provided, it would be automatically redirect to the last pausable data cell. If there is no pausable data cell, it would be automatically generate one which needs to be pointed to in the next_type_script field in the contract.
   * @tag Signer - This method requires a signer to generate the first external pause list or modify the existing external pause list.
   */
  async pause(
    tx: ccc.Transaction | undefined,
    lockHashes: ccc.Hex[],
    signer: ccc.Signer,
    cell?: ccc.Cell
  ): Promise<ccc.Transaction> {
    // NOTE: In case that Pausable UDT doesn't have external pause list, a signer would be required to generate the first external pause list.
    const txEncodedHex = tx
      ? ccc.hexFrom(ccc.Transaction.encode(tx))
      : "0x";
    const { script: ownerLock } =
      await signer.getRecommendedAddressObj();
    let cellForSSRI;
    const dummy_typeid_script = await ccc.Script.fromKnownScript(
      this.server.client,
      ccc.KnownScript.TypeId,
      "0x",
    );
    if (!cell) {
      cellForSSRI = {
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
        hex_data: `0x` as ccc.Hex,
      };
    } else {
      cellForSSRI = {
        cell_output: {
          capacity: cell.cellOutput.capacity.toString(),
          lock: {
            code_hash: cell.cellOutput.lock.codeHash,
            args: cell.cellOutput.lock.args,
            hash_type: cell.cellOutput.lock.hashType,
          },
          type: {
            code_hash: cell.cellOutput?.type?.codeHash ?? dummy_typeid_script.codeHash,
            args: cell.cellOutput?.type?.args ?? dummy_typeid_script.args,
            hash_type: cell.cellOutput?.type?.hashType ?? dummy_typeid_script.hashType,
          },
        },
        hex_data: cell.outputData,
      };
    }

    const lockHashU832Array = [];
    for (const lockHash of lockHashes) {
      lockHashU832Array.push(Array.from(ccc.numToBytes(String(lockHash), 32).reverse()));
    }
    const lockHashU832ArrayEncoded = u832VecCodec.encode(lockHashU832Array);
    const lockHashU832ArrayEncodedHex = ccc.hexFrom(
      lockHashU832ArrayEncoded,
    );
    const rawResult = await this.callMethod(
      "UDTPausable.pause",
      [txEncodedHex, lockHashU832ArrayEncodedHex],
      undefined,
      cellForSSRI,
    );
    const pauseTx = ccc.Transaction.decode(rawResult);
    const cccPauseTx = ssri.utils.recalibrateCapacity(
      ccc.Transaction.from(pauseTx),
    );
    return cccPauseTx;
  }

  /**
   * Unpauses the UDT for the specified lock hashes. Note that this method is only available if the pausable UDT uses external pause list.
   * @param {ccc.Transaction} tx - The transaction to be used.
   * @param {ccc.Hex[]} lockHashes - The array of lock hashes to be unpaused.
   * @returns {Promise<ccc.Transaction>} The transaction result.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction to be sent.
   */
  async unpause(
    tx: ccc.Transaction | undefined,
    lockHashes: ccc.Hex[],
  ): Promise<ccc.Transaction> {
    const txEncodedHex = tx
      ? ccc.hexFrom(ccc.Transaction.encode(tx))
      : "0x";
    const lockHashU832Array = [];
    for (const lockHash of lockHashes) {
      lockHashU832Array.push(Array.from(ccc.numToBytes(String(lockHash), 32).reverse()));
    }
    const lockHashU832ArrayEncoded =
      u832VecCodec.encode(lockHashU832Array);
    const lockHashU832ArrayEncodedHex = ccc.hexFrom(
      lockHashU832ArrayEncoded,
    );
    const rawResult = await this.callMethod(
      "UDTPausable.unpause",
      [txEncodedHex, lockHashU832ArrayEncodedHex],
    );
    const unPauseTx = ccc.Transaction.decode(rawResult);
    const cccPauseTx = ssri.utils.recalibrateCapacity(
      ccc.Transaction.from(unPauseTx),
    );
    return cccPauseTx;
  }

  /**
   * Checks if the UDT is paused for the specified lock hashes within a transaction. If not using external pause list, it can also be run on Code environment level.
   * @param {ccc.Hex[]} [lockHashes] - The lock hash to check.
   * @returns {Promise<boolean>} True if any of the lock hashes are paused, false otherwise.
   */
  async isPaused(
    lockHashes: ccc.Hex[],
  ): Promise<boolean> {
    const lockHashU832Array = [];
    for (const lockHash of lockHashes) {
      lockHashU832Array.push(Array.from(ccc.numToBytes(String(lockHash), 32).reverse()));
    }
    const lockHashU832ArrayEncoded =
      u832VecCodec.encode(lockHashU832Array);
    const lockHashU832ArrayEncodedHex = ccc.hexFrom(
      lockHashU832ArrayEncoded,
    );
    const rawResult = await this.callMethod(
      "UDTPausable.is_paused",
      [lockHashU832ArrayEncodedHex],
    );
    return rawResult === "0x01";
  }

  /**
   * Enumerates all paused lock hashes in UDTPausableData.
   * @returns {Promise<UDTPausableData[]>} The array of UDTPausableData.
   */
  async enumeratePaused(
    offset?: ccc.Num,
    limit?: ccc.Num,
  ): Promise<unknown[]> {
    const rawResult = await this.callMethod(
      "UDTPausable.enumerate_paused",
      [
        ccc.hexFrom(ccc.numToBytes(offset ?? 0, 4)),
        ccc.hexFrom(ccc.numToBytes(limit ?? 0, 4)),
      ],
      undefined,
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

