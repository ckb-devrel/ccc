import { ccc } from "@ckb-ccc/core";
import { ssri } from "@ckb-ccc/ssri";
import { Udt, UdtConfigLike } from "../udt/index.js";

/**
 * Represents a UDT (User Defined Token) with pausable functionality.
 * @extends {Udt} This must be a SSRI UDT that does not fallback to xUDT.
 * @public
 */
export class UdtPausable extends Udt {
  constructor(
    code: ccc.OutPointLike,
    script: ccc.ScriptLike,
    config: UdtConfigLike & { executor: ssri.Executor },
  ) {
    super(code, script, config);
  }

  /**
   * Pauses the UDT for the specified lock hashes. Pausing/Unpause without lock hashes should take effect on the global level. Note that this method is only available if the pausable UDT uses external pause list.
   * @param {ccc.HexLike[]} lockHashes - The array of lock hashes to be paused.
   * @param {ccc.TransactionLike} tx - The transaction to be used.
   * @returns The transaction result.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction to be sent.
   */
  async pause(
    signer: ccc.Signer,
    locks: ccc.ScriptLike[],
    tx?: ccc.TransactionLike | null,
    extraLockHashes?: ccc.HexLike[] | null,
  ): Promise<ssri.ExecutorResponse<ccc.Transaction>> {
    const txReq = ccc.Transaction.from(tx ?? {});
    await txReq.completeInputsAtLeastOne(signer);

    const res = await this.assertExecutor().runScript(
      this.code,
      "UDTPausable.pause",
      [
        txReq.toBytes(),
        ccc.mol.Byte32Vec.encode(
          locks
            .map((l) => ccc.Script.from(l).hash())
            .concat(extraLockHashes?.map(ccc.hexFrom) ?? []),
        ),
      ],
      { script: this.script },
    );
    const resTx = res.map((res) => ccc.Transaction.fromBytes(res));
    resTx.res.addCellDeps({
      outPoint: this.code,
      depType: "code",
    });
    return resTx;
  }

  /**
   * Unpauses the UDT for the specified lock hashes. Note that this method is only available if the pausable UDT uses external pause list.
   * @param tx - The transaction to be used.
   * @param lockHashes - The array of lock hashes to be unpaused.
   * @returns The transaction result.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction to be sent.
   */
  async unpause(
    signer: ccc.Signer,
    locks: ccc.ScriptLike[],
    tx?: ccc.TransactionLike | null,
    extraLockHashes?: ccc.HexLike[] | null,
  ): Promise<ssri.ExecutorResponse<ccc.Transaction>> {
    const txReq = ccc.Transaction.from(tx ?? {});
    await txReq.completeInputsAtLeastOne(signer);

    const res = await this.assertExecutor().runScript(
      this.code,
      "UDTPausable.unpause",
      [
        txReq.toBytes(),
        ccc.mol.Byte32Vec.encode(
          locks
            .map((l) => ccc.Script.from(l).hash())
            .concat(extraLockHashes?.map(ccc.hexFrom) ?? []),
        ),
      ],
      { script: this.script },
    );
    const resTx = res.map((res) => ccc.Transaction.fromBytes(res));
    resTx.res.addCellDeps({
      outPoint: this.code,
      depType: "code",
    });
    return resTx;
  }

  /**
   * Checks if the UDT is paused for the specified lock hashes within a transaction. If not using external pause list, it can also be run on Code environment level.
   * @param lockHashes - The lock hashes to check.
   * @returns True if any of the lock hashes are paused, false otherwise.
   */
  async isPaused(
    locks: ccc.ScriptLike[],
    extraLockHashes?: ccc.HexLike[] | null,
  ): Promise<ssri.ExecutorResponse<boolean[]>> {
    const res = await this.assertExecutor().runScript(
      this.code,
      "UDTPausable.is_paused",
      [
        ccc.mol.Byte32Vec.encode(
          locks
            .map((l) => ccc.Script.from(l).hash())
            .concat(extraLockHashes?.map(ccc.hexFrom) ?? []),
        ),
      ],
      { script: this.script },
    );
    return res.map((res) => ccc.mol.BoolVec.decode(res));
  }

  /**
   * Enumerates all paused lock hashes in UDTPausableData.
   * @returns The array of lock hashes.
   */
  async enumeratePaused(
    offset?: ccc.Num,
    limit?: ccc.Num,
  ): Promise<ssri.ExecutorResponse<ccc.Hex[]>> {
    const res = await this.assertExecutor().runScript(
      this.code,
      "UDTPausable.enumerate_paused",
      [ccc.numToBytes(offset ?? 0, 8), ccc.numToBytes(limit ?? 0, 8)],
      { script: this.script },
    );

    return res.map((res) => ccc.mol.Byte32Vec.decode(res));
  }
}
