# @ckb-ccc/uni-sat

UniSat wallet signer for CCC. [UniSat](https://unisat.io/) is a popular Bitcoin wallet extension that supports BRC-20, Ordinals, and more. CCC maps UniSat's Bitcoin signatures to CKB-compatible addresses, enabling Bitcoin users to interact with the CKB blockchain.

[![NPM Version](https://img.shields.io/npm/v/%40ckb-ccc%2Funi-sat)](https://www.npmjs.com/package/@ckb-ccc/uni-sat)

## Installation

```bash
npm install @ckb-ccc/uni-sat
```

> **Note**: In most cases you don't need to install this package directly. It is included automatically when you use `@ckb-ccc/ccc` (browser) or `@ckb-ccc/connector-react` (React).

## Signer Type

| Signer Class | Base Type | Chain | Description |
|-------------|-----------|-------|-------------|
| `Signer` | `ccc.SignerBtc` | Bitcoin | Signs CKB transactions using the UniSat Bitcoin wallet |

## How It Works

1. UniSat signs a message with the user's Bitcoin private key
2. CCC verifies the Bitcoin signature on-chain using CKB's cryptographic flexibility
3. The user's CKB address is derived from their Bitcoin public key

This means **Bitcoin users can use CKB without a separate CKB wallet**.

## Usage with React (Recommended)

UniSat appears automatically in the wallet modal:

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

- [UniSat Website](https://unisat.io/)
- [CCC Documentation](https://docs.ckbccc.com)
- [CCC GitHub](https://github.com/ckb-devrel/ccc)
