<p align="center">
  <a href="https://app.ckbccc.com/">
    <img alt="Logo" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/logoAndText.svg" style="height: 8rem; max-width: 90%; padding: 0.5rem 0;" />
  </a>
</p>

<h1 align="center" style="font-size: 48px;">
  @ckb-ccc/connector-react
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@ckb-ccc/connector-react"><img
    alt="NPM Version" src="https://img.shields.io/npm/v/%40ckb-ccc%2Fconnector-react"
  /></a>
  <img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/ckb-devrel/ccc" />
  <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/ckb-devrel/ccc/master" />
  <img alt="GitHub branch check runs" src="https://img.shields.io/github/check-runs/ckb-devrel/ccc/master" />
  <a href="https://live.ckbccc.com/"><img
    alt="Playground" src="https://img.shields.io/website?url=https%3A%2F%2Flive.ckbccc.com%2F&label=Playground"
  /></a>
  <a href="https://app.ckbccc.com/"><img
    alt="App" src="https://img.shields.io/website?url=https%3A%2F%2Fapp.ckbccc.com%2F&label=App"
  /></a>
  <a href="https://docs.ckbccc.com/"><img
    alt="Docs" src="https://img.shields.io/website?url=https%3A%2F%2Fdocs.ckbccc.com%2F&label=Docs"
  /></a>
</p>

<p align="center">
  CCC - CKBers' Codebase is a one-stop solution for your CKB JS/TS ecosystem development.
  <br />
  Empower yourself with CCC to discover the unlimited potential of CKB.
  <br />
  Interoperate with wallets from different chain ecosystems.
  <br />
  Fully enabling CKB's Turing completeness and cryptographic freedom power.
</p>

> React components and hooks for connecting CKB wallets (MetaMask, UniSat, JoyID, OKX, and more) to your React/Next.js app. Provides a built-in wallet connection modal, `useCcc` hook, and `useSigner` hook.

## Install

```bash
npm install @ckb-ccc/connector-react
```

## Quick Start

### 1. Wrap your app with `ccc.Provider`

```tsx
"use client"; // Required for Next.js App Router

import { ccc } from "@ckb-ccc/connector-react";

export default function App() {
  return (
    <ccc.Provider>
      <YourApp />
    </ccc.Provider>
  );
}
```

### 2. Use hooks in child components

```tsx
"use client";

import { ccc } from "@ckb-ccc/connector-react";

function WalletButton() {
  const { open, disconnect, wallet, signerInfo } = ccc.useCcc();
  const signer = ccc.useSigner();

  if (!signer) {
    return <button onClick={open}>Connect Wallet</button>;
  }

  return (
    <div>
      <p>Connected: {wallet?.name}</p>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  );
}
```

### 3. Send a transaction with the connected signer

```tsx
"use client";

import { ccc } from "@ckb-ccc/connector-react";

function TransferButton() {
  const signer = ccc.useSigner();

  const handleTransfer = async () => {
    if (!signer) return;

    const { script: receiverLock } = await ccc.Address.fromString(
      "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq...",
      signer.client,
    );

    const tx = ccc.Transaction.from({
      outputs: [{ capacity: ccc.fixedPointFrom(100), lock: receiverLock }],
    });

    await tx.completeInputsByCapacity(signer);
    await tx.completeFeeBy(signer);
    const txHash = await signer.sendTransaction(tx);
    console.log("Sent:", txHash);
  };

  return <button onClick={handleTransfer} disabled={!signer}>Transfer 100 CKB</button>;
}
```

## API Reference

### `ccc.Provider`

Wraps your app to provide wallet connection context. Props:

| Prop | Type | Description |
|------|------|-------------|
| `defaultClient` | `ccc.Client` | Default CKB client (defaults to testnet) |
| `clientOptions` | `{ client, name, icon }[]` | Network options for user to choose |
| `preferredNetworks` | `NetworkPreference[]` | Preferred networks |
| `signerFilter` | `(signerInfo, wallet) => Promise<boolean>` | Filter which wallets to show |
| `name` | `string` | App name shown in the modal |
| `icon` | `string` | App icon shown in the modal |

### `ccc.useCcc()`

Returns the connection state:

```typescript
const {
  open,       // () => void — open wallet connection modal
  close,      // () => void — close the modal
  disconnect, // () => void — disconnect current wallet
  setClient,  // (client) => void — switch CKB client/network
  client,     // ccc.Client — current CKB client
  wallet,     // ccc.Wallet | undefined — connected wallet info
  signerInfo, // ccc.SignerInfo | undefined — connected signer metadata
} = ccc.useCcc();
```

### `ccc.useSigner()`

Returns the connected `ccc.Signer` instance, or `undefined` if not connected:

```typescript
const signer = ccc.useSigner();
// signer is ccc.Signer | undefined
```

## Notes

- **`"use client"` is required** in Next.js App Router for any component using `ccc.Provider`, `useCcc`, or `useSigner`
- All `ccc.*` types from `@ckb-ccc/core` are re-exported, so you only need one import
- The connector automatically discovers installed wallets (MetaMask via EIP-6963, UniSat, JoyID, etc.)

## Links

- [API Reference](https://api.ckbccc.com/modules/_ckb_ccc_connector_react.index.ccc.html)
- [Documentation](https://docs.ckbccc.com)
- [GitHub](https://github.com/ckb-devrel/ccc)
