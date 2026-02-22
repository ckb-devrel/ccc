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
export type OpenChannelParams = CamelizeDeep<fiber.OpenChannelParams>;
export type OpenChannelResult = CamelizeDeep<fiber.OpenChannelResult>;
export type AbandonChannelParams = CamelizeDeep<fiber.AbandonChannelParams>;
export type AcceptChannelParams = CamelizeDeep<fiber.AcceptChannelParams>;
export type AcceptChannelResult = CamelizeDeep<fiber.AcceptChannelResult>;
export type ListChannelsParams = CamelizeDeep<fiber.ListChannelsParams>;
export type ListChannelsResult = CamelizeDeep<fiber.ListChannelsResult>;
export type ShutdownChannelParams = CamelizeDeep<fiber.ShutdownChannelParams>;
export type UpdateChannelParams = CamelizeDeep<fiber.UpdateChannelParams>;
export type Attribute = CamelizeDeep<fiber.Attribute>;
export type InvoiceData = CamelizeDeep<fiber.InvoiceData>;
export type CkbInvoice = CamelizeDeep<fiber.CkbInvoice>;
export type NewInvoiceParams = CamelizeDeep<fiber.NewInvoiceParams> & {
  /** Payment hash for hold invoice (preimage must be absent). */
  paymentHash?: Hash256;
  /** Whether to allow multi-part payment. */
  allowMpp?: boolean;
};
export type NewInvoiceResult = CamelizeDeep<fiber.InvoiceResult>;
export type GetInvoiceResult = CamelizeDeep<fiber.GetInvoiceResult>;
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
