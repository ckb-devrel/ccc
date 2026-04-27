<p align="center">
  <a href="https://app.ckbccc.com/">
    <img alt="Logo" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/logoAndText.svg" style="height: 8rem; max-width: 90%; padding: 0.5rem 0;" />
  </a>
</p>

<h1 align="center" style="font-size: 48px;">
  @ckb-ccc/eip6963
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@ckb-ccc/eip6963"><img
    alt="NPM Version" src="https://img.shields.io/npm/v/%40ckb-ccc%2Feip6963"
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

> Connect **MetaMask and other EVM wallets** to CKB via [EIP-6963](https://eips.ethereum.org/EIPS/eip-6963) (Multi Injected Provider Discovery). Users sign with their Ethereum wallet, and CCC maps the EVM signature to a CKB address.

## How It Works

CKB's cryptographic freedom allows verifying Ethereum's `personal_sign` signatures on-chain. This means:

1. User signs a message with MetaMask (or any EVM wallet)
2. CCC converts the EVM signature to a CKB-compatible witness
3. The transaction is sent to CKB using the user's EVM-derived CKB address

The user **does not need CKB-specific wallet software** — MetaMask alone is sufficient.

## Install

```bash
npm install @ckb-ccc/eip6963
```

> **Note**: If you use `@ckb-ccc/connector-react` or `@ckb-ccc/ccc`, EIP-6963 support is **already included**. You only need this package for standalone or custom integration.

## Quick Start: Standalone Usage

```typescript
import { ccc } from "@ckb-ccc/core";
import { Signer, SignerFactory } from "@ckb-ccc/eip6963";

const client = new ccc.ClientPublicTestnet();

// Discover all injected EVM wallets
const factory = new SignerFactory(client);
factory.subscribeSigners((signer, detail) => {
  console.log(`Found wallet: ${detail?.info.name}`);

  // Use this signer to sign CKB transactions
  useSigner(signer);
});

async function useSigner(signer: Signer) {
  await signer.connect();

  // Get CKB address (derived from EVM account)
  const address = await signer.getRecommendedAddress();
  console.log("CKB Address:", address);

  // Get balance
  const balance = await signer.getBalance();
  console.log(`Balance: ${ccc.fixedPointToString(balance)} CKB`);

  // Send a CKB transaction — user signs via MetaMask
  const tx = ccc.Transaction.from({
    outputs: [{ capacity: ccc.fixedPointFrom(100), lock: receiverLock }],
  });
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer);
  const txHash = await signer.sendTransaction(tx);
  console.log("Sent:", txHash);
}
```

## With `@ckb-ccc/connector-react`

If you use the React connector, MetaMask is automatically available in the wallet selection modal:

```tsx
import { ccc } from "@ckb-ccc/connector-react";

function App() {
  return (
    <ccc.Provider>
      <WalletButton />
    </ccc.Provider>
  );
}

function WalletButton() {
  const { open } = ccc.useCcc();
  const signer = ccc.useSigner();
  // When user selects MetaMask, signer will be an EIP-6963 Signer
  // All transaction methods work the same regardless of wallet type
  return <button onClick={open}>Connect</button>;
}
```

## API

### `Signer`

Extends `ccc.SignerEvm`. Created from an EIP-1193 provider (e.g., `window.ethereum`):

| Method | Description |
|--------|-------------|
| `connect()` | Request accounts from the EVM wallet |
| `isConnected()` | Check if accounts are available |
| `getEvmAccount()` | Get the connected Ethereum address |
| `signMessageRaw(message)` | Sign with `personal_sign` |

All inherited `ccc.Signer` methods also work: `getRecommendedAddress()`, `getBalance()`, `sendTransaction()`, `findCells()`, etc.

### `SignerFactory`

Discovers all injected EVM wallets via EIP-6963:

```typescript
const factory = new SignerFactory(client);
const unsubscribe = factory.subscribeSigners((signer, detail) => {
  // detail.info.name — wallet name (e.g., "MetaMask")
  // detail.info.icon — wallet icon URL
  // signer — ready-to-use CCC Signer
});
```

## Links

- [EIP-6963 Spec](https://eips.ethereum.org/EIPS/eip-6963)
- [API Reference](https://api.ckbccc.com)
- [Documentation](https://docs.ckbccc.com)
- [GitHub](https://github.com/ckb-devrel/ccc)
