# @ckb-ccc/rei

Rei wallet signer for CCC. [Rei Wallet](https://reiwallet.io/) is a CKB-native browser extension wallet. As a native CKB wallet, Rei provides direct Secp256k1 signing without the cross-chain signature mapping needed by BTC/EVM wallets.

[![NPM Version](https://img.shields.io/npm/v/%40ckb-ccc%2Frei)](https://www.npmjs.com/package/@ckb-ccc/rei)

## Installation

```bash
npm install @ckb-ccc/rei
```

> **Note**: In most cases you don't need to install this package directly. It is included automatically when you use `@ckb-ccc/ccc` (browser) or `@ckb-ccc/connector-react` (React).

## Signer Type

| Signer Class | Base Type | Chain | Description |
|-------------|-----------|-------|-------------|
| `ReiSigner` | `ccc.Signer` | CKB | Native CKB signing via the Rei browser extension |

## Usage with React (Recommended)

Rei appears automatically in the wallet modal:

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

## Links

- [Rei Wallet](https://reiwallet.io/)
- [CCC Documentation](https://docs.ckbccc.com)
- [CCC GitHub](https://github.com/ckb-devrel/ccc)
