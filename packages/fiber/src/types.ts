/**
 * Fiber SDK types (camelCase). Converted to/from snake_case at the RPC boundary.
 * @see https://github.com/nervosnetwork/fiber/blob/main/src/rpc/README.md
 */

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
  codeHash: string;
  hashType: string;
  args: string;
}

export interface OutPoint {
  txHash: Hash256;
  index: string | number;
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
  latestCommitmentTransactionHash?: Hash256;
  createdAt: string;
  lastUpdatedAt?: string;
  enabled: boolean;
  tlcExpiryDelta: string;
  tlcFeeProportionalMillionths: string;
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

export interface CkbInvoice {
  currency: Currency;
  amount?: string | number;
  signature?: InvoiceSignature;
  data: {
    timestamp: string | number;
    paymentHash: Hash256;
    attrs?: Array<unknown>;
    expiry?: string | number;
    description?: string;
    descriptionHash?: string;
    paymentSecret?: string;
    features?: string | number;
    routeHints?: HopHint[];
  };
}

export interface NodeInfo {
  version?: string;
  commitHash?: string;
  nodeName: string;
  addresses: string[];
  nodeId: Pubkey;
  timestamp: string;
  chainHash: Hash256;
  openChannelAutoAcceptMinCkbFundingAmount?: string;
  autoAcceptMinCkbFundingAmount?: string;
  autoAcceptChannelCkbFundingAmount: string;
  tlcExpiryDelta: string;
  tlcMinValue: string;
  tlcFeeProportionalMillionths: string;
  channelCount: string;
  pendingChannelCount: string;
  peersCount: string;
  udtCfgInfos: Record<string, unknown>;
  defaultFundingLockScript?: Script;
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
  channelOutpoint: OutPoint;
  feeRate: string | number;
  tlcExpiryDelta: string | number;
}
