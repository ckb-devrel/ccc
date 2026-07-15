---
name: ckb-ccc-udt
description: Covers issuing, transferring, and reading metadata for UDT / xUDT fungible tokens on CKB with the current CCC UDT API (`ccc.udt.Udt`, `@ckb-ccc/udt`). NOTE: ckb-devrel is releasing a replacement, `@ckb-ccc/coin`, within the next few weeks — once it ships, `@ckb-ccc/udt` will be removed and unmaintained, not kept for compatibility. This skill still teaches the current `@ckb-ccc/udt`-based pattern since it is the only working option until then, and this file will be replaced in place once `@ckb-ccc/coin` ships. Use when the user asks about UDT, xUDT, fungible tokens, token issuance, or token transfers on CKB — even if they just say "token" without naming UDT specifically. Builds on the standard transaction pattern in ckb-ccc-transactions.
metadata:
  author: ckb-devrel
  version: "1.0.0"
  role: spoke
  depends-on: "ckb-ccc-fundamentals, ckb-ccc-transactions"
  priority: normal
  status: "current API — @ckb-ccc/coin expected within weeks; @ckb-ccc/udt will then be removed/unmaintained. This file becomes a redirect stub for one release cycle (new content goes in ckb-ccc-coin/, this directory is deleted afterward)"
---

# CKB CCC — UDT Tokens

Covers xUDT (extensible User Defined Token) issuance, transfer, and metadata reads. Assumes a connected `Signer` (see `ckb-ccc-signer-setup`) and the standard transaction pattern (see `ckb-ccc-transactions`) — this skill only adds the UDT-specific steps on top of that pattern.

---

## Issuing xUDT tokens (Single-Use-Seal pattern)

xUDT issuance requires the Single-Use-Seal (SUS) pattern, which involves three sequential transactions to ensure token uniqueness and authority.

```typescript
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
  if (decimals < 0 || decimals > 255) {
    throw new Error("decimals must be within 0-255 (1-byte field)");
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
      metadata: params,
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
    metadata: IssueXudtSusParams;
  }): Promise<{ mintTxHash: ccc.Hex; typeScriptHash: ccc.Hex }> {
    const { sealTxHash, ownerTxHash, singleUseLock, ownerLock, metadata } = args;
    const { decimals, symbol, name, totalSupply } = metadata;

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
      outputsData: [
        ccc.numLeToBytes(ccc.fixedPointFrom(totalSupply, decimals), 16),
        encodeTokenInfo({ decimals, symbol, name }),
      ],
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
      throw new Error("UniqueType output unexpectedly missing before TypeId patch");
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
export async function issueXudtWithSUS(
  params: IssueXudtSusParams,
): Promise<IssueXudtSusResult> {
  return new XudtSusIssuer(signer).issue(params);
}

// Example usage in the playground:
const result = await issueXudtWithSUS({
  decimals: 8,
  symbol: "ZXMOTO",
  totalSupply: 100_000_000,
  onProgress: (step, txHash) => console.log(step, txHash),
});
console.log(result);
```

## Transferring UDT tokens

1. **Construct UDT instance** — Resolve type script: `await ccc.Script.fromKnownScript(client, ccc.KnownScript.XUdt, args)`. Get code OutPoint from cell deps. Create: `new ccc.udt.Udt(code, typeScript)`.
2. **Build transfer** — `const { res: tx } = await udt.transfer(signer, [{ to: lock, amount: 100n }])`.
3. **Complete UDT inputs** — `tx = await udt.completeBy(tx, signer)` — adds UDT inputs and change output. **Do not skip**: omitting this loses tokens permanently.
4. **Complete CKB capacity** — `await tx.completeInputsByCapacity(signer)`.
5. **Pay fee and send** — `await tx.completeFeeBy(signer)`, then `await signer.sendTransaction(tx)`.
6. **Read metadata (SSRI tokens only)** — `udt.name()`, `udt.symbol()`, `udt.decimals()`, `udt.icon()`. Always check return value is not `undefined` — legacy sUDT tokens do not implement SSRI.

```typescript

async function transferUdt(signer: ccc.Signer, receiverAddress: string) {
  const { script: recipientLock } = await ccc.Address.fromString(receiverAddress, signer.client);
  
  const type = await ccc.Script.fromKnownScript(
    signer.client, ccc.KnownScript.XUdt, "0x<xudt-cell-typescript-args>"
  );
  const code = (await signer.client.getCellDeps(
    (await signer.client.getKnownScript(ccc.KnownScript.XUdt)).cellDeps
  ))[0].outPoint;

  // Construct a Udt instance
  const udt = new ccc.udt.Udt(code, type);

  // Transfer tokens — always three steps after udt.transfer
  const decimals = 8;  
  let { res: tx } = await udt.transfer(signer, [{ to: recipientLock, amount: ccc.fixedPointFrom(100, decimals)}]);
  tx = await udt.completeBy(tx, signer);         // fill UDT inputs + change
  await tx.completeInputsByCapacity(signer);     // fill CKB capacity
  await tx.completeFeeBy(signer);
  const txHash = await signer.sendTransaction(tx);

  return txHash;
}
```

**Rule**: UDT transfers need `completeBy` (UDT) then `completeInputsByCapacity` (CKB) — order matters.

---

## Gotchas (UDT-specific)

| Symptom / Error | Cause | Fix |
|---|---|---|
| UDT tokens lost after transfer | `udt.completeBy()` not called | Always call `udt.completeBy(tx, signer)` before `completeInputsByCapacity`; it adds the token change output |
| `udt.name()` / `symbol()` returns `undefined` | Token doesn't implement SSRI | Only xUDT with SSRI support returns metadata; always guard with `?? "unknown"` |
| On-chain amount is 10^decimals smaller than expected | Used human-facing amount directly instead of scaling by decimals | Always use `ccc.fixedPointFrom(humanFacingAmount, decimals)` for both mint and transfer — the on-chain integer is `display * 10^decimals`, not the human-facing number |

---

## Q&A

**Q: How do I find the args for a specific xUDT?**

A: You can view it in the CKB explorer:
1. Find the xUDT in the CKB explorer (e.g., https://testnet.explorer.nervos.org/xudt/0xb5378a3a22ed158233a4493ec0994483aada2bc6de9446952184653d90bdf889)
2. Navigate to the xUDT's detail page
3. In the info section, look for the **Type Script** section and find the **Args** field
4. This Args value is the xUDT's args, used when constructing `ccc.Script.fromKnownScript(client, ccc.KnownScript.XUdt, args)`

---

## Checklist (UDT-specific)

- [ ] **UDT change** — `udt.completeBy()` called before `completeInputsByCapacity` for token transfers
- [ ] **Supply scaling** — `totalSupply` (and any amount) is the on-chain integer (`display * 10^decimals`), not the human-facing number
- [ ] **Tested on testnet first** — for real issuance, run the full flow on `ClientPublicTestnet` and verify in an explorer before switching to `ClientPublicMainnet`
- [ ] **symbol vs name** — `symbol` holds the ticker/display identifier; `name` is supplementary description

Also check the checklists in `ckb-ccc-fundamentals` and `ckb-ccc-transactions`.