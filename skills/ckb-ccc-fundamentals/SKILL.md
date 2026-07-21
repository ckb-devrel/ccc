---
name: ckb-ccc-fundamentals
description: Provides foundational CKB (Nervos) blockchain knowledge needed before writing any CCC SDK code — the Cell model (CKB is UTXO-based, not account-based like Ethereum), which @ckb-ccc/* package to install for a given environment, address and Shannon/CKB amount handling, and the KnownScript enum — plus how to look up exact API signatures via DeepWiki MCP, Context7, or api.ckbccc.com, and how to navigate docs.ckbccc.com (llms.txt / per-page Markdown / llms-full.txt). Use this skill for any CKB or CCC SDK question, even if the user doesn't say "CCC" or "Nervos" explicitly — e.g. "how do I build on CKB", "what package do I need", "CKB vs Ethereum", "migrating from Lumos", "what does method X return", "where are the CCC docs". Load alongside a vertical skill (ckb-ccc-signer-setup / ckb-ccc-transactions / ckb-ccc-udt / ckb-ccc-spore) once the task's specific area is clear.
metadata:
  author: ckb-devrel
  version: "1.0.0"
  role: hub
  depends-on: "none"
  priority: critical
---

# CKB CCC — Fundamentals

CCC (CKBers' Codebase) is the one-stop TypeScript/JavaScript SDK for CKB.
- Full docs: https://docs.ckbccc.com
- llms.txt: https://docs.ckbccc.com/llms.txt

This is the **hub skill** — read this first for any CKB/CCC task. For a specific scenario, also load the matching vertical skill:

| Task | Skill |
|---|---|
| Connecting a wallet (React) or creating a backend signer | `ckb-ccc-signer-setup` |
| Composing/sending a transaction, querying cells, cell deps | `ckb-ccc-transactions` |
| Spore protocol NFTs/DOBs | `ckb-ccc-spore` |
| UDT / xUDT fungible tokens | `ckb-ccc-udt` |

---

## Critical: CKB is NOT an Account Model Chain

CKB uses the **Cell model** — a generalized UTXO model. This is the #1 source of AI hallucination when helping CKB developers. Internalize this before generating any code:

| Concept | Ethereum (EVM) | CKB |
|---|---|---|
| State unit | Account balance | Cell (capacity + lock + type + data) |
| Ownership | `msg.sender` | Lock script (verified by CKB VM) |
| Asset rules | Smart contract storage | Type script |
| "Send tokens" | Transfer from account | Consume input Cells, create output Cells |
| Minimum unit | wei (1e-18 ETH) | Shannon (1 CKB = 100,000,000 Shannon) |

**There are no accounts, no balances, no `msg.sender` in CKB.**

---

## Package Selection — Always Get This Right First

| Scenario | Install | Import |
|---|---|---|
| React/Next.js dApp | `@ckb-ccc/connector-react` | `import { ccc } from "@ckb-ccc/connector-react"` |
| Node.js backend / scripts | `@ckb-ccc/shell` | `import { ccc } from "@ckb-ccc/shell"` |
| Custom wallet UI (non-React) | `@ckb-ccc/ccc` | `import { ccc } from "@ckb-ccc/ccc"` |
| Framework-agnostic Web Component | `@ckb-ccc/connector` | `import { ccc } from "@ckb-ccc/connector"` |
| Library authoring (minimal deps) | `@ckb-ccc/core` | `import { ccc } from "@ckb-ccc/core"` |

**Rule**: `@ckb-ccc/shell` and `@ckb-ccc/connector-react` already re-export everything from `@ckb-ccc/core` — do not install core separately unless authoring a library.

---

## Amount Conversion (Shannon ↔ CKB)

```typescript
ccc.fixedPointFrom("100")        // 100 CKB → 10_000_000_000n Shannon
ccc.fixedPointFrom(100)          // same
ccc.fixedPointFrom("0.01")       // 0.01 CKB → 1_000_000n Shannon
ccc.fixedPointToString(balance)  // bigint Shannon → "100" (human-readable CKB)
```

All capacity values in CCC are `bigint` in Shannon. **Never use floating point.**
Always work in Shannon internally; convert to/from CKB only at the UI boundary.

---

## Address Handling

```typescript
// Parse an address string into its Script
const { script: lock } = await ccc.Address.fromString(addressStr, client);

// Get address from connected signer
const addressStr = await signer.getRecommendedAddress();
const addressObj = await signer.getRecommendedAddressObj(); // includes Script
const { script: lock } = addressObj; // preferred when you need the lock script
```

Address prefix: `ckb` = mainnet, `ckt` = testnet. Mixing them throws.

---

## Known Scripts (KnownScript enum)

Do **not** hardcode codeHash values. Use `KnownScript`:

```typescript
// Resolve script from name
const xudtType = await ccc.Script.fromKnownScript(
  client,
  ccc.KnownScript.XUdt,
  "0x<issuer-lock-hash>",
);

// Available values (selection):
// KnownScript.Secp256k1Blake160      — standard CKB lock
// KnownScript.XUdt                   — extensible UDT (fungible tokens)
// KnownScript.NervosDao              — NervosDAO deposit/withdraw
// KnownScript.JoyId                  — JoyID passkey lock
// KnownScript.OmniLock               — EVM/BTC cross-chain lock
// KnownScript.NostrLock              — Nostr protocol lock
// KnownScript.TypeId                 — Type ID (upgradeable contracts)
// KnownScript.COTA                   — COTA NFT standard  
// KnownScript.PWLock                 — PWLock  
// KnownScript.UniqueType             — unique type identifier  
// KnownScript.DidCkb                 — web5 DID(decentralized identity) on CKB  
// KnownScript.AlwaysSuccess          — always success lock
// KnownScript.InputTypeProxyLock     — proxy lock for input types  
// KnownScript.OutputTypeProxyLock    — proxy lock for output types  
// KnownScript.LockProxyLock          — proxy lock for locks  
// KnownScript.SingleUseLock          — single-use lock  
// KnownScript.TypeBurnLock           — type burn lock  
// KnownScript.EasyToDiscoverType     — easy to discover type  
// KnownScript.TimeLock               — time-locked transfer 
```

---

## Common Gotchas (cross-cutting / project setup)

| Symptom / Error | Cause | Fix |
|---|---|---|
| `ERR_REQUIRE_ESM` | CJS project importing CCC | Add `"type": "module"` to package.json or use dynamic `import()` |
| `Property '*' not found on ccc` | Wrong `moduleResolution` | Set `"moduleResolution": "bundler"` in tsconfig; do not use `node` or `classic` |
| Wrong address on wrong network | Mainnet/testnet mismatch | `ckb` prefix = mainnet, `ckt` prefix = testnet; client and address must match |

For gotchas about signer/wallet setup, transaction composition, UDT, or Spore, see the matching vertical skill.

---

## Hallucination Guard (cross-cutting)

- ❌ `signer.getBalance()` returns a `number` — it returns `bigint` (Shannon)
- ❌ Using EVM address format (`0x...` 20-byte) as CKB address — CKB uses bech32m (`ckb1...`)
- ❌ `ccc.fixedPointFrom(100.5)` with float arithmetic on Shannon — use string `"100.5"`
- ❌ Generating a method signature, parameter list, or return type from memory/pattern-matching without checking DeepWiki MCP / Context7 / api.ckbccc.com first (see "Step 0" under "How to Use This Documentation") — this applies even when the signature looks plausible or resembles a similar SDK (ethers.js, Lumos)
- ❌ Treating a single example from a cookbook/demo repo as authoritative protocol behavior — a single `.ts` file can contain typos or copy-paste errors (e.g. a wrong `contentType` value) that look internally consistent but are still wrong. When a protocol-level spec exists (e.g. `docs.spore.pro` for DOB, the CKB RFCs for script/cell behavior), cross-check against it rather than trusting one example in isolation — especially before stating something as a general rule rather than "this is what one example did"

For hallucination guards specific to signers, transactions, UDT, or Spore, see the matching vertical skill.

---

## Pre-submission Checklist (cross-cutting)

Before finalizing any CCC code, verify:

- [ ] **Package** — Correct package for the environment (`connector-react` / `shell` / `ccc`)
- [ ] **TypeScript** — `tsconfig.json` has `moduleResolution: "bundler"` (or `node16`/`nodenext`)
- [ ] **Network match** — Client network (testnet/mainnet) matches address prefix (`ckt`/`ckb`)
- [ ] **Amount conversion** — User-facing amounts go through `fixedPointFrom()` / `fixedPointToString()`

For checklist items specific to signers, transactions, UDT, or Spore, see the matching vertical skill.

---

## How to Use This Documentation

When you need information beyond what this skill covers, fetch it directly rather than guessing. The docs site is structured for programmatic access:

### Step 0 — For exact API signatures, query DeepWiki MCP first

CCC's source is indexed on DeepWiki (`ckb-devrel/ccc`) and Context7 (`ckb-devrel/ccc`). Before generating any code that calls a specific method — its parameters, return type, overloads, or a class's members — do not rely on pattern-matching against similar SDKs (e.g. ethers.js, Lumos) or on this skill's code snippets as the source of truth for exact signatures. Verify in this order:

1. **DeepWiki MCP** (preferred) — if a DeepWiki MCP tool is available in this session (commonly exposed as `ask_question`, `read_wiki_contents`, or `read_wiki_structure` — check your available tools for one tagged `deepwiki`), call it against repo `ckb-devrel/ccc` with the specific question, e.g. "What are the parameters and return type of `Udt.completeBy`?". It returns source-grounded answers with real usage examples — use `ask_question` for a specific method/class, and `read_wiki_structure` first only if you need to locate which part of the repo covers an unfamiliar concept.
2. **Context7 MCP** (fallback) — if DeepWiki is unavailable or the answer is inconclusive, resolve the library ID for `ckb-devrel/ccc` and query its docs.
3. **api.ckbccc.com** (fallback) — if no MCP tool is available this session, fetch the TypeDoc HTML reference directly (see "API reference" below). Slower to parse reliably, but always reachable as a plain URL.
4. **If none confirm the signature** — say so explicitly and ask the user, or mark the code as unverified, rather than inventing a plausible-looking signature. This rule overrides confidence from familiarity with similar SDKs — see "Hallucination Guard".

### Step 1 — Start with llms.txt for navigation

```http
GET https://docs.ckbccc.com/llms.txt
```

Returns a structured index of all documentation pages with titles and URLs. Use this to identify which page covers the topic you need.

### Step 2 — Fetch the specific page as Markdown

Append `.md` to any docs URL to get clean Markdown without HTML boilerplate:

```http
# Example: fetch the Cell model concept page
GET https://docs.ckbccc.com/en/docs/concepts/cell-model.md

# Pattern for any page:
GET https://docs.ckbccc.com/en/docs/<section>/<page>.md
```

Alternatively, send `Accept: text/markdown` and the server will serve Markdown automatically via content negotiation.

### Step 3 — Use llms-full.txt for broad questions

```http
GET https://docs.ckbccc.com/llms-full.txt
```

Contains the full text of all English documentation pages concatenated. Use when the question spans multiple pages or you need a complete overview. Prefer per-page fetches when the relevant section is known — narrower context means less noise.

### Key page URLs (most commonly needed)

| Topic | Markdown URL |
|---|---|
| Cell model, Script, Transaction concepts | `https://docs.ckbccc.com/en/docs/concepts/cell-model.md` |
| Signer interface | `https://docs.ckbccc.com/en/docs/concepts/signer.md` |
| Connecting wallets | `https://docs.ckbccc.com/en/docs/guides/connect-wallets.md` |
| Composing transactions | `https://docs.ckbccc.com/en/docs/guides/compose-transactions.md` |
| UDT token guide | `https://docs.ckbccc.com/en/docs/guides/udt-tokens.md` |
| Spore protocol guide | `https://docs.ckbccc.com/en/docs/guides/spore-protocol.md` |
| Node.js backend guide | `https://docs.ckbccc.com/en/docs/guides/node-js-backend.md` |
| Package overview | `https://docs.ckbccc.com/en/docs/packages/core-packages.md` |
| AI setup & prompting guide (for the human you're helping) | `https://docs.ckbccc.com/en/docs/ai-resources.md` |

### For API signatures and types — use the API reference (fallback only)

```text
https://api.ckbccc.com
```

TypeDoc-generated reference for all `@ckb-ccc/*` packages. Only reach for this when no DeepWiki or Context7 MCP tool is available this session — see "Step 0" above, which is the preferred path for any exact method signature, interface field, or enum value. When you do use this fallback, search by class or method name directly in the URL:

```text
https://api.ckbccc.com/modules/_ckb-ccc_connector-react
https://api.ckbccc.com/functions/_ckb-ccc_connector-react.index.useccc
https://api.ckbccc.com/classes/_ckb-ccc_core.index.transaction
https://api.ckbccc.com/enums/_ckb-ccc_core.index.knownscript
```

### Decision guide: which resource to fetch

| Situation | Fetch |
|---|---|
| "How do I do X with CCC?" | Per-page `.md` from docs |
| "What does method Y return?" / exact signature | DeepWiki MCP first → Context7 MCP → api.ckbccc.com (see Step 0) |
| "Give me a working example" | Fetch https://docs.ckbccc.com/en/docs/code-examples.md, extract source fields from the <ExampleGrid /> items, then fetch the raw GitHub URL to get the TypeScript source |
| "Which page covers topic Z?" | llms.txt index first, then the page |
| "Broad overview of CCC" | llms-full.txt |

---

## Reference Links

- Docs: https://docs.ckbccc.com
- llms.txt: https://docs.ckbccc.com/llms.txt
- llms-full.txt: https://docs.ckbccc.com/llms-full.txt
- Per-page markdown: append `.md` to any docs URL
- API reference (fallback only — see Step 0): https://api.ckbccc.com
- Source indexed on DeepWiki MCP / Context7 (preferred for exact signatures — see Step 0): repo `ckb-devrel/ccc`
- Playground (live code): https://live.ckbccc.com
- GitHub: https://github.com/ckb-devrel/ccc