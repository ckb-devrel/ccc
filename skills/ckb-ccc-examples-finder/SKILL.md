---
name: ckb-ccc-examples-finder
description: Helps locate existing, ready-made CKB/CCC example code and demo repositories by category — transactions, UDT, Spore/DOB, wallet connection, chain queries, backend scripts, on-chain contracts, and local devnet tooling — instead of writing something from scratch or guessing at patterns. Use when the user asks for an example, a demo, a sample project, "is there existing code for X", or wants to see how something is conventionally done in the CKB ecosystem — even if they don't use the word "example" (e.g. "how do other people do NervosDAO deposits").
metadata:
  author: ckb-devrel
  version: "1.0.0"
  role: spoke
  depends-on: "ckb-ccc-fundamentals"
  priority: normal
---

# CKB CCC — Finding Example Code

Before writing example code from memory, check whether a working, tested example already exists — CKB/CCC has enough moving parts (Cell model, SSRI, DOB rendering) that reusing a known-good example is safer than reconstructing one. Check sources in this order.

---

## Step 1 — CCC's own example gallery (check first, always)

`docs.ckbccc.com` maintains a tagged gallery of runnable examples, each with a raw source URL and a direct Playground link:

```http
GET https://docs.ckbccc.com/en/docs/code-examples.md
```

The gallery is rendered as an `<ExampleGrid>` component — fetch the page's Markdown source and extract the `source` field from each item in the `items` array to get the raw TypeScript. Filter by the `tags` field for the category you need. Known tags as of this writing:

| Tag | Meaning |
|---|---|
| `playground` | Runs directly in the Playground (`.ts` script, use with `ckb-ccc-playground`) |
| `app` | Lives in the CCC App (`app.ckbccc.com`), a GUI tool rather than a script |
| `tool` | Standalone utility (hash calculator, mnemonic generator, keystore decryptor) |
| `transaction` | General transaction composition |
| `udt` | UDT/xUDT token operations |
| `spore` | Spore protocol (DOB) operations |
| `wallet` | Wallet connection / signer patterns |
| `query` | Read-only chain queries |
| `backend` | Node.js / non-browser scripts |

**This table is a cached snapshot, not the source of truth** — the gallery changes as new examples are added. Always fetch the live page rather than relying on this list for anything beyond a quick sanity check of what categories exist.

Examples known to exist at time of writing (non-exhaustive): transferring CKB, sweeping a full balance, transferring UDT, signing/verifying a message, custom wallet-connection UI, querying balance/cells/transactions, NervosDAO deposit & withdraw, creating/transferring a Spore DOB, a Node.js backend transfer, issuing xUDT (Single-Use Lock and Type ID variants), Spore Cluster creation, time-locked transfers, an SSRI contract call, and utility tools (hash, mnemonic, keystore, dep group manager).

---

## Step 2 — Protocol-specific external repos (if Step 1 doesn't cover it)

| Repo | Covers | Layer |
|---|---|---|
| `sporeprotocol/dob-cookbook` | Deeper DOB/0 and DOB/1 recipes beyond the basics — image-linked traits via BTCFS/IPFS, programmatic images, DOB/1 SVG composition. For the core Spore/DOB concept and a basic DOB/0 walkthrough, see `ckb-ccc-spore` first — this repo is for recipes beyond that. Confirmed active (41+ commits, MIT license, has `README.md`/`BestPractices.md`/`FAQ.md`) | CCC / TypeScript |
| `ckb-devrel/nervdao` | NervosDAO-focused examples/tooling beyond the single deposit/withdraw example in Step 1 | CCC / TypeScript |

**Fetching `dob-cookbook` efficiently**: each example's `.md` file (e.g. `examples/dob0/0.basic-loot.md`) embeds the **complete `.ts` source inline** in a fenced code block under its "## Code" heading — fetching the `.md` gets you the explanation and the full working code in one request; you don't need to separately fetch the matching `.ts` file. The repo's `README.md` is itself a categorized index (DOB/0 examples, DOB/1 examples, each linked directly) — fetch it first to find the right example before drilling into one. `BestPractices.md` and `FAQ.md` at the repo root are also worth checking for DOB-specific gotchas not covered by any single example.

---

## Step 3 — Is this actually an on-chain contract question, not a CCC/TS question?

If the user's question is about writing or modifying the **on-chain script/contract itself** (Rust, C, or Lua running in the CKB VM) rather than calling an existing script from TypeScript — this is a different layer than what CCC or this skill set covers. Redirect to:

| Repo/Resource | Covers |
|---|---|
| `nervosnetwork/docs.nervos.org` (docs.nervos.org) | Official CKB developer docs — contract frameworks, the Rust/C SDKs, script development guides, and general protocol reference. Use this as the entry point when the need is outside CCC's scope entirely |

---

## Step 4 — Still nothing found

Search the `ckb-devrel` GitHub org directly, or ask via DeepWiki/Context7
MCP (see `ckb-ccc-fundamentals` Step 0) whether an example exists anywhere
in the indexed CKB ecosystem repos before writing one from scratch.

---

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Recommended repo is archived / renamed / 404s | This table is a manually compiled snapshot and can go stale | Verify the repo still exists and has recent activity before pointing a developer to it; prefer Step 1 (the live gallery) whenever possible since it's actively maintained alongside the SDK |
| Confusing a CCC (TypeScript, off-chain) example with an on-chain contract example | Both "CKB example" and "CCC example" get used loosely | Check which layer the user actually needs (see Step 3) before recommending — the two are not interchangeable |

---

## Related skills

- `ckb-ccc-fundamentals` — Step 0 (DeepWiki/Context7 for API verification) and the doc-navigation pattern this skill builds on
- `ckb-ccc-playground` — how to actually run a `playground`-tagged example once found
