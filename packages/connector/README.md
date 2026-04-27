# @ckb-ccc/connector

Framework-agnostic Web Component wallet connector for CCC. Use this package if you are building a frontend with **Vue, Svelte, vanilla JS**, or any non-React framework. It provides a built-in wallet selection modal as a standard Web Component.

For **React** apps, use [`@ckb-ccc/connector-react`](https://www.npmjs.com/package/@ckb-ccc/connector-react) instead.

[![NPM Version](https://img.shields.io/npm/v/%40ckb-ccc%2Fconnector)](https://www.npmjs.com/package/@ckb-ccc/connector)

## Installation

```bash
npm install @ckb-ccc/connector
```

## When to Use This Package

| Your Scenario | Package |
|---------------|---------|
| **Vue / Svelte / vanilla JS with built-in modal** | **`@ckb-ccc/connector` ← this package** |
| React app | `@ckb-ccc/connector-react` |
| Custom wallet UI (no modal) | `@ckb-ccc/ccc` |
| Node.js backend | `@ckb-ccc/shell` |

## Usage

```typescript
import { ccc } from "@ckb-ccc/connector";

// The connector is a Web Component: <ccc-connector>
// Add it to your HTML or template:
// <ccc-connector id="connector"></ccc-connector>

// Access the connector element
const connector = document.getElementById("connector");

// Listen for signer changes
connector.addEventListener("signer-changed", (event) => {
  const signer = event.detail;
  if (signer) {
    console.log("Wallet connected!");
  }
});
```

## What's Included

This package re-exports everything from `@ckb-ccc/ccc` plus:

- **`<ccc-connector>`** — Web Component with built-in wallet selection modal
- Automatic discovery of all supported wallets (JoyID, MetaMask, UniSat, OKX, etc.)

## Links

- [CCC Documentation](https://docs.ckbccc.com)
- [API Reference](https://api.ckbccc.com)
- [CCC GitHub](https://github.com/ckb-devrel/ccc)
