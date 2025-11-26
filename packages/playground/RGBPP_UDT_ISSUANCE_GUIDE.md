# `@ckb-ccc/rgbpp` Development Guide

## Overview

This guide demonstrates how to use the `@ckb-ccc/rgbpp` package to build RGB++ applications on Bitcoin and CKB. We'll walk through a complete RGB++ [xUDT](https://docs.nervos.org/docs/tech-explanation/xudt) issuance example to showcase the key concepts and development patterns on the interactive playground environment.

## Prerequisites

Before running this example, ensure you have:

1. **Supported Wallet**: UniSat, JoyID
2. **Testnet Environment**: Currently only Bitcoin Testnet3 and CKB Testnet are supported on the playground environment
3. **Test Funds**: 
   - Bitcoin Testnet3 funds from [Bitcoin Faucet](https://bitcoinfaucet.uo1.net/)
   - CKB Testnet funds from [Nervos Faucet](https://faucet.nervos.org/)

Basic understanding of the RGB++ protocol is also desired. Learn more at [RGB++ Protocol](https://rgbpp.com/).

## RGB++ xUDT Issuance Example

Let's walk through a complete RGB++ xUDT issuance example using `@ckb-ccc/rgbpp`:

### Step 1: Basic Setup

Environment validation and network configuration:

```typescript
// Basic wallet and network validation
if (!signer || !(signer instanceof ccc.SignerBtc)) {
  throw new Error("Wallet not supported");
}
if (client.addressPrefix !== "ckt") {
  throw new Error("Only Testnet is supported for now");
}

// Initialize RGB++ network configuration
const networkConfig = ccc.rgbpp.buildNetworkConfig(
  ccc.rgbpp.PredefinedNetwork.BitcoinTestnet3,
  { cellDeps: { /* ... */ } }
);
```

`buildNetworkConfig` sets up the essential RGB++ network configuration with proper cell dependencies for isomorphic binding, among other configurations.

### Step 2: RGB++ Wallet and Client Setup

```typescript
const btcRgbppSigner = await ccc.rgbpp.createBrowserRgbppBtcWallet(
  signer,
  networkConfig,
  {
    url: "https://api-testnet.rgbpp.com",
    isMainnet: signer.client.addressPrefix === "ckt",
  },
);

const rgbppUdtClient = new ccc.rgbpp.RgbppUdtClient(networkConfig, signer.client);
const ckbRgbppUnlockSinger = new ccc.rgbpp.CkbRgbppUnlockSinger(...);
```

`https://api-testnet.rgbpp.com` here is the testnet btc-assets-api URL. It's a service that retrieves BTC/RGB++ information/assets and processes transactions with these assets. It serves as the critical infrastructure component that connects Bitcoin and CKB networks for RGB++ operations.

**Key Components**: 
- `createBrowserRgbppBtcWallet`: Creates RGB++ Bitcoin wallet for cross-chain operations
- `RgbppUdtClient`: High-level APIs for xUDT operations
- `CkbRgbppUnlockSinger`: Handles RGB++ lock script unlock logic

### Step 3: UTXO Seal and Issuance Cell

```typescript
const utxoSeal = await btcRgbppSigner.prepareUtxoSeal();

const rgbppIssuanceCells = await rgbppUdtClient.createRgbppUdtIssuanceCells(
  signer,
  utxoSeal,
);
```

The `prepareUtxoSeal` method creates the foundation for **isomorphic binding** - a one-to-one mapping between Bitcoin UTXOs and CKB Cells. This UTXO becomes cryptographically "sealed" to the CKB Cell containing xUDT data.

`rgbppIssuanceCells` is a CKB cell with its lock script set to the RGB++ lock script, using the UTXO as its argument. This configuration represents the user's intent to issue a RGB++ xUDT token, which will only be fulfilled after the initial UTXO is spent.

### Step 4: Partial CKB Transaction and RGB++ Bitcoin Transaction

```typescript
const ckbPartialTx = await rgbppUdtClient.issuanceCkbPartialTx({
  token: {
    name: "Just UDT",
    symbol: "jUDT", 
    decimal: 8,
  },
  amount: 2100_0000n,
  rgbppLiveCells: rgbppIssuanceCells,
  udtScriptInfo: {/* ... */},
});

const { psbt, indexedCkbPartialTx } = await btcRgbppSigner.buildPsbt({
  ckbPartialTx,
  ckbClient: signer.client,
  rgbppUdtClient,
  btcChangeAddress: btcAddress,
  receiverBtcAddresses: [btcAddress],
});

const btcTxId = await btcRgbppSigner.signAndBroadcast(psbt);
```

A partial CKB transaction is constructed using the CKB cell and xUDT script information, initially containing a placeholder for the corresponding Bitcoin transaction ID. Based on this, the commitment is calculated and the BTC transaction is assembled, which is then submitted to the network.

### Step 5: Final RGB++ CKB Transaction

```typescript
const ckbPartialTxInjected = await rgbppUdtClient.injectTxIdToRgbppCkbTx(
  indexedCkbPartialTx,
  btcTxId,
);

const rgbppSignedCkbTx = await ckbRgbppUnlockSinger.signTransaction(ckbPartialTxInjected);
await rgbppSignedCkbTx.completeFeeBy(signer);
const ckbFinalTx = await signer.signTransaction(rgbppSignedCkbTx);
const txHash = await signer.client.sendTransaction(ckbFinalTx);
```

In `ckbRgbppUnlockSinger.signTransaction`, the BTC transaction's confirmation status is periodically checked through the SPV service. Upon confirmation, we acquire the new single-use seal which represents ownership of the issued RGB++ xUDT token. The transaction ID of this UTXO is used to replace the placeholder value in the RGB++ lock script, enabling the assembly of the final CKB transaction.

The final CKB transaction is then submitted to the network, completing the token issuance process.
