# @ckb-ccc/utxo-global

UTXO Global wallet signer for CCC. [UTXO Global](https://utxo.global/) is a multi-chain browser extension wallet that supports CKB, Bitcoin, and Dogecoin natively. It provides direct signing for CKB transactions as well as cross-chain signing from BTC and Doge.

[![NPM Version](https://img.shields.io/npm/v/%40ckb-ccc%2Futxo-global)](https://www.npmjs.com/package/@ckb-ccc/utxo-global)

## Installation

```bash
npm install @ckb-ccc/utxo-global
```

> **Note**: In most cases you don't need to install this package directly. It is included automatically when you use `@ckb-ccc/ccc` (browser) or `@ckb-ccc/connector-react` (React).

## Supported Signer Types

| Signer Class | Base Type | Chain | Description |
|-------------|-----------|-------|-------------|
| `SignerCkb` | `ccc.Signer` | CKB | Native CKB signing |
| `SignerBtc` | `ccc.SignerBtc` | Bitcoin | Bitcoin signing mapped to CKB |
| `SignerDoge` | `ccc.SignerDoge` | Dogecoin | Dogecoin signing mapped to CKB |

## Usage with React (Recommended)

UTXO Global appears automatically in the wallet modal:

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

- [UTXO Global Website](https://utxo.global/)
- [CCC Documentation](https://docs.ckbccc.com)
- [CCC GitHub](https://github.com/ckb-devrel/ccc)
