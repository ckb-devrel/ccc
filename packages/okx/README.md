# @ckb-ccc/okx

OKX wallet signer for CCC. [OKX Wallet](https://www.okx.com/web3) is a multi-chain crypto wallet that supports Bitcoin, Ethereum, and other chains. CCC enables OKX users to sign CKB transactions using their Bitcoin or Nostr keys.

[![NPM Version](https://img.shields.io/npm/v/%40ckb-ccc%2Fokx)](https://www.npmjs.com/package/@ckb-ccc/okx)

## Installation

```bash
npm install @ckb-ccc/okx
```

> **Note**: In most cases you don't need to install this package directly. It is included automatically when you use `@ckb-ccc/ccc` (browser) or `@ckb-ccc/connector-react` (React).

## Supported Signer Types

| Signer Class | Base Type | Chain | Description |
|-------------|-----------|-------|-------------|
| `BitcoinSigner` | `ccc.SignerBtc` | Bitcoin | Signs via OKX Bitcoin provider |
| `NostrSigner` | `ccc.SignerNostr` | Nostr | Signs via OKX Nostr provider |

## Usage with React (Recommended)

OKX Wallet appears automatically in the wallet modal:

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

- [OKX Wallet](https://www.okx.com/web3)
- [CCC Documentation](https://docs.ckbccc.com)
- [CCC GitHub](https://github.com/ckb-devrel/ccc)
