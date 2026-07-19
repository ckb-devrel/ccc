---
name: ckb-ccc-signer-setup
description: Covers obtaining a working CCC Signer — connecting a wallet in a React/Next.js dApp via ccc.Provider and hooks, or creating a private-key signer in a Node.js backend script — plus the supported wallet matrix (JoyID, MetaMask/EIP-6963, UniSat, OKX, Xverse, Nostr, UTXO Global, REI) and message signing/verification. Use when the user asks how to connect a wallet, which wallet package to install, how to authenticate a backend script, or how to sign/verify a message — even if they just say "log in" or "connect" without mentioning "signer" or "wallet" by name. Requires ckb-ccc-fundamentals for package selection and address handling.
metadata:
  author: ckb-devrel
  version: "1.0.0"
  role: spoke
  depends-on: "ckb-ccc-fundamentals"
  priority: normal
---

# CKB CCC — Signer Setup

Covers every way to get a working `Signer` instance: connecting a wallet in a
React dApp, or creating a private-key signer in a Node.js backend. Both paths
converge on the same `Signer` interface, so the rest of your code (building
and sending transactions) is identical either way — see `ckb-ccc-transactions`
for that part.

Package selection (`connector-react` vs `shell`) is covered in
`ckb-ccc-fundamentals` — read that first if you haven't picked a package yet.

---

## Building a React dApp with wallet connection

1. **Install and wrap Provider** — Install `@ckb-ccc/connector-react`. Wrap root component with `<ccc.Provider name="Your App Name" icon="/your_app_logo.png">`. Add `"use client"` for Next.js App Router.
2. **Add wallet connection UI** — Use `ccc.useCcc()` to get `open`, `wallet`, `signerInfo`, `disconnect`. Render connect/disconnect button based on `signerInfo` presence.
3. **Get signer** — Call `const signer = ccc.useSigner()` inside a component; guard with `if (!signer) return` before any transaction operation.
4. **Resolve recipient** — `const { script: lock } = await ccc.Address.fromString(toAddress, signer.client)`.
5. **Build transaction** — `const tx = ccc.Transaction.from({ outputs: [{ capacity: ccc.fixedPointFrom("100"), lock }] })`.
6. **Complete inputs** — `await tx.completeInputsByCapacity(signer)` — must come before fee calculation.
7. **Pay fee** — `await tx.completeFeeBy(signer)` — omit fee rate argument to use automatic network rate.
8. **Send** — `const txHash = await signer.sendTransaction(tx)`.
9. **Verify** — Optionally wait for confirmation: `await signer.client.waitTransaction(txHash, 1)`.

(Steps 4–9 are the general transaction-composition pattern — see
`ckb-ccc-transactions` for the full explanation, cell deps, and querying.)

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

---

## Building a Node.js backend script

1. **Import and connect** — Install `@ckb-ccc/shell`. Create client: `new ccc.ClientPublicTestnet()` or `ClientPublicMainnet()`.
2. **Create signer** — `new ccc.SignerCkbPrivateKey(client, process.env.CKB_PRIVATE_KEY!)`. Never hardcode keys. (Validate environment variable exists first—see code example below)
3. **Check connection** — Some signers require `await signer.connect()`. Check with `await signer.isConnected()` if operations fail unexpectedly.
4. **Query data** — `await signer.getRecommendedAddress()`, `await signer.getBalance()`, `for await (const cell of client.findCellsByLock(...))`.
5. **Build and send** — Follow the transaction-composition pattern in `ckb-ccc-transactions`; the pattern is identical regardless of how the signer was created.
6. **Verify** — Log `txHash`; use `await client.waitTransaction(txHash, 1)` for confirmation checks.

```typescript
import { ccc } from "@ckb-ccc/shell";

// Always load private key from environment — never hardcode
const client = new ccc.ClientPublicTestnet(); // or ClientPublicMainnet

const privateKey = process.env.CKB_PRIVATE_KEY;
if (!privateKey) throw new Error("CKB_PRIVATE_KEY is required");
const signer = new ccc.SignerCkbPrivateKey(client, privateKey);

await signer.connect();

const address = await signer.getRecommendedAddress(); // "ckt1q..." or "ckb1q..."
const balance = await signer.getBalance(); // bigint in Shannon
```

**TypeScript config** — `@ckb-ccc/shell` ships ESM only:
```json
{ "compilerOptions": { "moduleResolution": "bundler" } }
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

## Gotchas (signer/wallet-specific)

| Symptom / Error | Cause | Fix |
|---|---|---|
| `createContext is not a function` | Missing `"use client"` in Next.js | Add `"use client"` to any file using `ccc.Provider` or `useCcc()` |
| `"invalid private key"` | Wrong key format | Key must be 32 bytes (64 hex chars); the `0x` prefix is optional |
| Signer methods fail silently | Wallet not connected | Check `await signer.isConnected()`; some signers need explicit `await signer.connect()` |
| `useSigner()` returns `undefined` | Called outside `<ccc.Provider>` | Ensure `ccc.Provider` wraps the component tree |

---

## Hallucination Guard

- ❌ `useSigner()` outside `<ccc.Provider>` — will return undefined
- ❌ Hardcoding private keys in source — always use environment variables

---

## Checklist (signer/wallet-specific)

- [ ] **React setup** — `"use client"` on files using `ccc.Provider` or hooks (Next.js App Router)
- [ ] **Signer guard** — `if (!signer) return` before any transaction operation
- [ ] **No hardcoded secrets** — Private keys loaded from environment variables
- [ ] **Error handling** — `try/catch` around `connect()` / `getBalance()`

Also check the cross-cutting checklist in `ckb-ccc-fundamentals`.
