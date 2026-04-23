import { ccc } from "@ckb-ccc/core";
import { toHex } from "../utils.js";

// ─── OpenChannel ───────────────────────────────────────────────────────────

export type OpenChannelParamsLike = {
  pubkey: string;
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
  public readonly pubkey: string;
  public readonly fundingAmount: ccc.Hex;
  public readonly "public"?: boolean;
  public readonly fundingUdtTypeScript?: ccc.Script;
  public readonly shutdownScript?: ccc.Script;
  public readonly commitmentDelayEpoch?: ccc.Hex;
  public readonly commitmentFeeRate?: ccc.Hex;
  public readonly fundingFeeRate?: ccc.Hex;
  public readonly tlcExpiryDelta?: ccc.Hex;
  public readonly tlcMinValue?: ccc.Hex;
  public readonly tlcFeeProportionalMillionths?: ccc.Hex;
  public readonly maxTlcValueInFlight?: ccc.Hex;
  public readonly maxTlcNumberInFlight?: ccc.Hex;

  constructor(
    pubkey: string,
    fundingAmount: ccc.Hex,
    isPublic?: boolean,
    fundingUdtTypeScript?: ccc.Script,
    shutdownScript?: ccc.Script,
    commitmentDelayEpoch?: ccc.Hex,
    commitmentFeeRate?: ccc.Hex,
    fundingFeeRate?: ccc.Hex,
    tlcExpiryDelta?: ccc.Hex,
    tlcMinValue?: ccc.Hex,
    tlcFeeProportionalMillionths?: ccc.Hex,
    maxTlcValueInFlight?: ccc.Hex,
    maxTlcNumberInFlight?: ccc.Hex,
  ) {
    this.pubkey = pubkey;
    this.fundingAmount = fundingAmount;
    this["public"] = isPublic;
    this.fundingUdtTypeScript = fundingUdtTypeScript;
    this.shutdownScript = shutdownScript;
    this.commitmentDelayEpoch = commitmentDelayEpoch;
    this.commitmentFeeRate = commitmentFeeRate;
    this.fundingFeeRate = fundingFeeRate;
    this.tlcExpiryDelta = tlcExpiryDelta;
    this.tlcMinValue = tlcMinValue;
    this.tlcFeeProportionalMillionths = tlcFeeProportionalMillionths;
    this.maxTlcValueInFlight = maxTlcValueInFlight;
    this.maxTlcNumberInFlight = maxTlcNumberInFlight;
  }

  static from(like: OpenChannelParamsLike): OpenChannelParams {
    return new OpenChannelParams(
      like.pubkey,
      ccc.numToHex(like.fundingAmount),
      like.public,
      like.fundingUdtTypeScript
        ? ccc.Script.from(like.fundingUdtTypeScript)
        : undefined,
      like.shutdownScript ? ccc.Script.from(like.shutdownScript) : undefined,
      toHex(like.commitmentDelayEpoch),
      toHex(like.commitmentFeeRate),
      toHex(like.fundingFeeRate),
      toHex(like.tlcExpiryDelta),
      toHex(like.tlcMinValue),
      toHex(like.tlcFeeProportionalMillionths),
      toHex(like.maxTlcValueInFlight),
      toHex(like.maxTlcNumberInFlight),
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
      like.shutdownScript ? ccc.Script.from(like.shutdownScript) : undefined,
      toHex(like.maxTlcValueInFlight),
      toHex(like.maxTlcNumberInFlight),
      toHex(like.tlcMinValue),
      toHex(like.tlcFeeProportionalMillionths),
      toHex(like.tlcExpiryDelta),
    );
  }
}

export type AcceptChannelResult = {
  channelId: ccc.Hex;
};

// ─── ListChannels ──────────────────────────────────────────────────────────

export type ListChannelsParamsLike = {
  pubkey?: string;
  includeClosed?: boolean;
};

export class ListChannelsParams {
  constructor(
    public readonly pubkey?: string,
    public readonly includeClosed?: boolean,
  ) {}

  static from(like: ListChannelsParamsLike): ListChannelsParams {
    return new ListChannelsParams(like.pubkey, like.includeClosed);
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
  pubkey: string;
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
      like.closeScript ? ccc.Script.from(like.closeScript) : undefined,
      toHex(like.feeRate),
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
      toHex(like.tlcExpiryDelta),
      toHex(like.tlcMinimumValue),
      toHex(like.tlcFeeProportionalMillionths),
    );
  }
}

// ─── OpenChannelWithExternalFunding ────────────────────────────────────────

export type OpenChannelWithExternalFundingParamsLike = {
  pubkey: string;
  fundingAmount: ccc.NumLike;
  public?: boolean;
  fundingUdtTypeScript?: ccc.ScriptLike;
  shutdownScript: ccc.ScriptLike;
  fundingLockScript: ccc.ScriptLike;
  fundingLockScriptCellDeps?: ccc.CellDepLike[];
  commitmentDelayEpoch?: ccc.NumLike;
  commitmentFeeRate?: ccc.NumLike;
  fundingFeeRate?: ccc.NumLike;
  tlcExpiryDelta?: ccc.NumLike;
  tlcMinValue?: ccc.NumLike;
  tlcFeeProportionalMillionths?: ccc.NumLike;
  maxTlcValueInFlight?: ccc.NumLike;
  maxTlcNumberInFlight?: ccc.NumLike;
};

