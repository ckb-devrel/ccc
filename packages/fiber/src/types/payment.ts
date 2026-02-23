/**
 * Payment RPC types (camelCase). Enumerated from @nervosnetwork/fiber-js payment.d.ts.
 * Params and nested types are standalone classes with static from(like).
 */
import { ccc } from "@ckb-ccc/core";

export type PaymentSessionStatus =
  | "Created"
  | "Inflight"
  | "Success"
  | "Failed";

/** Like-suffixed for param input; values normalized in PaymentCustomRecords.from(). */
export type PaymentCustomRecordsLike = {
  [key: string]: ccc.HexLike;
};

/** Normalized custom records (class); build from Like via PaymentCustomRecords.from(like). */
export class PaymentCustomRecords {
  constructor(public readonly record: Record<string, ccc.Hex>) {}

  static from(like: PaymentCustomRecordsLike): PaymentCustomRecords {
    const out: Record<string, ccc.Hex> = {};
    for (const key of Object.keys(like)) {
      out[key] = ccc.hexFrom(like[key]);
    }
    return new PaymentCustomRecords(out);
  }
}

export type SessionRouteNodeLike = {
  pubkey: string;
  amount: ccc.NumLike;
  channelOutpoint: ccc.HexLike;
};

export type SessionRouteNode = {
  pubkey: string;
  amount: ccc.Hex;
  channelOutpoint: ccc.Hex;
};

/** Plain shape for RPC result (server returns object, not class instance). */
export type PaymentCustomRecordsPlain = Record<string, ccc.Hex>;

export type GetPaymentCommandResult = {
  paymentHash: ccc.Hex;
  status: PaymentSessionStatus;
  createdAt: ccc.Hex;
  lastUpdatedAt: ccc.Hex;
  failedError?: string;
  fee: ccc.Hex;
  customRecords?: PaymentCustomRecordsPlain;
  router?: SessionRouteNode[];
};

// ─── HopRequire ─────────────────────────────────────────────────────────────

export type HopRequireLike = {
  pubkey: string;
  channelOutpoint: ccc.HexLike;
};

export class HopRequire {
  constructor(
    public readonly pubkey: string,
    public readonly channelOutpoint: ccc.Hex,
  ) {}

  static from(like: HopRequireLike): HopRequire {
    return new HopRequire(like.pubkey, ccc.hexFrom(like.channelOutpoint));
  }
}

// ─── HopHint ───────────────────────────────────────────────────────────────

export type HopHintLike = {
  pubkey: string;
  channelOutpoint: ccc.HexLike;
  feeRate: ccc.NumLike;
  tlcExpiryDelta: ccc.NumLike;
};

export class HopHint {
  constructor(
    public readonly pubkey: string,
    public readonly channelOutpoint: ccc.Hex,
    public readonly feeRate: ccc.Hex,
    public readonly tlcExpiryDelta: ccc.Hex,
  ) {}

  static from(like: HopHintLike): HopHint {
    return new HopHint(
      like.pubkey,
      ccc.hexFrom(like.channelOutpoint),
      ccc.numToHex(like.feeRate),
      ccc.numToHex(like.tlcExpiryDelta),
    );
  }
}

// ─── RouterHop ──────────────────────────────────────────────────────────────

export type RouterHopLike = {
  target: ccc.HexLike;
  channelOutpoint: ccc.HexLike;
  amountReceived: ccc.NumLike;
  incomingTlcExpiry: ccc.NumLike;
};

export class RouterHop {
  constructor(
    public readonly target: ccc.Hex,
    public readonly channelOutpoint: ccc.Hex,
    public readonly amountReceived: ccc.Hex,
    public readonly incomingTlcExpiry: ccc.Hex,
  ) {}

  static from(like: RouterHopLike): RouterHop {
    return new RouterHop(
      ccc.hexFrom(like.target),
      ccc.hexFrom(like.channelOutpoint),
      ccc.numToHex(like.amountReceived),
      ccc.numToHex(like.incomingTlcExpiry),
    );
  }
}

// ─── GetPayment ────────────────────────────────────────────────────────────

export type GetPaymentCommandParamsLike = {
  paymentHash: ccc.HexLike;
};

export class GetPaymentCommandParams {
  constructor(public readonly paymentHash: ccc.Hex) {}

  static from(like: GetPaymentCommandParamsLike): GetPaymentCommandParams {
    return new GetPaymentCommandParams(ccc.hexFrom(like.paymentHash));
  }
}

// ─── SendPayment ───────────────────────────────────────────────────────────

export type SendPaymentCommandParamsLike = {
  targetPubkey?: string;
  amount?: ccc.NumLike;
  paymentHash?: ccc.HexLike;
  finalTlcExpiryDelta?: ccc.NumLike;
  tlcExpiryLimit?: ccc.NumLike;
  invoice?: string;
  timeout?: ccc.NumLike;
  maxFeeAmount?: ccc.NumLike;
  maxFeeRate?: ccc.NumLike;
  maxParts?: ccc.NumLike;
  trampolineHops?: string[];
  keysend?: boolean;
  udtTypeScript?: ccc.ScriptLike;
  allowSelfPayment?: boolean;
  customRecords?: PaymentCustomRecordsLike;
  hopHints?: HopHintLike[];
  dryRun?: boolean;
};

