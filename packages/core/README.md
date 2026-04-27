<p align="center">
  <a href="https://app.ckbccc.com/">
    <img alt="Logo" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/logoAndText.svg" style="height: 8rem; max-width: 90%; padding: 0.5rem 0;" />
  </a>
</p>

<h1 align="center" style="font-size: 48px;">
  @ckb-ccc/core
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@ckb-ccc/core"><img
    alt="NPM Version" src="https://img.shields.io/npm/v/%40ckb-ccc%2Fcore"
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

> Core package of the CCC SDK — provides all CKB primitives including `Transaction`, `Cell`, `Script`, `Client`, `Signer`, Molecule codec, and more.

## Important: CKB Uses the Cell Model, NOT Account Model

CKB uses the **Cell model** (a generalized UTXO model), fundamentally different from Ethereum/Solana's account model:

- A **Cell** = `capacity` + `lock script` + `type script` + `data`
- **Transactions** consume old Cells (inputs) and create new Cells (outputs)
- There is no "account balance" — balance = sum of all owned Cells' capacity
- **capacity** is denominated in CKB (1 CKB = 10^8 Shannons)

## Install

```bash
npm install @ckb-ccc/core
```

> **Tip**: Most developers should install `@ckb-ccc/ccc` (browser) or `@ckb-ccc/shell` (Node.js) instead, which re-export everything from `@ckb-ccc/core` plus wallet signers.

## Quick Start: Transfer CKB

```typescript
import { ccc } from "@ckb-ccc/core";

// 1. Connect to CKB testnet
const client = new ccc.ClientPublicTestnet();
const signer = new ccc.SignerCkbPrivateKey(client, "0xYOUR_PRIVATE_KEY");
await signer.connect();

// 2. Parse receiver address to a lock script
const { script: receiverLock } = await ccc.Address.fromString(
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq...",
  client,
);

// 3. Build transaction — just declare the desired outputs
const tx = ccc.Transaction.from({
  outputs: [{ capacity: ccc.fixedPointFrom(100), lock: receiverLock }],
});

// 4. Auto-fill inputs from signer's cells to cover output capacity
await tx.completeInputsByCapacity(signer);

// 5. Auto-calculate transaction fee and create change output
await tx.completeFeeBy(signer);

// 6. Sign and send
const txHash = await signer.sendTransaction(tx);
console.log(`Transaction sent: ${txHash}`);

// 7. Wait for on-chain confirmation
await client.waitTransaction(txHash);
console.log(`Transaction confirmed: ${txHash}`);
```

## Core Classes

| Class | Description | Creation |
|-------|-------------|----------|
| `Transaction` | CKB transaction | `Transaction.from({ outputs, ... })` |
| `Script` | Lock or Type script (`codeHash` + `hashType` + `args`) | `Script.from({ codeHash, hashType, args })` |
| `CellOutput` | Output cell structure (`capacity` + `lock` + optional `type`) | `CellOutput.from({ capacity, lock, type? })` |
| `CellInput` | Input reference (`previousOutput` + `since`) | `CellInput.from({ previousOutput, since? })` |
| `Cell` | On-chain cell (CellOutput + data + OutPoint) | `Cell.from({ outPoint, cellOutput, outputData })` |
| `OutPoint` | Cell location identifier (`txHash` + `index`) | `OutPoint.from({ txHash, index })` |
| `CellDep` | Cell dependency (`outPoint` + `depType`) | `CellDep.from({ outPoint, depType })` |
| `WitnessArgs` | Witness structure | `WitnessArgs.from({ lock?, inputType?, outputType? })` |
| `Address` | CKB address (encodes a lock Script) | `Address.fromString(addr, client)` |

## Transaction Key Methods

CCC uses a **declarative transaction composition** pattern — you describe WHAT you want (outputs), and CCC figures out HOW (inputs, fees, change):

| Method | Purpose |
|--------|---------|
| `Transaction.from(txLike)` | Create a transaction from a plain object |
| `tx.completeInputsByCapacity(signer)` | Auto-collect cells to cover output capacity |
| `tx.completeInputsByUdt(signer, type)` | Auto-collect cells to cover UDT amounts |
| `tx.completeInputsAll(signer)` | Collect ALL cells from the signer |
| `tx.completeFeeBy(signer, feeRate?)` | Auto-calculate fee + create change output |
| `tx.completeFee(signer, changeFn, feeRate?)` | Advanced: custom change logic |
| `tx.addOutput(cellOutput, data?)` | Add an output cell |
| `tx.addInput(cell)` | Add an input cell |
| `tx.addCellDepInfos(client, cellDepInfos)` | Add cell dependencies |

