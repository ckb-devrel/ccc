/**
 * Channel RPC types (camelCase). Enumerated from @nervosnetwork/fiber-js channel.d.ts.
 */
import type { ccc } from "@ckb-ccc/core";

export interface Script {
  codeHash: ccc.Hex;
  hashType: "data" | "type" | "data1" | "data2";
  args: string;
}

export interface OpenChannelParams {
  peerId: string;
  fundingAmount: ccc.Hex;
  public?: boolean;
  fundingUdtTypeScript?: Script;
  shutdownScript?: Script;
  commitmentDelayEpoch?: ccc.Hex;
  commitmentFeeRate?: ccc.Hex;
  fundingFeeRate?: ccc.Hex;
  tlcExpiryDelta?: ccc.Hex;
  tlcMinValue?: ccc.Hex;
  tlcFeeProportionalMillionths?: ccc.Hex;
  maxTlcValueInFlight?: ccc.Hex;
  maxTlcNumberInFlight?: ccc.Hex;
}

export interface OpenChannelResult {
  temporaryChannelId: ccc.Hex;
}

export interface AbandonChannelParams {
  channelId: ccc.Hex;
}

export interface AcceptChannelParams {
  temporaryChannelId: ccc.Hex;
  fundingAmount: ccc.Hex;
  shutdownScript?: Script;
  maxTlcValueInFlight?: ccc.Hex;
  maxTlcNumberInFlight?: ccc.Hex;
  tlcMinValue?: ccc.Hex;
  tlcFeeProportionalMillionths?: ccc.Hex;
  tlcExpiryDelta?: ccc.Hex;
}

export interface AcceptChannelResult {
  channelId: ccc.Hex;
}

export interface ListChannelsParams {
  peerId?: string;
  includeClosed?: boolean;
}

export interface ChannelState {
  stateName: string;
  stateFlags: string;
}

export interface Channel {
  channelId: ccc.Hex;
  isPublic: boolean;
  channelOutpoint: ccc.Hex;
  peerId: ccc.Hex;
  fundingUdtTypeScript?: Script;
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
}

export interface ShutdownChannelParams {
  channelId: ccc.Hex;
  closeScript?: Script;
  feeRate?: ccc.Hex;
  force?: boolean;
}

export interface UpdateChannelParams {
  channelId: ccc.Hex;
  enabled?: boolean;
  tlcExpiryDelta?: ccc.Hex;
  tlcMinimumValue?: ccc.Hex;
  tlcFeeProportionalMillionths?: ccc.Hex;
}

export interface ListChannelsResult {
  channels: Channel[];
}