export class OpenChannelWithExternalFundingParams {
  public readonly pubkey: string;
  public readonly fundingAmount: ccc.Hex;
  public readonly "public"?: boolean;
  public readonly shutdownScript: ccc.Script;
  public readonly fundingLockScript: ccc.Script;
  public readonly fundingUdtTypeScript?: ccc.Script;
  public readonly fundingLockScriptCellDeps?: ccc.CellDep[];
  public readonly commitmentDelayEpoch?: ccc.Hex;
  public readonly commitmentFeeRate?: ccc.Hex;
  public readonly fundingFeeRate?: ccc.Hex;
  public readonly tlcExpiryDelta?: ccc.Hex;
  public readonly tlcMinValue?: ccc.Hex;
  public readonly tlcFeeProportionalMillionths?: ccc.Hex;
  public readonly maxTlcValueInFlight?: ccc.Hex;
  public readonly maxTlcNumberInFlight?: ccc.Hex;

  constructor(
    pubkey: string,
    fundingAmount: ccc.Hex,
    isPublic: boolean | undefined,
    shutdownScript: ccc.Script,
    fundingLockScript: ccc.Script,
    fundingUdtTypeScript?: ccc.Script,
    fundingLockScriptCellDeps?: ccc.CellDep[],
    commitmentDelayEpoch?: ccc.Hex,
    commitmentFeeRate?: ccc.Hex,
    fundingFeeRate?: ccc.Hex,
    tlcExpiryDelta?: ccc.Hex,
    tlcMinValue?: ccc.Hex,
    tlcFeeProportionalMillionths?: ccc.Hex,
    maxTlcValueInFlight?: ccc.Hex,
    maxTlcNumberInFlight?: ccc.Hex,
  ) {
    this.pubkey = pubkey;
    this.fundingAmount = fundingAmount;
    this["public"] = isPublic;
    this.shutdownScript = shutdownScript;
    this.fundingLockScript = fundingLockScript;
    this.fundingUdtTypeScript = fundingUdtTypeScript;
    this.fundingLockScriptCellDeps = fundingLockScriptCellDeps;
    this.commitmentDelayEpoch = commitmentDelayEpoch;
    this.commitmentFeeRate = commitmentFeeRate;
    this.fundingFeeRate = fundingFeeRate;
    this.tlcExpiryDelta = tlcExpiryDelta;
    this.tlcMinValue = tlcMinValue;
    this.tlcFeeProportionalMillionths = tlcFeeProportionalMillionths;
    this.maxTlcValueInFlight = maxTlcValueInFlight;
    this.maxTlcNumberInFlight = maxTlcNumberInFlight;
  }

  static from(
    like: OpenChannelWithExternalFundingParamsLike,
  ): OpenChannelWithExternalFundingParams {
    return new OpenChannelWithExternalFundingParams(
      like.pubkey,
      ccc.numToHex(like.fundingAmount),
      like.public,
      ccc.Script.from(like.shutdownScript),
      ccc.Script.from(like.fundingLockScript),
      like.fundingUdtTypeScript
        ? ccc.Script.from(like.fundingUdtTypeScript)
        : undefined,
      like.fundingLockScriptCellDeps
        ? like.fundingLockScriptCellDeps.map(ccc.CellDep.from)
        : undefined,
      toHex(like.commitmentDelayEpoch),
      toHex(like.commitmentFeeRate),
      toHex(like.fundingFeeRate),
      toHex(like.tlcExpiryDelta),
      toHex(like.tlcMinValue),
      toHex(like.tlcFeeProportionalMillionths),
      toHex(like.maxTlcValueInFlight),
      toHex(like.maxTlcNumberInFlight),
    );
  }
}

export type OpenChannelWithExternalFundingResult = {
  channelId: ccc.Hex;
  unsignedFundingTx: ccc.Transaction;
};

// ─── SubmitSignedFundingTx ─────────────────────────────────────────────────

export type SubmitSignedFundingTxParamsLike = {
  channelId: ccc.HexLike;
  signedFundingTx: ccc.TransactionLike;
};

export class SubmitSignedFundingTxParams {
  constructor(
    public readonly channelId: ccc.Hex,
    public readonly signedFundingTx: ccc.Transaction,
  ) {}

  static from(
    like: SubmitSignedFundingTxParamsLike,
  ): SubmitSignedFundingTxParams {
    return new SubmitSignedFundingTxParams(
      ccc.hexFrom(like.channelId),
      ccc.Transaction.from(like.signedFundingTx),
    );
  }
}

export type SubmitSignedFundingTxResult = {
  channelId: ccc.Hex;
  fundingTxHash: ccc.Hex;
};
