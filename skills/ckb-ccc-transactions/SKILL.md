---
name: ckb-ccc-transactions
description: Covers composing and sending CKB transactions with CCC — building transaction outputs, completing inputs and fees, adding cell dependencies, and querying the chain (cells by lock, balance, transaction confirmation). Use when the user asks how to build, compose, or send a transaction, add cell deps, or query on-chain data — even if they just say "transfer CKB" or "check this transaction" without naming CCC methods. UDT and Spore transfers build on this pattern; see ckb-ccc-udt / ckb-ccc-spore for those specifics. Requires a connected Signer — see ckb-ccc-signer-setup if one hasn't been created yet.
metadata:
  author: ckb-devrel
  version: "1.0.0"
  role: spoke
  depends-on: "ckb-ccc-fundamentals, ckb-ccc-signer-setup"
  priority: normal
---

# CKB CCC — Transactions

The canonical CCC transaction pattern. This applies to plain CKB transfers and is the foundation that `ckb-ccc-udt` and `ckb-ccc-spore` build on top of — those skills only cover what's different for their asset type, not the full pattern again.

You need a connected `Signer` before any of this — see `ckb-ccc-signer-setup`.

---

## Standard transaction composition pattern

1. **Resolve recipient** — `const { script: lock } = await ccc.Address.fromString(toAddress, signer.client)`.
2. **Build transaction** — `const tx = ccc.Transaction.from({ outputs: [{ capacity: ccc.fixedPointFrom("100"), lock }] })`.
3. **Complete inputs** — `await tx.completeInputsByCapacity(signer)` — must come before fee calculation.
4. **Pay fee** — `await tx.completeFeeBy(signer)` — omit fee rate argument to use automatic network rate.
5. **Send** — `const txHash = await signer.sendTransaction(tx)`.
6. **Verify** — Optionally wait for confirmation: `await signer.client.waitTransaction(txHash, 1)`.

**This order is mandatory**: `outputs declared → completeInputsByCapacity → completeFeeBy → sendTransaction`.
Calling `completeFeeBy` before `completeInputsByCapacity` produces an incorrect fee.

---

## Cell Dep Management

```typescript
// Add deps for built-in scripts (preferred)
await tx.addCellDepsOfKnownScripts(client, ccc.KnownScript.XUdt);

// Add custom cell dep
tx.addCellDeps({ outPoint: { txHash: "0x...", index: 0 }, depType: "depGroup" });
```

`signer.prepareTransaction()` (called automatically inside `sendTransaction`) adds
deps for the signer's own lock script. Do not add them again manually.

---

## Querying the Chain

```typescript
// Iterate cells by lock script (async generator — streams lazily)
for await (const cell of client.findCellsByLock(lockScript, null, true)) {
  console.log(cell.outPoint, cell.cellOutput.capacity);
}

// Wait for transaction confirmation
await client.waitTransaction(txHash, 1); // 1 confirmation, 60s timeout default

// Get balance
const balance = await signer.getBalance(); // total Shannon across all addresses
```

---

## Gotchas (transaction-specific)

| Symptom / Error | Cause | Fix |
|---|---|---|
| `"not enough capacity"` | Insufficient CKB | Fund the address; each output cell needs ≥ 61 CKB |
| `"InsufficientCellCapacity"` | Output cell below minimum | Each basic output needs ≥ 61 CKB capacity; use CCC helpers, not manual calculation |
| Transaction rejected by node | Fee too low or missing | Always call `completeFeeBy` after `completeInputsByCapacity`; omit fee rate arg for automatic rate |
| `addCellDepsOfKnownScripts is not a function` | Wrong import or outdated version | Use `@ckb-ccc/shell` not `@ckb-ccc/core` for backend; update CCC to latest |

---

## Hallucination Guard

- ❌ `new ccc.Transaction()` — always use `ccc.Transaction.from({ outputs: [...] })`
- ❌ Manually computing fees — always use `completeFeeBy`
- ❌ Manually selecting input cells — always use `completeInputsByCapacity`
- ❌ Calling `completeFeeBy` before `completeInputsByCapacity` — order is mandatory
- ❌ `tx.addCellDepsOfKnownScripts` without `await` — it's async

---

## Checklist (transaction-specific)

- [ ] **Transaction order** — `outputs declared → completeInputsByCapacity → completeFeeBy → sendTransaction`
- [ ] **Capacity** — Output cells have ≥ 61 CKB (CCC helpers enforce this; manual calc may not)
- [ ] **Fee rate** — `completeFeeBy` called without explicit rate (automatic) unless custom rate needed
- [ ] **Error handling** — `try/catch` around `sendTransaction`

Also check the cross-cutting checklist in `ckb-ccc-fundamentals`.
