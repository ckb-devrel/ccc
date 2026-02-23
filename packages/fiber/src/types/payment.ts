/**
 * Payment RPC types (camelCase). Enumerated from @nervosnetwork/fiber-js payment.d.ts.
 */
import type { ccc } from "@ckb-ccc/core";
import type { Script } from "./channel.js";

export type PaymentSessionStatus =
  | "Created"
  | "Inflight"
  | "Success"
  | "Failed";

export interface PaymentCustomRecords {
  [key: string]: ccc.Hex;
}

export interface SessionRouteNode {
  pubkey: string;
  amount: ccc.Hex;
  channelOutpoint: ccc.Hex;
}

export interface GetPaymentCommandResult {
  paymentHash: ccc.Hex;
  status: PaymentSessionStatus;
  createdAt: ccc.Hex;
  lastUpdatedAt: ccc.Hex;
  failedError?: string;
  fee: ccc.Hex;
  customRecords?: PaymentCustomRecords;
  router?: SessionRouteNode[];
}

export interface HopHint {
  pubkey: string;
  channelOutpoint: ccc.Hex;
  feeRate: ccc.Hex;
  tlcExpiryDelta: ccc.Hex;
}

export interface HopRequire {
  pubkey: string;
  channelOutpoint: ccc.Hex;
}

export interface RouterHop {
  target: ccc.Hex;
  channelOutpoint: ccc.Hex;
  amountReceived: ccc.Hex;
  incomingTlcExpiry: ccc.Hex;
}

export interface GetPaymentCommandParams {
  paymentHash: ccc.Hex;
}

export interface SendPaymentCommandParams {
  targetPubkey?: string;
  amount?: ccc.Hex;
  paymentHash?: ccc.Hex;
  finalTlcExpiryDelta?: ccc.Hex;
  tlcExpiryLimit?: ccc.Hex;
  invoice?: string;
  timeout?: ccc.Hex;
  maxFeeAmount?: ccc.Hex;
  maxFeeRate?: ccc.Hex;
  maxParts?: ccc.Hex;
  trampolineHops?: string[];
  keysend?: boolean;
  udtTypeScript?: Script;
  allowSelfPayment?: boolean;
  customRecords?: PaymentCustomRecords;
  hopHints?: HopHint[];
  dryRun?: boolean;
}

export interface BuildRouterParams {
  amount?: ccc.Hex;
  udtTypeScript?: Script;
  hopsInfo: HopRequire[];
  finalTlcExpiryDelta?: ccc.Hex;
}

export interface BuildPaymentRouterResult {
  routerHops: RouterHop[];
}

export interface SendPaymentWithRouterParams {
  paymentHash?: ccc.Hex;
  router: RouterHop[];
  invoice?: string;
  customRecords?: PaymentCustomRecords;
  keysend?: boolean;
  udtTypeScript?: Script;
  dryRun?: boolean;
}

export type GetPaymentParams = GetPaymentCommandParams;
export type PaymentResult = GetPaymentCommandResult;
export type SendPaymentParams = SendPaymentCommandParams;
export type BuildRouterResult = BuildPaymentRouterResult;
