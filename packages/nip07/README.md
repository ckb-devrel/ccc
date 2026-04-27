# @ckb-ccc/nip07

NIP-07 (Nostr) wallet signer for CCC. [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md) is a standard for Nostr browser extensions (e.g., Alby, nos2x). CCC maps Nostr Schnorr signatures to CKB-compatible addresses, enabling Nostr users to interact with the CKB blockchain.

[![NPM Version](https://img.shields.io/npm/v/%40ckb-ccc%2Fnip07)](https://www.npmjs.com/package/@ckb-ccc/nip07)

## Installation

```bash
npm install @ckb-ccc/nip07
```

> **Note**: In most cases you don't need to install this package directly. It is included automatically when you use `@ckb-ccc/ccc` (browser) or `@ckb-ccc/connector-react` (React).

## Signer Type

| Signer Class | Base Type | Chain | Description |
|-------------|-----------|-------|-------------|
| `Signer` | `ccc.SignerNostr` | Nostr | Signs CKB transactions using a NIP-07 Nostr extension |

## How It Works

1. The Nostr extension provides the user's public key via `window.nostr.getPublicKey()`
2. CCC derives a CKB address from the Nostr public key
3. Transactions are signed using Schnorr signatures via `window.nostr.signEvent()`
4. CKB verifies the Schnorr signature on-chain

## Usage with React (Recommended)

NIP-07 wallets (Alby, nos2x, etc.) appear automatically in the wallet modal:

```tsx
"use client";
import { ccc } from "@ckb-ccc/connector-react";

function App() {
  return (
    <ccc.Provider>
      <MyComponent />
    </ccc.Provider>
  );
}
```

## Compatible Nostr Extensions

- [Alby](https://getalby.com/) — Lightning + Nostr browser extension
- [nos2x](https://github.com/nickolasfisher/nos2x) — Lightweight Nostr extension
- Any browser extension implementing the [NIP-07 standard](https://github.com/nostr-protocol/nips/blob/master/07.md)

## Links

- [NIP-07 Specification](https://github.com/nostr-protocol/nips/blob/master/07.md)
- [CCC Documentation](https://docs.ckbccc.com)
- [CCC GitHub](https://github.com/ckb-devrel/ccc)
