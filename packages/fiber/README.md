# Fiber SDK

Fiber SDK is a JavaScript/TypeScript library for interacting with Fiber nodes. It provides easy-to-use APIs for managing channels, payments, invoices, and node information.

## Features

- Channel management (open, close, query channels)
- Payment processing (send and query payments)
- Invoice management (create, parse, query invoices)
- Node information query
- Node connection management

## Installation

```bash
npm install @ckb-ccc/fiber
```

## Usage

### Initialize SDK

```javascript
import { FiberSDK } from "@ckb-ccc/fiber";

const sdk = new FiberSDK({
  endpoint: "http://127.0.0.1:8227", // Fiber node RPC address
  timeout: 5000, // Request timeout in milliseconds
});
```

## API Reference

### Channel Management

#### listChannels
List all channel information.

```javascript
const channels = await sdk.channel.listChannels();
```

Return Parameters:
- `channels`: Array of channels, each containing:
  - `channel_id`: Channel ID
  - `peer_id`: Peer node ID
  - `state_name`: Channel state name
  - `state_flags`: Channel state flags
  - `local_balance`: Local balance (hexadecimal)
  - `remote_balance`: Remote balance (hexadecimal)
  - `created_at`: Creation time (hexadecimal timestamp)
  - `is_public`: Whether the channel is public
  - `is_enabled`: Whether the channel is enabled
  - `tlc_expiry_delta`: TLC expiry delta
  - `tlc_min_value`: TLC minimum amount
  - `tlc_fee_proportional_millionths`: TLC fee proportion

#### openChannel
Open a new channel.

```javascript
const result = await sdk.channel.openChannel({
  peer_id: "QmbKyzq9qUmymW2Gi8Zq7kKVpPiNA1XUJ6uMvsUC4F3p89", // Peer node ID
  funding_amount: "0xba43b7400", // Channel funding amount (hexadecimal)
  public: true, // Whether the channel is public
  funding_udt_type_script: { // Optional UDT type script
    code_hash: "0x...",
    hash_type: "type",
    args: "0x...",
  },
  shutdown_script: { // Optional shutdown script
    code_hash: "0x...",
    hash_type: "type",
    args: "0x...",
  },
  commitment_delay_epoch: "0x...", // Optional commitment delay epoch
  commitment_fee_rate: "0x...", // Optional commitment fee rate
  funding_fee_rate: "0x...", // Optional funding fee rate
  tlc_expiry_delta: "0x...", // Optional TLC expiry delta
  tlc_min_value: "0x...", // Optional TLC minimum value
  tlc_fee_proportional_millionths: "0x...", // Optional TLC fee proportion
  max_tlc_value_in_flight: "0x...", // Optional maximum TLC value in flight
  max_tlc_number_in_flight: "0x...", // Optional maximum TLC number in flight
});
```

Parameters:
- `peer_id`: Peer node ID
- `funding_amount`: Channel funding amount (hexadecimal)
- `public`: Whether the channel is public
- `funding_udt_type_script`: Optional UDT type script
- `shutdown_script`: Optional shutdown script
- `commitment_delay_epoch`: Optional commitment delay epoch
- `commitment_fee_rate`: Optional commitment fee rate
- `funding_fee_rate`: Optional funding fee rate
- `tlc_expiry_delta`: Optional TLC expiry delta
- `tlc_min_value`: Optional TLC minimum value
- `tlc_fee_proportional_millionths`: Optional TLC fee proportion
- `max_tlc_value_in_flight`: Optional maximum TLC value in flight
- `max_tlc_number_in_flight`: Optional maximum TLC number in flight

#### shutdownChannel
Close a channel.

```javascript
await sdk.channel.shutdownChannel({
  channel_id: "channel_id", // Channel ID
  close_script: {
    code_hash: "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
    hash_type: "type",
    args: "0xea076cd91e879a3c189d94068e1584c3fbcc1876",
  },
  fee_rate: "0x3FC", // Fee rate (hexadecimal)
  force: false, // Whether to force close
});
```

