export type Hash256 = string;
export type Pubkey = string;

export enum Currency {
  Fibb = "Fibb",
  Fibt = "Fibt",
  Fibd = "Fibd",
}

export enum CkbInvoiceStatus {
  Open = "Open",
  Cancelled = "Cancelled",
  Expired = "Expired",
  Received = "Received",
  Paid = "Paid",
}

export enum PaymentSessionStatus {
  Created = "Created",
  Inflight = "Inflight",
  Success = "Success",
  Failed = "Failed",
}

export enum RemoveTlcReason {
  RemoveTlcFulfill = "RemoveTlcFulfill",
  RemoveTlcFail = "RemoveTlcFail",
}

export interface Script {
  code_hash: string;
  hash_type: string;
  args: string[];
}

export interface Channel {
  channel_id: Hash256;
  peer_id: Pubkey;
  funding_udt_type_script?: Script;
  state: string;
  local_balance: bigint;
  offered_tlc_balance: bigint;
  remote_balance: bigint;
  received_tlc_balance: bigint;
  latest_commitment_transaction_hash?: Hash256;
  created_at: bigint;
  enabled: boolean;
  tlc_expiry_delta: bigint;
  tlc_fee_proportional_millionths: bigint;
}

export interface ChannelInfo {
  channel_outpoint: {
    tx_hash: Hash256;
    index: bigint;
  };
  node1: Pubkey;
  node2: Pubkey;
  created_timestamp: bigint;
  last_updated_timestamp_of_node1?: bigint;
  last_updated_timestamp_of_node2?: bigint;
  fee_rate_of_node1?: bigint;
  fee_rate_of_node2?: bigint;
  capacity: bigint;
  chain_hash: Hash256;
  udt_type_script?: Script;
}

export interface CkbInvoice {
  currency: Currency;
  amount?: bigint;
  signature?: {
    pubkey: Pubkey;
    signature: string;
  };
  data: {
    payment_hash: string;
    timestamp: bigint;
    expiry?: bigint;
    description?: string;
    description_hash?: string;
    payment_secret?: string;
    features?: bigint;
    route_hints?: Array<{
      pubkey: Pubkey;
      channel_outpoint: {
        tx_hash: Hash256;
        index: bigint;
      };
      fee_rate: bigint;
      tlc_expiry_delta: bigint;
    }>;
  };
}

export interface NodeInfo {
  node_name: string;
  addresses: string[];
  node_id: Pubkey;
  timestamp: bigint;
  chain_hash: Hash256;
  auto_accept_min_ckb_funding_amount: bigint;
  udt_cfg_infos: Record<string, unknown>;
}

export interface PaymentCustomRecords {
  data: Record<string, string>;
}

export interface SessionRoute {
  nodes: Array<{
    pubkey: Pubkey;
    amount: bigint;
    channel_outpoint?: {
      tx_hash: Hash256;
      index: bigint;
    };
  }>;
}

export interface NodeStatus {
  is_online: boolean;
  last_sync_time: bigint;
  connected_peers: number;
  total_channels: number;
}

export interface NodeVersion {
  version: string;
  commit_hash: string;
  build_time: string;
}

export interface NetworkInfo {
  network_type: "mainnet" | "testnet" | "devnet";
  chain_hash: string;
  block_height: bigint;
  block_hash: string;
}
