// Example: Issue an xUDT token using the Single-Use-Seal (SUS) pattern.

import { ccc } from "@ckb-ccc/ccc";
import { signer } from "@ckb-ccc/playground";

/* ============================================================
 * Types
 * ============================================================ */

/**
 * @public
 * @category Token
 */
interface TokenMetadata {
  decimals: number;
  symbol: string;
  /** Falls back to `symbol` when omitted/blank */
  name?: string;
}

/**
 * The 3 on-chain steps of the SingleUseLock (SUS) issuance flow, in order.
 * @public
 * @category Token
 */
type IssueStep = "seal" | "owner" | "mint";

/**
 * @public
 * @category Token
 */
interface IssueXudtSusParams extends TokenMetadata {
  /** Human-readable total supply, e.g. 100_000_000 (converted to Shannon internally) */
  totalSupply: ccc.FixedPointLike;
  /** Optional hook, fired after each of the 3 on-chain steps is broadcast */
  onProgress?: (step: IssueStep, txHash: ccc.Hex) => void;
}

/**
 * @public
 * @category Token
 */
interface IssueXudtSusResult {
  sealTxHash: ccc.Hex;
  ownerTxHash: ccc.Hex;
  mintTxHash: ccc.Hex;
  typeScriptHash: ccc.Hex;
}

/* ============================================================
 * Token metadata encoding (pure, no chain I/O)
 * ============================================================ */

/**
 * Encodes xUDT token metadata (decimals + name + symbol) into the
 * `UniqueType` cell data layout.
 * @public
 * @category Token
 *
 * @param metadata - The token's decimals, symbol, and optional name.
 * @returns The encoded bytes to be used as `outputsData` for the `UniqueType` cell.
 * @throws If `symbol` is missing, `decimals` is out of the 0-255 range, or
 * either `symbol`/`name` exceeds 255 UTF-8 bytes.
 */
function encodeTokenInfo({
  decimals,
  symbol,
  name,
}: TokenMetadata): Uint8Array {
  if (!symbol) {
    throw new Error("symbol is required");
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error("decimals must be an integer within 0-255 (1-byte field)");
  }

  const symbolBytes = ccc.bytesFrom(symbol, "utf8");
  const nameBytes = ccc.bytesFrom(name?.trim() ? name : symbol, "utf8");

  // Each string is length-prefixed with a single byte -> hard cap at 255 bytes
  if (symbolBytes.length > 255 || nameBytes.length > 255) {
    throw new Error("symbol/name must each be <= 255 bytes when UTF-8 encoded");
  }

  return ccc.bytesConcat(
    ccc.numToBytes(decimals, 1),
    ccc.numToBytes(nameBytes.length, 1),
    nameBytes,
    ccc.numToBytes(symbolBytes.length, 1),
    symbolBytes,
  );
}

/**
 * Issues an xUDT token using the Single-Use-Seal (SUS) pattern: a seal cell
 * anchors a `SingleUseLock` owner cell, which is then consumed together with
 * the seal to mint the xUDT cell and its `UniqueType` metadata cell.
 *
 * @public
 * @category Blockchain
 * @category Token
 */
class XudtSusIssuer {
  /**
   * @param signer - The signer used to fund and sign all 3 transactions.
   */
  constructor(private readonly signer: ccc.Signer) {}

  /**
   * Runs the full seal -> owner -> mint flow.
   *
   * @param params - Token metadata, total supply, and an optional progress hook.
   * @returns The tx hashes of all 3 steps and the resulting xUDT type script hash.
   *
   * @example
   * ```typescript
   * const result = await new XudtSusIssuer(signer).issue({
   *   decimals: 8,
   *   symbol: "SPARK",
   *   totalSupply: 100_000_000,
   *   onProgress: (step, txHash) => console.log(step, txHash),
   * });
   * ```
   */
  async issue(params: IssueXudtSusParams): Promise<IssueXudtSusResult> {
    const { decimals, totalSupply } = params;
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
      throw new Error(
        "decimals must be an integer within 0-255 (1-byte field)",
      );
    }
    const tokenInfo = encodeTokenInfo(params);
    const supply = ccc.fixedPointFrom(totalSupply, decimals);
    if (supply < 0n || supply >= 1n << 128n) {
      throw new Error("totalSupply must encode to a non-negative uint128");
    }

    const { script: ownerLock } = await this.signer.getRecommendedAddressObj();

    const sealTxHash = await this.createSealCell(ownerLock);
    params.onProgress?.("seal", sealTxHash);

    const singleUseLock = await ccc.Script.fromKnownScript(
      this.signer.client,
      ccc.KnownScript.SingleUseLock,
      ccc.OutPoint.from({ txHash: sealTxHash, index: 0 }).toBytes(),
    );

    const ownerTxHash = await this.createOwnerCell(singleUseLock);
    params.onProgress?.("owner", ownerTxHash);