Parameters:
- `channel_id`: Channel ID
- `close_script`: Close script
  - `code_hash`: Code hash
  - `hash_type`: Hash type
  - `args`: Arguments
- `fee_rate`: Fee rate (hexadecimal)
- `force`: Whether to force close

### Payment Processing

#### sendPayment
Send a payment.

```javascript
await sdk.payment.sendPayment({
  payment_hash: "payment_hash", // Payment hash
  amount: "0x5f5e100", // Amount (hexadecimal)
  fee_rate: "0x3FC", // Fee rate (hexadecimal)
  custom_records: {}, // Optional custom records
  route: {}, // Optional route information
});
```

Parameters:
- `payment_hash`: Payment hash
- `amount`: Amount (hexadecimal)
- `fee_rate`: Fee rate (hexadecimal)
- `custom_records`: Optional custom records
- `route`: Optional route information

#### getPayment
Query payment status.

```javascript
const payment = await sdk.payment.getPayment("payment_hash");
```

Parameters:
- `payment_hash`: Payment hash

Return Parameters:
- `status`: Payment status
- `payment_hash`: Payment hash
- `created_at`: Creation time (hexadecimal timestamp)
- `last_updated_at`: Last update time (hexadecimal timestamp)
- `failed_error`: Failure reason (if any)
- `fee`: Fee amount (hexadecimal)

### Invoice Management

#### newInvoice
Create a new invoice.

```javascript
const invoice = await sdk.invoice.newInvoice({
  amount: "0x5f5e100", // Amount (hexadecimal)
  description: "test invoice", // Optional description
  expiry: "0xe10", // Optional expiry time (hexadecimal)
  payment_secret: "0x...", // Optional payment secret
});
```

Parameters:
- `amount`: Amount (hexadecimal)
- `description`: Optional description
- `expiry`: Optional expiry time (hexadecimal)
- `payment_secret`: Optional payment secret

#### parseInvoice
Parse an invoice.

```javascript
const parsedInvoice = await sdk.invoice.parseInvoice("invoice_string");
```

Parameters:
- `invoice_string`: Invoice string

Return Parameters:
- Parsed invoice information object

#### getInvoice
Query invoice status.

```javascript
const invoiceInfo = await sdk.invoice.getInvoice("payment_hash");
```

Parameters:
- `payment_hash`: Payment hash

Return Parameters:
- `status`: Invoice status
- `invoice_address`: Invoice address
- `invoice`: Invoice details
  - `payment_hash`: Payment hash
  - `amount`: Amount
  - `description`: Description
  - `expiry`: Expiry time
  - `created_at`: Creation time

#### cancelInvoice
Cancel an invoice.

```javascript
await sdk.invoice.cancelInvoice("payment_hash");
```

Parameters:
- `payment_hash`: Payment hash

### Node Management

#### nodeInfo
Get node information.

```javascript
const nodeInfo = await sdk.nodeInfo();
```

Return Parameters:
- `node_name`: Node name
- `node_id`: Node ID
- `addresses`: Node addresses list
- `chain_hash`: Chain hash
- `auto_accept_min_ckb_funding_amount`: Minimum CKB funding amount for auto-accept
- `udt_cfg_infos`: UDT configuration information
- `timestamp`: Timestamp

#### connectPeer
Connect to a peer node.

```javascript
await sdk.peer.connectPeer("/ip4/127.0.0.1/tcp/8119/p2p/QmbKyzq9qUmymW2Gi8Zq7kKVpPiNA1XUJ6uMvsUC4F3p89");
```

Parameters:
- `address`: Full peer address including peer ID (e.g. "/ip4/127.0.0.1/tcp/8119/p2p/Qm...")

#### disconnectPeer
Disconnect from a peer node.

```