# @ckb-ccc/xverse

Xverse wallet signer for CCC. [Xverse](https://www.xverse.app/) is a Bitcoin wallet focused on Ordinals, BRC-20, and Stacks. CCC maps Xverse's Bitcoin signatures to CKB-compatible addresses, enabling Bitcoin users to interact with the CKB blockchain.

[![NPM Version](https://img.shields.io/npm/v/%40ckb-ccc%2Fxverse)](https://www.npmjs.com/package/@ckb-ccc/xverse)

## Installation

```bash
npm install @ckb-ccc/xverse
```

> **Note**: In most cases you don't need to install this package directly. It is included automatically when you use `@ckb-ccc/ccc` (browser) or `@ckb-ccc/connector-react` (React).

## Signer Type

| Signer Class | Base Type | Chain | Description |
|-------------|-----------|-------|-------------|
| `Signer` | `ccc.SignerBtc` | Bitcoin | Signs CKB transactions using the Xverse Bitcoin wallet |

## Usage with React (Recommended)

Xverse appears automatically in the wallet modal:

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

- [Xverse Website](https://www.xverse.app/)
- [CCC Documentation](https://docs.ckbccc.com)
- [CCC GitHub](https://github.com/ckb-devrel/ccc)
