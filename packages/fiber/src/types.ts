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

export interface OutPoint {
  tx_hash: Hash256;
  index: string | number;
}

export interface Channel {
  channel_id: Hash256;
  is_public: boolean;
  channel_outpoint?: OutPoint;
  peer_id: string;
  funding_udt_type_script?: Script;
  state: string;
  local_balance: string;
  offered_tlc_balance: string;
  remote_balance: string;
  received_tlc_balance: string;
  latest_commitment_transaction_hash?: Hash256;
  created_at: string;
  last_updated_at?: string;
  enabled: boolean;
  tlc_expiry_delta: string;
  tlc_fee_proportional_millionths: string;
}

export interface ChannelUpdateInfo {
  timestamp: string | number;
  enabled: boolean;
  outbound_liquidity?: string | number;
  tlc_expiry_delta: string | number;
  tlc_minimum_value: string | number;
  fee_rate: string | number;
}

export interface ChannelInfo {
  channel_outpoint: OutPoint;
  node1: Pubkey;
  node2: Pubkey;
  created_timestamp: string | number;
  update_info_of_node1?: ChannelUpdateInfo;
  update_info_of_node2?: ChannelUpdateInfo;
  capacity: string | number;
  chain_hash: Hash256;
  udt_type_script?: Script;
}

export interface InvoiceSignature {
  pubkey: Pubkey;
  signature: string;
}

export interface CkbInvoice {
  currency: Currency;
  amount?: string | number;
  signature?: InvoiceSignature;
  data: {
    timestamp: string | number;
    payment_hash: Hash256;
    attrs?: Array<unknown>;
    expiry?: string | number;
    description?: string;
    description_hash?: string;
    payment_secret?: string;
    features?: string | number;
    route_hints?: HopHint[];
  };
}

export interface NodeInfo {
  version?: string;
  commit_hash?: string;
  node_name: string;
  addresses: string[];
  node_id: Pubkey;
  timestamp: string;
  chain_hash: Hash256;
  open_channel_auto_accept_min_ckb_funding_amount?: string;
  auto_accept_min_ckb_funding_amount?: string;
  auto_accept_channel_ckb_funding_amount: string;
  tlc_expiry_delta: string;
  tlc_min_value: string;
  tlc_fee_proportional_millionths: string;
  channel_count: string;
  pending_channel_count: string;
  peers_count: string;
  udt_cfg_infos: Record<string, unknown>;
  default_funding_lock_script?: Script;
}

export interface PaymentCustomRecords {
  data: Record<string, string>;
}

export interface SessionRouteNode {
  pubkey: Pubkey;
  amount: string | number;
  channel_outpoint: OutPoint;
}

export interface SessionRoute {
  nodes: SessionRouteNode[];
}

export interface RouterHop {
  target: Pubkey;
  channel_outpoint: OutPoint;
  amount_received: string | number;
  incoming_tlc_expiry: string | number;
}

export interface HopRequire {
  pubkey: Pubkey;
  channel_outpoint?: OutPoint;
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
  Accepted = "Accepted",
  InFlight = "InFlight",
  Succeeded = "Succeeded",
  Failed = "Failed",
}

export enum HashAlgorithm {
  CkbHash = "CkbHash",
  Sha256 = "Sha256",
}

export interface HopHint {
  pubkey: Pubkey;
  channel_outpoint: OutPoint;
  fee_rate: string | number;
  tlc_expiry_delta: string | number;
}
