export type Hash256 = string;
export type Pubkey = string;

export interface Channel {
  channel_id: Hash256;
  is_public: boolean;
  channel_outpoint?: any;
  peer_id: string;
  funding_udt_type_script?: any;
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
  channel_outpoint: any;
  node1: Pubkey;
  node2: Pubkey;
  created_timestamp: bigint;
  last_updated_timestamp_of_node1?: bigint;
  last_updated_timestamp_of_node2?: bigint;
  fee_rate_of_node1?: bigint;
  fee_rate_of_node2?: bigint;
  capacity: bigint;
  chain_hash: Hash256;
  udt_type_script?: any;
}

export interface NodeInfo {
  version: string;
  commit_hash: string;
  node_id: Pubkey;
  node_name: string | null;
  addresses: string[];
  chain_hash: Hash256;
  open_channel_auto_accept_min_ckb_funding_amount: bigint;
  auto_accept_channel_ckb_funding_amount: bigint;
  default_funding_lock_script: {
    code_hash: string;
    hash_type: string;
    args: string;
  };
  tlc_expiry_delta: bigint;
  tlc_min_value: bigint;
  tlc_max_value: bigint;
  tlc_fee_proportional_millionths: bigint;
  channel_count: number;
  pending_channel_count: number;
  peers_count: number;
  udt_cfg_infos: any;
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

export interface PaymentSessionStatus {
  status: "Created" | "Inflight" | "Success" | "Failed";
  payment_hash: Hash256;
  created_at: bigint;
  last_updated_at: bigint;
  failed_error?: string;
  fee: bigint;
  custom_records?: any;
  router: any;
}

export interface CkbInvoice {
  currency: "Fibb" | "Fibt" | "Fibd";
  amount?: bigint;
  signature?: any;
  data: any;
}

export interface CkbInvoiceStatus {
  status: "Open" | "Cancelled" | "Expired" | "Received" | "Paid";
  invoice_address: string;
  invoice: CkbInvoice;
}
