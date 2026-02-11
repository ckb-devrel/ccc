/**
 * Fiber SDK types (camelCase). Converted to/from snake_case at the RPC boundary.
 * @see https://github.com/nervosnetwork/fiber/blob/v0.6.1/crates/fiber-lib/src/rpc/README.md
 */

export type Hash256 = string;
export type Pubkey = string;
/** Secp256k1 secret key (RPC type Privkey). */
export type Privkey = string;

export interface RPCRequest<T = unknown> {
  jsonrpc: string;
  method: string;
  params: T[];
  id: number;
}

export interface RPCResponse<T = unknown> {
  jsonrpc: string;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
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

export enum PaymentType {
  Send = "Send",
  Receive = "Receive",
}

export interface Payment {
  paymentHash: string;
  paymentPreimage: string;
  amount: bigint;
  fee: bigint;
  status: PaymentStatus;
  type: PaymentType;
  createdAt: bigint;
  completedAt?: bigint;
}

export interface PaymentResult {
  paymentHash: string;
  status: PaymentStatus;
  fee: bigint;
}

export interface Peer {
  nodeId: Pubkey;
  address: string;
  isConnected: boolean;
  lastConnectedAt?: bigint;
}

export enum PaymentStatus {
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
  codeHash: string;
  hashType: string;
  args: string;
}

export interface OutPoint {
  txHash: Hash256;
  index: string | number;
}

export type TlcStatus = { Outbound: unknown } | { Inbound: unknown };

export interface Htlc {
  id: number;
  amount: string | number;
  paymentHash: Hash256;
  expiry: string | number;
  forwardingChannelId?: Hash256;
  forwardingTlcId?: number;
  status: TlcStatus | string;
}

export interface Channel {
  channelId: Hash256;
  isPublic: boolean;
  channelOutpoint?: OutPoint;
  peerId: string;
  fundingUdtTypeScript?: Script;
  state: string;
  localBalance: string;
  offeredTlcBalance: string;
  remoteBalance: string;
  receivedTlcBalance: string;
  pendingTlcs?: Htlc[];
  latestCommitmentTransactionHash?: Hash256;
  createdAt: string;
  lastUpdatedAt?: string;
  enabled: boolean;
  tlcExpiryDelta: string;
  tlcFeeProportionalMillionths: string;
  shutdownTransactionHash?: Hash256;
}

export interface ChannelUpdateInfo {
  timestamp: string | number;
  enabled: boolean;
  outboundLiquidity?: string | number;
  tlcExpiryDelta: string | number;
  tlcMinimumValue: string | number;
  feeRate: string | number;
}

export interface ChannelInfo {
  channelOutpoint: OutPoint;
  node1: Pubkey;
  node2: Pubkey;
  createdTimestamp: string | number;
  updateInfoOfNode1?: ChannelUpdateInfo;
  updateInfoOfNode2?: ChannelUpdateInfo;
  capacity: string | number;
  chainHash: Hash256;
  udtTypeScript?: Script;
}

export interface InvoiceSignature {
  pubkey: Pubkey;
  signature: string;
}

/**
 * Invoice attribute (RPC type Attribute). Enum with values per doc:
 * FinalHtlcTimeout (deprecated), FinalHtlcMinimumExpiryDelta, ExpiryTime,
 * Description, FallbackAddr, UdtScript, PayeePublicKey, HashAlgorithm, Feature, PaymentSecret.
 */
export type Attribute =
  | { FinalHtlcTimeout: string | number }
  | { FinalHtlcMinimumExpiryDelta: string | number }
  | { ExpiryTime: string | number }
  | { Description: string }
  | { FallbackAddr: string }
  | { UdtScript: Script }
  | { PayeePublicKey: Pubkey }
  | { HashAlgorithm: HashAlgorithm }
  | { Feature: string[] }
  | { PaymentSecret: Hash256 };

/** Invoice metadata (RPC type InvoiceData): timestamp, payment_hash, attrs. */
export interface InvoiceData {
  timestamp: string | number;
  paymentHash: Hash256;
  attrs?: Attribute[];
}

/** RPC type CkbInvoice: currency, amount, signature, data (InvoiceData). */
export interface CkbInvoice {
  currency: Currency;
  amount?: string | number;
  signature?: InvoiceSignature;
  data: InvoiceData;
}

/** UDT script (RPC type UdtScript): code_hash, hash_type, args. */
export interface UdtScript {
  codeHash: string;
  hashType: string;
  args: string;
}

/** UDT config (RPC type UdtCfgInfos). Configuration for UDTs. */
export type UdtCfgInfos = UdtArgInfo[];

/** UDT argument info (RPC type UdtArgInfo). */
export interface UdtArgInfo {
  name: string;
  script: UdtScript;
  autoAcceptAmount?: string | number;
  cellDeps?: unknown[];
}

export interface NodeInfo {
  version?: string;
  commitHash?: string;
  nodeId: Pubkey;
  features?: string[];
  nodeName?: string;
  addresses: string[];
  /** Latest timestamp set by the owner for the node announcement. */
  timestamp?: string;
  chainHash: Hash256;
  openChannelAutoAcceptMinCkbFundingAmount?: string;
  autoAcceptMinCkbFundingAmount?: string;
  autoAcceptChannelCkbFundingAmount: string;
  defaultFundingLockScript?: Script;
  tlcExpiryDelta: string;
  tlcMinValue: string;
  tlcFeeProportionalMillionths: string;
  channelCount: string;
  pendingChannelCount: string;
  peersCount: string;
  udtCfgInfos: UdtCfgInfos;
}

export interface PaymentCustomRecords {
  data: Record<string, string>;
}

export interface SessionRouteNode {
  pubkey: Pubkey;
  amount: string | number;
  channelOutpoint: OutPoint;
}

export interface SessionRoute {
  nodes: SessionRouteNode[];
}

export interface RouterHop {
  target: Pubkey;
  channelOutpoint: OutPoint;
  amountReceived: string | number;
  incomingTlcExpiry: string | number;
}

export interface HopRequire {
  pubkey: Pubkey;
  channelOutpoint?: OutPoint;
}

export interface NodeStatus {
  isOnline: boolean;
  lastSyncTime: bigint;
  connectedPeers: number;
  totalChannels: number;
}

export interface NodeVersion {
  version: string;
  commitHash: string;
  buildTime: string;
}

export interface NetworkInfo {
  networkType: "mainnet" | "testnet" | "devnet";
  chainHash: string;
  blockHeight: bigint;
  blockHash: string;
}

export interface CchOrder {
  timestamp: bigint;
  expiry: bigint;
  ckbFinalTlcExpiryDelta: bigint;
  currency: Currency;
  wrappedBtcTypeScript?: Script;
  btcPayReq: string;
  ckbPayReq: string;
  paymentHash: string;
  amountSats: bigint;
  feeSats: bigint;
  status: CchOrderStatus;
}

export enum CchOrderStatus {
  Pending = "Pending",
  IncomingAccepted = "IncomingAccepted",
  OutgoingInFlight = "OutgoingInFlight",
  OutgoingSettled = "OutgoingSettled",
  Succeeded = "Succeeded",
  Failed = "Failed",
}

export enum HashAlgorithm {
  CkbHash = "CkbHash",
  Sha256 = "Sha256",
}

export interface HopHint {
  pubkey: Pubkey;
  channelOutpoint: OutPoint;
  feeRate: string | number;
  tlcExpiryDelta: string | number;
}
