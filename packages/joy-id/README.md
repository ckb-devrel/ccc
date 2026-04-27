# @ckb-ccc/joy-id

JoyID wallet signer for CCC. [JoyID](https://joy.id/) is a passwordless, cross-chain wallet that uses passkeys (WebAuthn) for authentication. It natively supports CKB, Ethereum, Bitcoin, and Nostr.

[![NPM Version](https://img.shields.io/npm/v/%40ckb-ccc%2Fjoy-id)](https://www.npmjs.com/package/@ckb-ccc/joy-id)

## Installation

```bash
npm install @ckb-ccc/joy-id
```

> **Note**: In most cases you don't need to install this package directly. It is included automatically when you use `@ckb-ccc/ccc` (browser) or `@ckb-ccc/connector-react` (React).

## Supported Signer Types

JoyID provides multiple signer types through a single wallet:

| Signer Class | Base Type | Chain | Description |
|-------------|-----------|-------|-------------|
| `CkbSigner` | `ccc.Signer` | CKB | Native CKB signing |
| `EvmSigner` | `ccc.SignerEvm` | Ethereum/EVM | EVM-compatible signing |
| `BitcoinSigner` | `ccc.SignerBtc` | Bitcoin | Bitcoin signing |
| `NostrSigner` | `ccc.SignerNostr` | Nostr | Nostr (NIP-07) signing |

## Usage with React (Recommended)

JoyID is automatically available in the wallet selection modal when using `@ckb-ccc/connector-react`:

```tsx
"use client";
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

  return (
    <button onClick={open}>
      {signer ? "Connected via JoyID" : "Connect Wallet"}
    </button>
  );
}
```

## Standalone Usage

```typescript
import { ccc } from "@ckb-ccc/ccc";

const client = new ccc.ClientPublicTestnet();

// JoyID signers are available when JoyID is registered as a signer source.
// In standalone mode, you typically use the connector or connector-react
// which handles JoyID signer discovery automatically.
```

## Links

- [JoyID Website](https://joy.id/)
- [CCC Documentation](https://docs.ckbccc.com)
- [CCC GitHub](https://github.com/ckb-devrel/ccc)
