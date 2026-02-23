/**
 * Channel RPC types (camelCase). Enumerated from @nervosnetwork/fiber-js channel.d.ts.
 * Params are standalone classes with static from(like) for CCC-style flexible inputs.
 * Amounts (e.g. fundingAmount) are NumLike; caller is responsible for fixed8 (8 decimals).
 */
import { ccc } from "@ckb-ccc/core";

// ─── OpenChannel ───────────────────────────────────────────────────────────

export type OpenChannelParamsLike = {
  peerId: string;
  /** Amount in fixed8 (caller must scale by 10^8 if using human units). */
  fundingAmount: ccc.NumLike;
  public?: boolean;
  fundingUdtTypeScript?: ccc.ScriptLike;
  shutdownScript?: ccc.ScriptLike;
  commitmentDelayEpoch?: ccc.NumLike;
  commitmentFeeRate?: ccc.NumLike;
  fundingFeeRate?: ccc.NumLike;
  tlcExpiryDelta?: ccc.NumLike;
  tlcMinValue?: ccc.NumLike;
  tlcFeeProportionalMillionths?: ccc.NumLike;
  maxTlcValueInFlight?: ccc.NumLike;
  maxTlcNumberInFlight?: ccc.NumLike;
};

export class OpenChannelParams {
  constructor(
    public readonly peerId: string,
    public readonly fundingAmount: ccc.Hex,
    isPublic?: boolean,
    public readonly fundingUdtTypeScript?: ccc.Script,
    public readonly shutdownScript?: ccc.Script,
    public readonly commitmentDelayEpoch?: ccc.Hex,
    public readonly commitmentFeeRate?: ccc.Hex,
    public readonly fundingFeeRate?: ccc.Hex,
    public readonly tlcExpiryDelta?: ccc.Hex,
    public readonly tlcMinValue?: ccc.Hex,
    public readonly tlcFeeProportionalMillionths?: ccc.Hex,
    public readonly maxTlcValueInFlight?: ccc.Hex,
    public readonly maxTlcNumberInFlight?: ccc.Hex,
  ) {
    this._isPublic = isPublic;
  }

  private readonly _isPublic?: boolean;
  get public(): boolean | undefined {
    return this._isPublic;
  }

  static from(like: OpenChannelParamsLike): OpenChannelParams {
    return new OpenChannelParams(
      like.peerId,
      ccc.numToHex(like.fundingAmount),
      like.public,
      like.fundingUdtTypeScript != null
        ? ccc.Script.from(like.fundingUdtTypeScript)
        : undefined,
      like.shutdownScript != null
        ? ccc.Script.from(like.shutdownScript)
        : undefined,
      like.commitmentDelayEpoch != null
        ? ccc.numToHex(like.commitmentDelayEpoch)
        : undefined,
      like.commitmentFeeRate != null
        ? ccc.numToHex(like.commitmentFeeRate)
        : undefined,
      like.fundingFeeRate != null
        ? ccc.numToHex(like.fundingFeeRate)
        : undefined,
      like.tlcExpiryDelta != null
        ? ccc.numToHex(like.tlcExpiryDelta)
        : undefined,
      like.tlcMinValue != null ? ccc.numToHex(like.tlcMinValue) : undefined,
      like.tlcFeeProportionalMillionths != null
        ? ccc.numToHex(like.tlcFeeProportionalMillionths)
        : undefined,
      like.maxTlcValueInFlight != null
        ? ccc.numToHex(like.maxTlcValueInFlight)
        : undefined,
      like.maxTlcNumberInFlight != null
        ? ccc.numToHex(like.maxTlcNumberInFlight)
        : undefined,
    );
  }
}

export type OpenChannelResult = {
  temporaryChannelId: ccc.Hex;
};

// ─── AbandonChannel ───────────────────────────────────────────────────────

export type AbandonChannelParamsLike = {
  channelId: ccc.HexLike;
};

export class AbandonChannelParams {
  constructor(public readonly channelId: ccc.Hex) {}

  static from(like: AbandonChannelParamsLike): AbandonChannelParams {
    return new AbandonChannelParams(ccc.hexFrom(like.channelId));
  }
}

// ─── AcceptChannel ──────────────────────────────────────────────────────────

export type AcceptChannelParamsLike = {
  temporaryChannelId: ccc.HexLike;
  /** Amount in fixed8 (caller must scale by 10^8 if using human units). */
  fundingAmount: ccc.NumLike;
  shutdownScript?: ccc.ScriptLike;
  maxTlcValueInFlight?: ccc.NumLike;
  maxTlcNumberInFlight?: ccc.NumLike;
  tlcMinValue?: ccc.NumLike;
  tlcFeeProportionalMillionths?: ccc.NumLike;
  tlcExpiryDelta?: ccc.NumLike;
};