> **Important**: Always call `completeInputsByCapacity()` BEFORE `completeFeeBy()` — order matters.

## Client (CKB Node Connection)

```typescript
// Testnet (default endpoint: testnet.ckb.dev)
const client = new ccc.ClientPublicTestnet();

// Mainnet (default endpoint: mainnet.ckb.dev)
const client = new ccc.ClientPublicMainnet();

// Custom RPC endpoint
const client = new ccc.ClientJsonRpc("https://your-ckb-node-url");
```

Key `Client` methods:

| Method | Purpose |
|--------|---------|
| `client.getBalance(locks)` | Get total CKB balance for lock scripts |
| `client.getBalanceSingle(lock)` | Get CKB balance for a single lock script |
| `client.sendTransaction(tx)` | Send a signed transaction |
| `client.waitTransaction(txHash)` | Wait for transaction confirmation |
| `client.getCell(outPoint)` | Get a cell by its OutPoint |
| `client.getCellLive(outPoint)` | Get a live (unspent) cell |
| `client.findCellsPaged(searchKey)` | Search cells by criteria |
| `client.getTransaction(txHash)` | Get transaction by hash |
| `client.getKnownScript(knownScript)` | Get info for well-known scripts |
| `client.getTip()` | Get the latest block number |

## Signer (Multi-Chain Wallet Support)

The abstract `Signer` class provides a unified interface for signing across ecosystems:

| Signer Type | Chains | Wallet Packages |
|-------------|--------|-----------------|
| `CKB` | CKB native | `@ckb-ccc/joy-id` |
| `EVM` | Ethereum / EVM | `@ckb-ccc/eip6963` (MetaMask, etc.) |
| `BTC` | Bitcoin | `@ckb-ccc/uni-sat`, `@ckb-ccc/okx`, `@ckb-ccc/xverse`, `@ckb-ccc/utxo-global` |
| `Nostr` | Nostr | `@ckb-ccc/nip07` |

Key `Signer` methods:

```typescript
await signer.connect();
await signer.disconnect();
await signer.isConnected();

// Addresses
const addr = await signer.getRecommendedAddress();
const allAddrs = await signer.getAddresses();

// Balance
const balance = await signer.getBalance();

// Transaction
const txHash = await signer.sendTransaction(tx);

// Message signing
const sig = await signer.signMessage("hello");

// Find owned cells (async generator)
for await (const cell of signer.findCells({ type: typeScript })) {
  console.log(cell);
}
```

## KnownScript Enum

Reference well-known on-chain scripts by name instead of hardcoding code hashes:

```typescript
const xudtScript = await ccc.Script.fromKnownScript(
  client,
  ccc.KnownScript.XUdt,
  ownerLockHash,
);
```

Available values: `NervosDao`, `Secp256k1Blake160`, `Secp256k1Multisig`, `AnyoneCanPay`, `TypeId`, `XUdt`, `JoyId`, `COTA`, `PWLock`, `OmniLock`, `NostrLock`, `UniqueType`, `AlwaysSuccess`, `InputTypeProxyLock`, `OutputTypeProxyLock`, `LockProxyLock`, `SingleUseLock`, `TypeBurnLock`, `EasyToDiscoverType`, `TimeLock`

## Capacity & FixedPoint

CKB capacity uses 8 decimal places (1 CKB = 100,000,000 Shannons):

```typescript
ccc.fixedPointFrom(100)          // 100 CKB → 10000000000n (bigint in Shannons)
ccc.fixedPointFrom("1.5")        // 1.5 CKB → 150000000n
ccc.fixedPointToString(10000000000n) // → "100"
ccc.fixedPointToString(150000000n)   // → "1.5"
```

## Common Pitfalls

- **DO NOT** manually build complete transactions — use `completeInputsByCapacity()` + `completeFeeBy()`
- **DO NOT** assume account balances — CKB is Cell-based (UTXO-like), not account-based
- **DO NOT** hardcode script codeHash values — use `KnownScript` enum + `Script.fromKnownScript()`
- **DO** use `fixedPointFrom()` for capacity — never pass raw numbers as CKB amounts
- **DO** set `moduleResolution` in `tsconfig.json` to `node16`, `nodenext`, or `bundler`

## Links

- [API Reference](https://api.ckbccc.com)
- [Documentation](https://docs.ckbccc.com)
- [Playground](https://live.ckbccc.com)
- [GitHub](https://github.com/ckb-devrel/ccc)
