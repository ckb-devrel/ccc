---
name: ckb-ccc-playground
description: Covers the CCC Playground (live.ckbccc.com) — an in-browser environment for running and sharing CCC TypeScript code with zero setup — including the @ckb-ccc/playground module's render()/signer helpers, the UI controls and the two ways to share code. Use when the user asks how to try/test CCC code in the browser, how to share a code snippet or reproduce a bug, what render() or the playground's pre-connected signer does, or how to contribute an example to the docs gallery — even if they just say "playground" or "live.ckbccc.com" without more context. Requires ckb-ccc-fundamentals and ckb-ccc-transactions for the underlying SDK concepts being demonstrated.
metadata:
  author: ckb-devrel
  version: "1.0.0"
  role: spoke
  depends-on: "ckb-ccc-fundamentals, ckb-ccc-transactions"
  priority: normal
---

# CKB CCC — Playground

The CCC Playground (https://live.ckbccc.com) is an in-browser TypeScript sandbox for CCC — no local project setup, no wallet extension required to start. It ships with a pre-connected signer and a step-by-step transaction visualizer, and is the fastest way to verify that a piece of CCC code (your own, or something fetched from DeepWiki/api.ckbccc.com per `ckb-ccc-fundamentals` Step 0) actually works before shipping it.

---

## The `@ckb-ccc/playground` module

Playground scripts import from `@ckb-ccc/playground`, not `@ckb-ccc/shell` or `@ckb-ccc/core` directly — this module wires up a ready-to-use signer and a visualization helper so you don't have to set up a client/signer yourself.

**Always start a playground script with these two imports**:

```typescript
import { ccc } from "@ckb-ccc/ccc"
import { render, signer, client } from "@ckb-ccc/playground";
```

- `ccc` — the SDK itself (`@ckb-ccc/ccc`), for `Address`, `Transaction`, `fixedPointFrom`, etc.
- `render` / `signer` / `client` — playground-provided helpers (`@ckb-ccc/playground`); `signer` is pre-connected, `client` is its underlying `ClientPublicTestnet`/`ClientPublicMainnet` instance — import `client` whenever a call needs the client directly instead of going through `signer.client`.

```typescript
// signer is already connected — Testnet by default, no setup needed
console.log(await signer.getRecommendedAddress());

// replace with the recipient address
const receiverAddress = "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqgy2q6qz79wyaexr2pcez0eejmk5xgw6jcfw7zmg";

const { script: lock } = await ccc.Address.fromString(receiverAddress, signer.client);
const tx = ccc.Transaction.from({
  outputs: [{ capacity: ccc.fixedPointFrom(100), lock }],
});
await render(tx);                          // visualize the tx as built so far

await tx.completeInputsByCapacity(signer);
await render(tx);                          // visualize again after inputs filled

await tx.completeFeeBy(signer, 1000);
await render(tx);                          // visualize again after fee paid
```

**Pattern**: call `await render(tx)` after each meaningful transformation of the transaction (outputs declared → inputs completed → fee paid) rather than only once at the end. This is what the official examples in the `code-examples` gallery do, and it's what makes the visualizer useful — you see the transaction evolve instead of just the final state.

---

## Using Spore in the Playground

There are two equivalent ways to call Spore functions in a playground script:

1. **Via `ccc.spore`** — no extra import needed, just use the `ccc` import you already have:

   ```typescript
   const { tx, id: sporeId } = await ccc.spore.createSpore({ signer, data: { ... } });
   ```

2. **Import `spore` directly** from `@ckb-ccc/spore`, then call `spore.xxx`:

   ```typescript
   import { spore } from "@ckb-ccc/spore";

   const { tx, id: sporeId } = await spore.createSpore({ signer, data: { ... } });
   ```

Both resolve to the same implementation — pick whichever keeps the script's import list minimal. See `ckb-ccc-spore` for the full Spore API (create/transfer/melt, cluster handling).

---

## UI controls

| Control | Purpose |
|---|---|
| **Testnet** toggle | Switches the pre-connected `signer`'s network. Testnet by default — **Check this before assuming a code snippet is safe to run; mainnet transactions are real.** |
| **Format** | Formats/prettifies the code in the editor. |
| **Run** | Executes the script from the top. |
| **Step** | Steps through the script's `render()` checkpoints one at a time, instead of running to completion — use this to inspect the transaction at each stage rather than only the final result. |
| **Share** | Publishes the current code to a Nostr relay and generates a share link. |
| **Console** | Shows `console.log` output and errors from the running script. |
| **About** | Playground info/help panel. |

---

## Sharing code: two methods, different guarantees

1. **Share button (Nostr)** — fast, no repo needed, good for quick back-and-forth with a colleague. **Not guaranteed permanent** — Nostr relay nodes don't guarantee long-term data retention, so these links can expire.
2. **`?src=` query parameter (raw URL)** — loads code from any publicly reachable raw file URL: `https://live.ckbccc.com/?src=<your-raw-file-url>`. 

For **stable, long-lived links**, host the script in a GitHub repo and point `?src=` at the `raw.githubusercontent.com` URL — this is exactly how every example in the official `code-examples` gallery is linked (see `ckb-ccc-examples-finder`). The link stays valid as long as the file exists in the repo.

---

## Contributing an example back to the docs gallery

If a snippet you built in the Playground is broadly useful, it can be added
to `docs.ckbccc.com`'s example gallery:

1. Fork `ckb-devrel/ccc`, clone locally.
2. Create a new `.ts` file in `packages/examples/src/`, camelCase naming
   (e.g. `myNewExample.ts`).
3. Import the SDK from `@ckb-ccc/ccc` and `render`/`signer` from
   `@ckb-ccc/playground`; call `await render(tx)` at key steps.
4. Paste the script into the Playground and verify it runs on Testnet.
5. Open a PR against `master` describing the example's purpose.

---

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `render(tx)` output doesn't update | Missing `await` | `render()` is async — always `await render(tx)` |
| Script behaves differently than expected vs. a real project | Playground's `signer` is pre-wired for you | Don't assume the same code will "just work" without a signer/client in a real project — see `ckb-ccc-signer-setup` for how to create one yourself |
| Sharing a link that stops working after a while | Used the Share (Nostr) button for something long-lived | Host the script on GitHub and share the `?src=` raw URL instead |

---

## Related skills

- `ckb-ccc-fundamentals` — package selection, amount/address handling used in every playground script
- `ckb-ccc-transactions` — the outputs → completeInputsByCapacity → completeFeeBy pattern shown above
- `ckb-ccc-spore` — the full Spore API (create/transfer/melt, cluster handling) used via `ccc.spore` or `@ckb-ccc/spore` in the playground
- `ckb-ccc-examples-finder` — the full catalog of ready-made playground examples by category
