import { ccc } from "@ckb-ccc/core";
import { ssri } from "@ckb-ccc/ssri";
import { Udt, UdtConfigLike } from "../udt/index.js";

/**
 * The basic metadata of a UDT token.
 *
 * @example
 * ```typescript
 * const metadataMolecule = UdtMetadata.encode({
 *   name: "My UDT",
 *   symbol: "MYUDT",
 *   decimals: 8,
 *   icon: "https://example.com/icon.png",
 * });
 * ```
 *
 * @public
 * @category UDT
 */
export const UdtMetadata = ccc.mol.table({
  name: ccc.mol.String,
  symbol: ccc.mol.String,
  decimals: ccc.mol.Uint8,
  icon: ccc.mol.String,
});

/**
 * Represents a UDT (User Defined Token) with separated SSRI metadata functionality.
 * @extends {Udt} This must be a SSRI UDT that does not fallback to xUDT.
 * @public
 */
export class UdtRegister extends Udt {
  constructor(
    code: ccc.OutPointLike,
    script: ccc.ScriptLike,
    config: UdtConfigLike & { executor: ssri.Executor },
  ) {
    super(code, script, config);
  }

  /**
   * Registers (creates) a new UDT with on-chain metadata.
   * This method creates a new unique UDT instance (usually with a TypeId pattern),
   * assigns on-chain metadata (name, symbol, decimals, icon), and returns a transaction
   * to instantiate the new token. Often used by the deployer/owner.
   *
   * @param signer - The signer (owner) who will initialize and own the new UDT
   * @param metadata - Object containing UDT metadata (name, symbol, decimals, icon)
   * @param tx - Optional existing transaction to build upon
   * @returns Promise resolving to `{ tx, tokenHash }`, where `tx` is the deployment transaction,
   *   and `tokenHash` is the computed TypeId/Token hash of the new UDT
   *
   * @example
   * ```typescript
   * const udt = new Udt(codeOutPoint, scriptConfig);
   * const { tx, tokenHash } = await udt.register(
   *   signer,
   *   { name: "My UDT", symbol: "MYT", decimals: 8, icon: "https://..." }
   * );
   * // Send tx.res or complete tx.res and send the transaction
   * ```
   *
   * @remarks
   * - Uses SSRI executor if available for advanced/SSRI-compliant registration.
   * - Falls back to legacy registration (TypeId pattern) if no executor is present.
   * - The token hash can be used as the args for the UDT type script.
   */
  async register(
    signer: ccc.Signer,
    metadata: {
      name: string;
      symbol: string;
      decimals: number;
      icon: string;
    },
    tx?: ccc.TransactionLike | null,
  ): Promise<{
    tx: ssri.ExecutorResponse<ccc.Transaction>;
    tokenHash: ccc.Hex;
  }> {
    const owner = await signer.getRecommendedAddressObj();
    const register = ccc.Transaction.from(tx ?? {});
    if (register.inputs.length === 0) {
      await register.completeInputsAtLeastOne(signer); // For `TypeId` calcuclation
    }
    const tokenHash = ccc.hashTypeId(
      register.inputs[0],
      register.outputs.length,
    );

    let resTx;
    if (this.executor) {
      const res = await this.executor.runScriptTry(
        this.code,
        "UDTSSRI.create",
        [
          register.toBytes(),
          ccc.Script.from(owner.script).toBytes(),
          UdtMetadata.encode(metadata),
        ],
      );
      if (res) {
        resTx = res.map((res) => ccc.Transaction.fromBytes(res));
      }
    }

    // Fallback logic
    if (!resTx) {
      register.addOutput(
        {
          lock: owner.script,
          type: {
            codeHash:
              "00000000000000000000000000000000000000000000000000545950455f4944",
            hashType: "type",
            args: tokenHash,
          },
        },
        UdtMetadata.encode(metadata),
      );
      resTx = ssri.ExecutorResponse.new(register);
    }

    return {
      tx: resTx.map((tx) => this.addCellDeps(tx)),
      tokenHash,
    };
  }
}