    const { mintTxHash, typeScriptHash } = await this.mintToken({
      sealTxHash,
      ownerTxHash,
      singleUseLock,
      ownerLock,
      supply,
      tokenInfo,
    });
    params.onProgress?.("mint", mintTxHash);

    return { sealTxHash, ownerTxHash, mintTxHash, typeScriptHash };
  }

  /** Step 1 - the "seal" cell that SingleUseLock will bind to and that mint() later consumes as proof */
  private async createSealCell(lock: ccc.Script): Promise<ccc.Hex> {
    const tx = ccc.Transaction.from({ outputs: [{ lock }] });
    await tx.completeInputsByCapacity(this.signer);
    await tx.completeFeeBy(this.signer);
    const txHash = await this.signer.sendTransaction(tx);

    // Reserve this output so later completeInputsByCapacity() calls in this
    // flow don't accidentally spend it as generic fee-funding - it must
    // survive untouched until the mint transaction consumes it as the seal.
    await this.signer.client.cache.markUnusable({ txHash, index: 0 });

    return txHash;
  }

  /** Step 2 - the owner cell, locked with SingleUseLock bound to the seal's outpoint */
  private async createOwnerCell(singleUseLock: ccc.Script): Promise<ccc.Hex> {
    const tx = ccc.Transaction.from({ outputs: [{ lock: singleUseLock }] });
    await tx.completeInputsByCapacity(this.signer);
    await tx.completeFeeBy(this.signer);
    return this.signer.sendTransaction(tx);
  }

  /** Step 3 - consume seal + owner cells to mint the xUDT cell and its UniqueType metadata cell */
  private async mintToken(args: {
    sealTxHash: ccc.Hex;
    ownerTxHash: ccc.Hex;
    singleUseLock: ccc.Script;
    ownerLock: ccc.Script;
    supply: bigint;
    tokenInfo: Uint8Array;
  }): Promise<{ mintTxHash: ccc.Hex; typeScriptHash: ccc.Hex }> {
    const {
      sealTxHash,
      ownerTxHash,
      singleUseLock,
      ownerLock,
      supply,
      tokenInfo,
    } = args;

    const xudtType = await ccc.Script.fromKnownScript(
      this.signer.client,
      ccc.KnownScript.XUdt,
      singleUseLock.hash(),
    );
    const uniqueType = await ccc.Script.fromKnownScript(
      this.signer.client,
      ccc.KnownScript.UniqueType,
      "00".repeat(32), // placeholder - patched below with the real TypeId once inputs are known
    );

    const tx = ccc.Transaction.from({
      inputs: [
        { previousOutput: { txHash: sealTxHash, index: 0 } },
        { previousOutput: { txHash: ownerTxHash, index: 0 } },
      ],
      outputs: [
        { lock: ownerLock, type: xudtType },
        { lock: ownerLock, type: uniqueType },
      ],
      outputsData: [ccc.numLeToBytes(supply, 16), tokenInfo],
    });

    await tx.addCellDepsOfKnownScripts(
      this.signer.client,
      ccc.KnownScript.SingleUseLock,
      ccc.KnownScript.XUdt,
      ccc.KnownScript.UniqueType,
    );

    await tx.completeInputsByCapacity(this.signer);

    // UniqueType's args must be a TypeId derived from the first input + output
    // index, which is only known once inputs are finalized above.
    if (!tx.outputs[1].type) {
      throw new Error(
        "UniqueType output unexpectedly missing before TypeId patch",
      );
    }
    tx.outputs[1].type.args = ccc.hexFrom(
      ccc.bytesFrom(ccc.hashTypeId(tx.inputs[0], 1)).slice(0, 20),
    );

    await tx.completeFeeBy(this.signer);
    const mintTxHash = await this.signer.sendTransaction(tx);
    await this.signer.client.waitTransaction(mintTxHash);

    return { mintTxHash, typeScriptHash: tx.outputs[0].type!.hash() };
  }
}

/* ============================================================
 * Convenience entrypoint - keeps the same call shape as before
 * ============================================================ */

/**
 * Issues an xUDT token via the Single-Use-Seal pattern using the
 * playground's default signer.
 * @public
 * @category Token
 *
 * @example
 * ```typescript
 * const result = await issueXudtWithSUS({
 *   decimals: 8,
 *   symbol: "SPARK",
 *   totalSupply: 100_000_000,
 *   onProgress: (step, txHash) => console.log(step, txHash),
 * });
 * console.log(result);
 * ```
 */
async function issueXudtWithSUS(
  params: IssueXudtSusParams,
): Promise<IssueXudtSusResult> {
  return new XudtSusIssuer(signer).issue(params);
}

// Example usage in the playground:
const result = await issueXudtWithSUS({
  decimals: 8,
  symbol: "SPARK",
  totalSupply: 100_000_000,
  onProgress: (step, txHash) => console.log(step, txHash),
});
console.log(result);