export class AcceptChannelParams {
  constructor(
    public readonly temporaryChannelId: ccc.Hex,
    public readonly fundingAmount: ccc.Hex,
    public readonly shutdownScript?: ccc.Script,
    public readonly maxTlcValueInFlight?: ccc.Hex,
    public readonly maxTlcNumberInFlight?: ccc.Hex,
    public readonly tlcMinValue?: ccc.Hex,
    public readonly tlcFeeProportionalMillionths?: ccc.Hex,
    public readonly tlcExpiryDelta?: ccc.Hex,
  ) {}

  static from(like: AcceptChannelParamsLike): AcceptChannelParams {
    return new AcceptChannelParams(
      ccc.hexFrom(like.temporaryChannelId),
      ccc.numToHex(like.fundingAmount),
      like.shutdownScript != null
        ? ccc.Script.from(like.shutdownScript)
        : undefined,
      like.maxTlcValueInFlight != null
        ? ccc.numToHex(like.maxTlcValueInFlight)
        : undefined,
      like.maxTlcNumberInFlight != null
        ? ccc.numToHex(like.maxTlcNumberInFlight)
        : undefined,
      like.tlcMinValue != null ? ccc.numToHex(like.tlcMinValue) : undefined,
      like.tlcFeeProportionalMillionths != null
        ? ccc.numToHex(like.tlcFeeProportionalMillionths)
        : undefined,
      like.tlcExpiryDelta != null
        ? ccc.numToHex(like.tlcExpiryDelta)
        : undefined,
    );
  }
}

export type AcceptChannelResult = {
  channelId: ccc.Hex;
};

// ─── ListChannels ──────────────────────────────────────────────────────────

export type ListChannelsParamsLike = {
  peerId?: string;
  includeClosed?: boolean;
};

export class ListChannelsParams {
  constructor(
    public readonly peerId?: string,
    public readonly includeClosed?: boolean,
  ) {}

  static from(like: ListChannelsParamsLike): ListChannelsParams {
    return new ListChannelsParams(like.peerId, like.includeClosed);
  }
}

// ─── Channel (result type) ──────────────────────────────────────────────────

export type ChannelState = {
  stateName: string;
  stateFlags: string;
};

export type Channel = {
  channelId: ccc.Hex;
  isPublic: boolean;
  channelOutpoint: ccc.Hex;
  peerId: ccc.Hex;
  fundingUdtTypeScript?: ccc.Script;
  state: ChannelState;
  localBalance: ccc.Hex;
  offeredTlcBalance: ccc.Hex;
  remoteBalance: ccc.Hex;
  receivedTlcBalance: ccc.Hex;
  latestCommitmentTransactionHash?: ccc.Hex;
  createdAt: ccc.Hex;
  enabled: boolean;
  tlcExpiryDelta: ccc.Hex;
  tlcFeeProportionalMillionths: ccc.Hex;
  shutdownTransactionHash?: ccc.Hex;
};

export type ListChannelsResult = {
  channels: Channel[];
};

// ─── ShutdownChannel ──────────────────────────────────────────────────────

export type ShutdownChannelParamsLike = {
  channelId: ccc.HexLike;
  closeScript?: ccc.ScriptLike;
  feeRate?: ccc.NumLike;
  force?: boolean;
};

export class ShutdownChannelParams {
  constructor(
    public readonly channelId: ccc.Hex,
    public readonly closeScript?: ccc.Script,
    public readonly feeRate?: ccc.Hex,
    public readonly force?: boolean,
  ) {}

  static from(like: ShutdownChannelParamsLike): ShutdownChannelParams {
    return new ShutdownChannelParams(
      ccc.hexFrom(like.channelId),
      like.closeScript != null ? ccc.Script.from(like.closeScript) : undefined,
      like.feeRate != null ? ccc.numToHex(like.feeRate) : undefined,
      like.force,
    );
  }
}

// ─── UpdateChannel ─────────────────────────────────────────────────────────

export type UpdateChannelParamsLike = {
  channelId: ccc.HexLike;
  enabled?: boolean;
  tlcExpiryDelta?: ccc.NumLike;
  tlcMinimumValue?: ccc.NumLike;
  tlcFeeProportionalMillionths?: ccc.NumLike;
};

export class UpdateChannelParams {
  constructor(
    public readonly channelId: ccc.Hex,
    public readonly enabled?: boolean,
    public readonly tlcExpiryDelta?: ccc.Hex,
    public readonly tlcMinimumValue?: ccc.Hex,
    public readonly tlcFeeProportionalMillionths?: ccc.Hex,
  ) {}

  static from(like: UpdateChannelParamsLike): UpdateChannelParams {
    return new UpdateChannelParams(
      ccc.hexFrom(like.channelId),
      like.enabled,
      like.tlcExpiryDelta != null
        ? ccc.numToHex(like.tlcExpiryDelta)
        : undefined,
      like.tlcMinimumValue != null
        ? ccc.numToHex(like.tlcMinimumValue)
        : undefined,
      like.tlcFeeProportionalMillionths != null
        ? ccc.numToHex(like.tlcFeeProportionalMillionths)
        : undefined,
    );
  }
}
