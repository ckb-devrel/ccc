---
name: ckb-ccc
description: >
  Expert guidance for building on CKB (Nervos Common Knowledge Base) using the
  CCC TypeScript/JavaScript SDK. Use this skill whenever a user asks about CKB
  development, CCC SDK usage, building dApps on CKB, connecting wallets to CKB,
  composing CKB transactions, working with UDT tokens, Spore protocol (DOBs/NFTs),
  NervosDAO, or anything involving @ckb-ccc/* packages. Also trigger for questions
  about CKB's Cell model, CKB vs EVM differences, or migrating from Lumos to CCC.
---

# CKB CCC Development Skill

CCC (CKBers' Codebase) is the one-stop TypeScript/JavaScript SDK for CKB.
Full docs: https://docs.ckbccc.com — llms.txt: https://docs.ckbccc.com/llms.txt

---

## Critical: CKB is NOT an Account Model Chain

CKB uses the **Cell model** — a generalized UTXO model. This is the #1 source of
AI hallucination when helping CKB developers. Internalize this before generating any code:

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
| Framework-agnostic Web Component | `@ckb-ccc/connector` | Web Component `<ccc-connector>` |
| Library authoring (minimal deps) | `@ckb-ccc/core` | `import { ccc } from "@ckb-ccc/core"` |

**Rule**: `@ckb-ccc/shell` and `@ckb-ccc/connector-react` already re-export everything
from `@ckb-ccc/core` — do not install core separately unless authoring a library.

---

## Workflows

### Building a React dApp with wallet connection

1. **Install and wrap Provider** — Install `@ckb-ccc/connector-react`. Wrap root component with `<ccc.Provider name="My App" icon="/icon.png">`. Add `"use client"` for Next.js App Router.
2. **Add wallet connection UI** — Use `ccc.useCcc()` to get `open`, `wallet`, `signerInfo`, `disconnect`. Render connect/disconnect button based on `signerInfo` presence.
3. **Get signer** — Call `const signer = ccc.useSigner()` inside a component; guard with `if (!signer) return` before any transaction operation.
4. **Resolve recipient** — `const { script: lock } = await ccc.Address.fromString(toAddress, signer.client)`.
5. **Build transaction** — `const tx = ccc.Transaction.from({ outputs: [{ capacity: ccc.fixedPointFrom("100"), lock }] })`.
6. **Complete inputs** — `await tx.completeInputsByCapacity(signer)` — must come before fee calculation.
7. **Pay fee** — `await tx.completeFeeBy(signer)` — omit fee rate argument to use automatic network rate.
8. **Send** — `const txHash = await signer.sendTransaction(tx)`.
9. **Verify** — Optionally wait for confirmation: `await signer.client.waitTransaction(txHash, 1)`.

```tsx
"use client";
import { ccc } from "@ckb-ccc/connector-react";

// Root — wrap once
export default function App({ children }) {
  return <ccc.Provider name="My App" icon="/icon.png">{children}</ccc.Provider>;
}

// Component — use inside Provider
function ConnectButton() {
  const { open, disconnect, wallet, signerInfo } = ccc.useCcc();
  const signer = ccc.useSigner();
  return signerInfo
    ? <button onClick={disconnect}>Disconnect {wallet?.name}</button>
    : <button onClick={open}>Connect Wallet</button>;
}
```

### Building a Node.js backend script

1. **Import and connect** — Install `@ckb-ccc/shell`. Create client: `new ccc.ClientPublicTestnet()` or `ClientPublicMainnet()`.
2. **Create signer** — `new ccc.SignerCkbPrivateKey(client, process.env.CKB_PRIVATE_KEY!)`. Never hardcode keys.
3. **Check connection** — Some signers require `await signer.connect()`. Check with `await signer.isConnected()` if operations fail unexpectedly.
4. **Query data** — `await signer.getRecommendedAddress()`, `await signer.getBalance()`, `for await (const cell of client.findCellsByLock(...))`.
5. **Build and send** — Follow steps 4–8 from the React workflow above; transaction pattern is identical.
6. **Verify** — Log `txHash`; use `client.getTransaction(txHash)` to poll for confirmation.

```typescript
import { ccc } from "@ckb-ccc/shell";

// Always load private key from environment — never hardcode
const client = new ccc.ClientPublicTestnet(); // or ClientPublicMainnet
const signer = new ccc.SignerCkbPrivateKey(client, process.env.CKB_PRIVATE_KEY!);
await signer.connect();

const address = await signer.getRecommendedAddress(); // "ckt1q..." or "ckb1q..."
const balance = await signer.getBalance(); // bigint in Shannon
```

**TypeScript config** — `@ckb-ccc/shell` ships ESM only:
```json
{ "compilerOptions": { "moduleResolution": "bundler" } }
```

### Issuing and transferring UDT tokens

1. **Construct UDT instance** — Resolve type script: `await ccc.Script.fromKnownScript(client, ccc.KnownScript.XUdt, args)`. Get code OutPoint from cell deps. Create: `new ccc.udt.Udt(code, typeScript)`.
2. **Build transfer** — `const { res: tx } = await udt.transfer(signer, [{ to: lock, amount: 100n }])`.
3. **Complete UDT inputs** — `tx = await udt.completeBy(tx, signer)` — adds UDT inputs and change output. **Do not skip**: omitting this loses tokens permanently.
4. **Complete CKB capacity** — `await tx.completeInputsByCapacity(signer)`.
5. **Pay fee and send** — `await tx.completeFeeBy(signer)`, then `await signer.sendTransaction(tx)`.
6. **Read metadata (SSRI tokens only)** — `udt.name()`, `udt.symbol()`, `udt.decimals()`, `udt.icon()`. Always check return value is not `undefined` — legacy sUDT tokens do not implement SSRI.

### Creating and managing Spore NFTs

1. **Create Spore** — `const { tx, id: sporeId } = await spore.createSpore({ signer, data: { contentType: "text/plain", content: bytes } })`.
2. **If using a Cluster** — Specify `clusterMode: "lockProxy" | "clusterCell" | "skip"` in `createSpore()`. Omitting it when `clusterId` is set throws.
3. **Complete and send** — `await tx.completeInputsByCapacity(signer)`, `await tx.completeFeeBy(signer)`, `await signer.sendTransaction(tx)`.
4. **Save `sporeId`** — It is the Type script args; required for all subsequent transfer/melt operations.
5. **Transfer** — `const { tx } = await spore.transferSpore({ signer, id: sporeId, to: newOwnerLock })`. Then `completeFeeBy` and `sendTransaction`.
6. **Melt (destroy)** — `const { tx } = await spore.meltSpore({ signer, id: sporeId })`. **Irreversible** — permanently destroys the NFT and all on-chain content.

### Amount Conversion (Shannon ↔ CKB)

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

## Wallet Support Matrix

CCC bridges multiple chain ecosystems into CKB via a unified `Signer` interface:

| Package | Wallet(s) | Chain(s) |
|---|---|---|
| `@ckb-ccc/joy-id` | JoyID (passkey, no seed phrase) | CKB / BTC / EVM / Nostr |
| `@ckb-ccc/eip6963` | MetaMask, Rabby, OKX EVM, any EIP-6963 wallet | EVM |
| `@ckb-ccc/uni-sat` | UniSat | BTC |
| `@ckb-ccc/okx` | OKX Wallet | BTC / Nostr |
| `@ckb-ccc/xverse` | Xverse, SATS Connect wallets | BTC |
| `@ckb-ccc/nip07` | nos2x, Alby, NIP-07 extensions | Nostr |
| `@ckb-ccc/utxo-global` | UTXO Global | CKB / BTC / DOGE |
| `@ckb-ccc/rei` | REI Wallet | CKB |

All wallet packages are pre-bundled in `@ckb-ccc/connector-react` and `@ckb-ccc/ccc`.
Only install individually for custom integrations.

---

## UDT Tokens (Fungible)

```typescript
import { ccc } from "@ckb-ccc/shell";

// Construct a Udt instance
const type = await ccc.Script.fromKnownScript(
  signer.client, ccc.KnownScript.XUdt, "0x<issuer-lock-hash>"
);
const code = (await signer.client.getCellDeps(
  (await signer.client.getKnownScript(ccc.KnownScript.XUdt)).cellDeps
))[0].outPoint;

const udt = new ccc.udt.Udt(code, type);

// Transfer tokens — always three steps after udt.transfer
let { res: tx } = await udt.transfer(signer, [{ to: recipientLock, amount: 100n }]);
tx = await udt.completeBy(tx, signer);        // fill UDT inputs + change
await tx.completeInputsByCapacity(signer);     // fill CKB capacity
await tx.completeFeeBy(signer);
const txHash = await signer.sendTransaction(tx);
```

**Rule**: UDT transfers need `completeBy` (UDT) then `completeInputsByCapacity` (CKB) —
order matters.

---

## Spore Protocol (DOBs / On-chain NFTs)

```typescript
import { spore } from "@ckb-ccc/spore"; // or ccc.spore from @ckb-ccc/shell

// Create a Spore (stores content permanently on-chain)
const { tx, id: sporeId } = await spore.createSpore({
  signer,
  data: {
    contentType: "text/plain",
    content: new TextEncoder().encode("Hello, Spore!"),
  },
});
await tx.completeInputsByCapacity(signer);
await tx.completeFeeBy(signer);
const txHash = await signer.sendTransaction(tx);
// Save sporeId — it's the Type script args, needed for transfer/melt

// Transfer a Spore
const { script: newOwner } = await ccc.Address.fromString(recipientAddr, signer.client);
const { tx: transferTx } = await spore.transferSpore({ signer, id: sporeId, to: newOwner });
await transferTx.completeFeeBy(signer);
await signer.sendTransaction(transferTx);

// Melt (destroy) a Spore — irreversible
const { tx: meltTx } = await spore.meltSpore({ signer, id: sporeId });
await meltTx.completeFeeBy(signer);
await signer.sendTransaction(meltTx);
```

Spore stores content fully on-chain. Large content (images) requires substantial CKB
capacity. Text Spore ≈ 200+ CKB minimum.

---

## Message Signing and Verification

```typescript
// Sign (works identically across all wallet types)
const sig = await signer.signMessage("Hello world");
// sig.signature — hex string
// sig.signType  — "CkbSecp256k1" | "EvmPersonal" | "BtcEcdsa" | "JoyId" | ...
// sig.identity  — signer's address or public key

// Verify (static — no connected wallet needed)
const isValid = await ccc.Signer.verifyMessage("Hello world", sig); // true
const isFail  = await ccc.Signer.verifyMessage("Wrong", sig);       // false
```

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

## Common Gotchas

| Symptom / Error | Cause | Fix |
|---|---|---|
| `ERR_REQUIRE_ESM` | CJS project importing CCC | Add `"type": "module"` to package.json or use dynamic `import()` |
| `createContext is not a function` | Missing `"use client"` in Next.js | Add `"use client"` to any file using `ccc.Provider` or `useCcc()` |
| `Property '*' not found on ccc` | Wrong `moduleResolution` | Set `"moduleResolution": "bundler"` in tsconfig; do not use `node` or `classic` |
| `"not enough capacity"` | Insufficient CKB | Fund the address; each output cell needs ≥ 61 CKB |
| `"InsufficientCellCapacity"` | Output cell below minimum | Each basic output needs ≥ 61 CKB capacity; use CCC helpers, not manual calculation |
| `"invalid private key"` | Wrong key format | Key must be 32 bytes (64 hex chars); the `0x` prefix is optional |
| Transaction rejected by node | Fee too low or missing | Always call `completeFeeBy` after `completeInputsByCapacity`; omit fee rate arg for automatic rate |
| Wrong address on wrong network | Mainnet/testnet mismatch | `ckb` prefix = mainnet, `ckt` prefix = testnet; client and address must match |
| Signer methods fail silently | Wallet not connected | Check `await signer.isConnected()`; some signers need explicit `await signer.connect()` |
| `useSigner()` returns `undefined` | Called outside `<ccc.Provider>` | Ensure `ccc.Provider` wraps the component tree |
| UDT tokens lost after transfer | `udt.completeBy()` not called | Always call `udt.completeBy(tx, signer)` before `completeInputsByCapacity`; it adds the token change output |
| `createSpore` throws on `clusterId` | `clusterMode` not specified | Specify `clusterMode: "lockProxy" \| "clusterCell" \| "skip"` when `clusterId` is set |
| `udt.name()` / `symbol()` returns `undefined` | Token doesn't implement SSRI | Only xUDT with SSRI support returns metadata; always guard with `?? "unknown"` |
| `addCellDepsOfKnownScripts is not a function` | Wrong import or outdated version | Use `@ckb-ccc/shell` not `@ckb-ccc/core` for backend; update CCC to latest |

---

## Hallucination Guard: What NOT to Generate

These patterns look plausible but are wrong for CKB/CCC:

- ❌ `signer.getBalance()` returns a `number` — it returns `bigint` (Shannon)
- ❌ `new ccc.Transaction()` — always use `ccc.Transaction.from({ outputs: [...] })`
- ❌ Manually computing fees — always use `completeFeeBy`
- ❌ Manually selecting input cells — always use `completeInputsByCapacity`
- ❌ Calling `completeFeeBy` before `completeInputsByCapacity` — order is mandatory
- ❌ `tx.addCellDepsOfKnownScripts` without `await` — it's async
- ❌ `useSigner()` outside `<ccc.Provider>` — will return undefined
- ❌ Using EVM address format (`0x...` 20-byte) as CKB address — CKB uses bech32m (`ckb1...`)
- ❌ `ccc.fixedPointFrom(100.5)` with float arithmetic on Shannon — use string `"100.5"`
- ❌ Hardcoding private keys in source — always use environment variables

---

## Pre-submission Checklist

Before finalizing any CCC code, verify:

- [ ] **Package** — Correct package for the environment (`connector-react` / `shell` / `ccc`)
- [ ] **TypeScript** — `tsconfig.json` has `moduleResolution: "bundler"` (or `node16`/`nodenext`)
- [ ] **React setup** — `"use client"` on files using `ccc.Provider` or hooks (Next.js App Router)
- [ ] **Network match** — Client network (testnet/mainnet) matches address prefix (`ckt`/`ckb`)
- [ ] **Transaction order** — `outputs declared → completeInputsByCapacity → completeFeeBy → sendTransaction`
- [ ] **Signer guard** — `if (!signer) return` before any transaction operation
- [ ] **Capacity** — Output cells have ≥ 61 CKB (CCC helpers enforce this; manual calc may not)
- [ ] **UDT change** — `udt.completeBy()` called before `completeInputsByCapacity` for token transfers
- [ ] **Spore cluster** — `clusterMode` specified when `clusterId` is set in `createSpore()`
- [ ] **Fee rate** — `completeFeeBy` called without explicit rate (automatic) unless custom rate needed
- [ ] **Amount conversion** — User-facing amounts go through `fixedPointFrom()` / `fixedPointToString()`
- [ ] **No hardcoded secrets** — Private keys loaded from environment variables
- [ ] **Error handling** — `try/catch` around `sendTransaction`, `connect`, `getBalance`

---

## How to Use This Documentation

When you need information beyond what this skill covers, fetch it directly rather
than guessing. The docs site is structured for programmatic access:

### Step 1 — Start with llms.txt for navigation

```
GET https://docs.ckbccc.com/llms.txt
```

Returns a structured index of all documentation pages with titles and URLs.
Use this to identify which page covers the topic you need.

### Step 2 — Fetch the specific page as Markdown

Append `.md` to any docs URL to get clean Markdown without HTML boilerplate:

```
# Example: fetch the Cell model concept page
GET https://docs.ckbccc.com/en/docs/concepts/cell-model.md

# Pattern for any page:
GET https://docs.ckbccc.com/en/docs/<section>/<page>.md
```

Alternatively, send `Accept: text/markdown` and the server will serve Markdown
automatically via content negotiation.

### Step 3 — Use llms-full.txt for broad questions

```
GET https://docs.ckbccc.com/llms-full.txt
```

Contains the full text of all English documentation pages concatenated.
Use when the question spans multiple pages or you need a complete overview.
Prefer per-page fetches when the relevant section is known — narrower context
means less noise.

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

### For API signatures and types — use the API reference

```
https://api.ckbccc.com
```

TypeDoc-generated reference for all `@ckb-ccc/*` packages. Use when you need
the exact signature of a method, the fields of an interface, or available
enum values. Search by class or method name directly in the URL:

```
https://api.ckbccc.com/modules/_ckb-ccc_connector-react
https://api.ckbccc.com/functions/_ckb-ccc_connector-react.index.useccc
https://api.ckbccc.com/classes/_ckb-ccc_core.index.transaction
https://api.ckbccc.com/enums/_ckb-ccc_core.index.knownscript
```

### Decision guide: which resource to fetch

| Situation | Fetch |
|---|---|
| "How do I do X with CCC?" | Per-page `.md` from docs |
| "What does method Y return?" | api.ckbccc.com |
| "Give me a working example" | Fetch https://docs.ckbccc.com/en/docs/code-examples.md, extract source fields from the <ExampleGrid /> items, then fetch the raw GitHub URL to get the TypeScript source |
| "Which page covers topic Z?" | llms.txt index first, then the page |
| "Broad overview of CCC" | llms-full.txt |

---

## Reference Links

- Docs: https://docs.ckbccc.com
- llms.txt: https://docs.ckbccc.com/llms.txt
- llms-full.txt: https://docs.ckbccc.com/llms-full.txt
- Per-page markdown: append `.md` to any docs URL
- API reference: https://api.ckbccc.com
- Playground (live code): https://live.ckbccc.com
- GitHub: https://github.com/ckb-devrel/ccc