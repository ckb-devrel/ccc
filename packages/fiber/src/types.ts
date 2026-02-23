/**
 * Fiber SDK types (camelCase). These are derived from @nervosnetwork/fiber-js
 * and converted from the upstream snake_case declarations.
 */
import { ccc } from "@ckb-ccc/core";
import type * as fiber from "@nervosnetwork/fiber-js";

type CamelCase<S extends string> = S extends `${infer H}_${infer T}`
  ? `${H}${Capitalize<CamelCase<T>>}`
  : S;

/**
 * Recursively camelCase keys. All HexString-like types (ccc.Hex, fiber.HexString,
 * `0x${string}`, etc.) are replaced with ccc.Hex for easier code writing.
 */
type CamelizeDeep<T> = unknown extends T
  ? T
  : T extends ccc.Hex
    ? ccc.Hex
    : T extends fiber.HexString
      ? ccc.Hex
      : T extends `0x${string}`
        ? ccc.Hex
        : T extends string | number | boolean | bigint | null | undefined
          ? T
          : T extends readonly (infer U)[]
            ? CamelizeDeep<U>[]
            : T extends object
              ? {
                  [K in keyof T as K extends string
                    ? CamelCase<K>
                    : K]: CamelizeDeep<T[K]>;
                }
              : T;

export type Pubkey = string;
/** Secp256k1 secret key (RPC type Privkey). */
export type Privkey = string;

export type Currency = fiber.Currency;
export type CkbInvoiceStatus = fiber.CkbInvoiceStatus;
export type PaymentStatus = fiber.PaymentSessionStatus;
export type HashAlgorithm = fiber.HashAlgorithm;

// ─── Channel ─────────────────────────────────────────────────────────────
export type Channel = CamelizeDeep<fiber.Channel>;
export type AbandonChannelParams = CamelizeDeep<fiber.AbandonChannelParams>;
export type AcceptChannelParams = CamelizeDeep<fiber.AcceptChannelParams>;
export type AcceptChannelResult = CamelizeDeep<fiber.AcceptChannelResult>;
export type ListChannelsParams = CamelizeDeep<fiber.ListChannelsParams>;
export type ListChannelsResult = CamelizeDeep<fiber.ListChannelsResult>;
export type OpenChannelParams = CamelizeDeep<fiber.OpenChannelParams>;
export type OpenChannelResult = CamelizeDeep<fiber.OpenChannelResult>;
export type ShutdownChannelParams = CamelizeDeep<fiber.ShutdownChannelParams>;
export type UpdateChannelParams = CamelizeDeep<fiber.UpdateChannelParams>;

// ─── Invoice ─────────────────────────────────────────────────────────────
export type Attribute = CamelizeDeep<fiber.Attribute>;
export type CkbInvoice = CamelizeDeep<fiber.CkbInvoice>;
export type InvoiceData = CamelizeDeep<fiber.InvoiceData>;
export type GetInvoiceResult = CamelizeDeep<fiber.GetInvoiceResult>;
export type InvoiceParams = CamelizeDeep<fiber.InvoiceParams>;
export type InvoiceResult = CamelizeDeep<fiber.InvoiceResult>;
export type NewInvoiceParams = CamelizeDeep<fiber.NewInvoiceParams> & {
  /** Payment hash for hold invoice (preimage must be absent). */
  paymentHash?: ccc.HexLike;
  /** Whether to allow multi-part payment. */
  allowMpp?: boolean;
};
export type NewInvoiceResult = CamelizeDeep<fiber.InvoiceResult>;
export type ParseInvoiceParams = CamelizeDeep<fiber.ParseInvoiceParams>;
export type ParseInvoiceResult = CamelizeDeep<fiber.ParseInvoiceResult>;

// ─── Payment ─────────────────────────────────────────────────────────────
export type PaymentCustomRecords = CamelizeDeep<fiber.PaymentCustomRecords>;
export type SessionRouteNode = CamelizeDeep<fiber.SessionRouteNode>;
export type RouterHop = CamelizeDeep<fiber.RouterHop>;
export type HopRequire = CamelizeDeep<fiber.HopRequire>;
export type HopHint = CamelizeDeep<fiber.HopHint>;
export type BuildRouterParams = CamelizeDeep<fiber.BuildRouterParams>;
export type BuildRouterResult = CamelizeDeep<fiber.BuildPaymentRouterResult>;
export type GetPaymentParams = CamelizeDeep<fiber.GetPaymentCommandParams>;
export type PaymentResult = CamelizeDeep<fiber.GetPaymentCommandResult>;
export type SendPaymentParams = CamelizeDeep<fiber.SendPaymentCommandParams>;
export type SendPaymentWithRouterParams =
  CamelizeDeep<fiber.SendPaymentWithRouterParams>;