export class SendPaymentCommandParams {
  constructor(
    public readonly targetPubkey?: string,
    public readonly amount?: ccc.Hex,
    public readonly paymentHash?: ccc.Hex,
    public readonly finalTlcExpiryDelta?: ccc.Hex,
    public readonly tlcExpiryLimit?: ccc.Hex,
    public readonly invoice?: string,
    public readonly timeout?: ccc.Hex,
    public readonly maxFeeAmount?: ccc.Hex,
    public readonly maxFeeRate?: ccc.Hex,
    public readonly maxParts?: ccc.Hex,
    public readonly trampolineHops?: string[],
    public readonly keysend?: boolean,
    public readonly udtTypeScript?: ccc.Script,
    public readonly allowSelfPayment?: boolean,
    public readonly customRecords?: PaymentCustomRecords,
    public readonly hopHints?: HopHint[],
    public readonly dryRun?: boolean,
  ) {}

  static from(like: SendPaymentCommandParamsLike): SendPaymentCommandParams {
    return new SendPaymentCommandParams(
      like.targetPubkey,
      like.amount != null ? ccc.numToHex(like.amount) : undefined,
      like.paymentHash ? ccc.hexFrom(like.paymentHash) : undefined,
      like.finalTlcExpiryDelta != null
        ? ccc.numToHex(like.finalTlcExpiryDelta)
        : undefined,
      like.tlcExpiryLimit != null
        ? ccc.numToHex(like.tlcExpiryLimit)
        : undefined,
      like.invoice,
      like.timeout != null ? ccc.numToHex(like.timeout) : undefined,
      like.maxFeeAmount != null ? ccc.numToHex(like.maxFeeAmount) : undefined,
      like.maxFeeRate != null ? ccc.numToHex(like.maxFeeRate) : undefined,
      like.maxParts != null ? ccc.numToHex(like.maxParts) : undefined,
      like.trampolineHops,
      like.keysend,
      like.udtTypeScript != null
        ? ccc.Script.from(like.udtTypeScript)
        : undefined,
      like.allowSelfPayment,
      like.customRecords != null
        ? PaymentCustomRecords.from(like.customRecords)
        : undefined,
      like.hopHints?.map((h) => HopHint.from(h)),
      like.dryRun,
    );
  }
}

// ─── BuildRouter ───────────────────────────────────────────────────────────

export type BuildRouterParamsLike = {
  amount?: ccc.NumLike;
  udtTypeScript?: ccc.ScriptLike;
  hopsInfo: HopRequireLike[];
  finalTlcExpiryDelta?: ccc.NumLike;
};

export class BuildRouterParams {
  constructor(
    public readonly hopsInfo: HopRequire[],
    public readonly amount?: ccc.Hex,
    public readonly udtTypeScript?: ccc.Script,
    public readonly finalTlcExpiryDelta?: ccc.Hex,
  ) {}

  static from(like: BuildRouterParamsLike): BuildRouterParams {
    return new BuildRouterParams(
      like.hopsInfo.map((h) => HopRequire.from(h)),
      like.amount != null ? ccc.numToHex(like.amount) : undefined,
      like.udtTypeScript != null
        ? ccc.Script.from(like.udtTypeScript)
        : undefined,
      like.finalTlcExpiryDelta != null
        ? ccc.numToHex(like.finalTlcExpiryDelta)
        : undefined,
    );
  }
}

export type BuildPaymentRouterResult = {
  routerHops: RouterHop[];
};

// ─── SendPaymentWithRouter ────────────────────────────────────────────────

export type SendPaymentWithRouterParamsLike = {
  paymentHash?: ccc.HexLike;
  router: RouterHopLike[];
  invoice?: string;
  customRecords?: PaymentCustomRecordsLike;
  keysend?: boolean;
  udtTypeScript?: ccc.ScriptLike;
  dryRun?: boolean;
};

export class SendPaymentWithRouterParams {
  constructor(
    public readonly router: RouterHop[],
    public readonly paymentHash?: ccc.Hex,
    public readonly invoice?: string,
    public readonly customRecords?: PaymentCustomRecords,
    public readonly keysend?: boolean,
    public readonly udtTypeScript?: ccc.Script,
    public readonly dryRun?: boolean,
  ) {}

  static from(
    like: SendPaymentWithRouterParamsLike,
  ): SendPaymentWithRouterParams {
    return new SendPaymentWithRouterParams(
      like.router.map((r) => RouterHop.from(r)),
      like.paymentHash ? ccc.hexFrom(like.paymentHash) : undefined,
      like.invoice,
      like.customRecords != null
        ? PaymentCustomRecords.from(like.customRecords)
        : undefined,
      like.keysend,
      like.udtTypeScript != null
        ? ccc.Script.from(like.udtTypeScript)
        : undefined,
      like.dryRun,
    );
  }
}

// ─── Aliases ───────────────────────────────────────────────────────────────

export type GetPaymentParamsLike = GetPaymentCommandParamsLike;
export type GetPaymentParams = GetPaymentCommandParams;
export type PaymentResult = GetPaymentCommandResult;
export type SendPaymentParamsLike = SendPaymentCommandParamsLike;
export type SendPaymentParams = SendPaymentCommandParams;
export type BuildRouterResult = BuildPaymentRouterResult;
