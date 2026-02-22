/**
 * Fiber SDK types (camelCase). These are derived from @nervosnetwork/fiber-js
 * and converted from the upstream snake_case declarations.
 */
import type * as fiber from "@nervosnetwork/fiber-js";

type CamelCase<S extends string> = S extends `${infer H}_${infer T}`
  ? `${H}${Capitalize<CamelCase<T>>}`
  : S;
type CamelizeDeep<T> = T extends readonly (infer U)[]
  ? CamelizeDeep<U>[]
  : T extends object
    ? {
        [K in keyof T as K extends string ? CamelCase<K> : K]: CamelizeDeep<
          T[K]
        >;
      }
    : T;

export type Hash256 = string;
export type Pubkey = string;
/** Secp256k1 secret key (RPC type Privkey). */
export type Privkey = string;

export type Currency = fiber.Currency;
export type CkbInvoiceStatus = fiber.CkbInvoiceStatus;
export type PaymentStatus = fiber.PaymentSessionStatus;
export type HashAlgorithm = fiber.HashAlgorithm;

export interface Script {
  codeHash: string;
  hashType: string;
  args: string;
}
export interface OutPoint {
  txHash: Hash256;
  index: string | number;
}
export type Channel = CamelizeDeep<fiber.Channel>;
export type ChannelUpdateInfo = CamelizeDeep<fiber.ChannelUpdateInfo>;
export type ChannelInfo = CamelizeDeep<fiber.ChannelInfo>;
export type Attribute = CamelizeDeep<fiber.Attribute>;
export type InvoiceData = CamelizeDeep<fiber.InvoiceData>;
export type CkbInvoice = CamelizeDeep<fiber.CkbInvoice>;
export type UdtScript = CamelizeDeep<fiber.UdtScript>;
export type UdtArgInfo = CamelizeDeep<fiber.UdtArgInfo>;
export type UdtCfgInfos = CamelizeDeep<fiber.UdtCfgInfos>;
export interface NodeInfo {
  version: string;
  commitHash: string;
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
export type GraphNodeInfo = CamelizeDeep<fiber.NodeInfo>;
export type PaymentCustomRecords = CamelizeDeep<fiber.PaymentCustomRecords>;
export type SessionRouteNode = CamelizeDeep<fiber.SessionRouteNode>;
export type RouterHop = CamelizeDeep<fiber.RouterHop>;
export type HopRequire = CamelizeDeep<fiber.HopRequire>;
export type HopHint = CamelizeDeep<fiber.HopHint>;
export type SendPaymentParams = CamelizeDeep<fiber.SendPaymentCommandParams>;
export type SendPaymentWithRouterParams =
  CamelizeDeep<fiber.SendPaymentWithRouterParams>;
export type PaymentResult = CamelizeDeep<fiber.GetPaymentCommandResult>;
export type BuildRouterResult = CamelizeDeep<fiber.BuildPaymentRouterResult>;

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
