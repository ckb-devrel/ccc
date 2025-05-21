export type Hash256 = string;
export type Pubkey = string;

export interface RPCRequest<T = unknown> {
  jsonrpc: string;
  method: string;
  params: T[];
  id: number;
}

export interface RPCResponse<T = unknown> {
  jsonrpc: string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: number;
}

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

export enum PaymentStatus {
  Pending = "Pending",
  Succeeded = "Succeeded",
  Failed = "Failed",
}

export enum PaymentType {
  Send = "Send",
  Receive = "Receive",
}

export interface Payment {
  payment_hash: string;
  payment_preimage: string;
  amount: bigint;
  fee: bigint;
  status: PaymentStatus;
  type: PaymentType;
  created_at: bigint;
  completed_at?: bigint;
}

export interface PaymentResult {
  payment_hash: string;
  status: PaymentStatus;
  fee: bigint;
}

export interface Peer {
  node_id: Pubkey;
  address: string;
  is_connected: boolean;
  last_connected_at?: bigint;
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
  args: string;
}

export interface Channel {
  channel_id: Hash256;
  peer_id: Pubkey;
  funding_udt_type_script?: Script;
  state: string;
  local_balance: string;
  offered_tlc_balance: string;
  remote_balance: string;
  received_tlc_balance: string;
  latest_commitment_transaction_hash?: Hash256;
  created_at: string;
  last_updated_at: string;
  enabled: boolean;
  tlc_expiry_delta: string;
  tlc_fee_proportional_millionths: string;
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
  timestamp: string;
  chain_hash: Hash256;
  auto_accept_min_ckb_funding_amount: string;
  auto_accept_channel_ckb_funding_amount: string;
  tlc_expiry_delta: string;
  tlc_min_value: string;
  tlc_fee_proportional_millionths: string;
  channel_count: string;
  pending_channel_count: string;
  peers_count: string;
  udt_cfg_infos: Record<string, unknown>;
  default_funding_lock_script?: {
    code_hash: string;
    hash_type: string;
    args: string;
  };
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

export interface CchOrder {
  timestamp: bigint;
  expiry: bigint;
  ckb_final_tlc_expiry_delta: bigint;
  currency: Currency;
  wrapped_btc_type_script?: Script;
  btc_pay_req: string;
  ckb_pay_req: string;
  payment_hash: string;
  amount_sats: bigint;
  fee_sats: bigint;
  status: CchOrderStatus;
}

export enum CchOrderStatus {
  Pending = "Pending",
  Processing = "Processing",
  Completed = "Completed",
  Failed = "Failed",
}

export enum HashAlgorithm {
  CkbHash = "CkbHash",
  Sha256 = "Sha256",
}

export interface HopHint {
  pubkey: Pubkey;
  channel_outpoint: {
    tx_hash: Hash256;
    index: bigint;
  };
  fee_rate: bigint;
  tlc_expiry_delta: bigint;
}
