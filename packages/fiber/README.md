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
});
```

Parameters:
- `peer_id`: Peer node ID
- `funding_amount`: Channel funding amount (hexadecimal)
- `public`: Whether the channel is public

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
  invoice: "fibt1000000001pcsaug0p0exgfw0pnm6vk0rnt4xefskmrz0k2vqxr4lnrms60qasvc54jagg2hk8v40k88exmp04pn5cpcnrcsw5lk9w0w6l0m3k84e2ax4v6gq9ne2n77u4p8h3npx6tuufqftq8eyqxw9t4upaw4f89xukcee79rm0p0jv92d5ckq7pmvm09ma3psheu3rfyy9atlrdr4el6ys8yqurl2m74msuykljp35j0s47vpw8h3crfp5ldp8kp4xlusqk6rad3ssgwn2a429qlpgfgjrtj3gzy26w50cy7gypgjm6mjgaz2ff5q4am0avf6paxja2gh2wppjagqlg466yzty0r0pfz8qpuzqgq43mkgx", // Invoice string
});
```

Parameters:
- `invoice`: Invoice string

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
  currency: "Fibt", // Currency type
  description: "test invoice", // Description
  expiry: "0xe10", // Expiry time (hexadecimal)
  final_cltv: "0x28", // Final CLTV value (hexadecimal)
  payment_preimage: "0x...", // Payment preimage
  hash_algorithm: "sha256", // Hash algorithm
});
```

Parameters:
- `amount`: Amount (hexadecimal)
- `currency`: Currency type
- `description`: Description
- `expiry`: Expiry time (hexadecimal)
- `final_cltv`: Final CLTV value (hexadecimal)
- `payment_preimage`: Payment preimage
- `hash_algorithm`: Hash algorithm

Return Parameters:
- `payment_hash`: Payment hash
- `amount`: Amount
- `description`: Description
- `expiry`: Expiry time
- `created_at`: Creation time

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
await sdk.peer.connectPeer({
  peer_id: "QmbKyzq9qUmymW2Gi8Zq7kKVpPiNA1XUJ6uMvsUC4F3p89", // Node ID
  address: "/ip4/127.0.0.1/tcp/8119", // Node address
});
```

Parameters:
- `peer_id`: Node ID
- `address`: Node address

#### disconnectPeer
Disconnect from a peer node.

```javascript
await sdk.peer.disconnectPeer("peer_id");
```

Parameters:
- `peer_id`: Node ID

## Error Handling

The SDK provides a unified error handling mechanism. When an error occurs, it returns an object containing error information:

```javascript
try {
  await sdk.channel.listChannels();
} catch (error) {
  if (error.error) {
    // RPC error
    console.error("RPC Error:", error.error);
  } else {
    // Other errors
    console.error("Error:", error.message);
  }
}
```

## Testing

The project includes multiple test files for testing various functional modules:

- `test/channel.cjs` - Channel management tests
- `test/payment.cjs` - Payment processing tests
- `test/invoice.cjs` - Invoice management tests
- `test/peer.cjs` - Node connection tests
- `test/info.cjs` - Node information tests

Run tests:

```bash
node test/channel.cjs
node test/payment.cjs
node test/invoice.cjs
node test/peer.cjs
node test/info.cjs
```

## Notes

1. Ensure the Fiber node is started and running properly before use
2. Make sure the RPC address is configured correctly
3. All amount parameters must be in hexadecimal format (starting with "0x")
4. It is recommended to use appropriate error handling in production environments

## Contributing

Issues and Pull Requests are welcome to help improve the project.

## License

[MIT](LICENSE)
