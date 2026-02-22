import { ccc } from "@ckb-ccc/core";
import { FiberClient } from "../rpc/client.js";
import type {
  AbandonChannelParams,
  AcceptChannelParams,
  AcceptChannelResult,
  Channel,
  Hash256,
  ListChannelsParams,
  ListChannelsResult,
  OpenChannelParams,
  OpenChannelResult,
  ShutdownChannelParams,
  UpdateChannelParams,
} from "../types.js";

const CHANNEL_ID_HEX_LEN = 66;

function toU128Payload(
  params: Record<string, unknown>,
  mapping: Record<string, (v: string) => bigint>,
): Record<string, unknown> {
  const out = { ...params };
  for (const [key, fn] of Object.entries(mapping)) {
    const v = out[key];
    if (v != null && (typeof v === "string" || typeof v === "number"))
      out[key] = fn(String(v));
  }
  return out;
}

export class ChannelApi {
  constructor(private readonly rpc: FiberClient) {}

  async openChannel(params: OpenChannelParams): Promise<Hash256> {
    const payload = toU128Payload(params as Record<string, unknown>, {
      fundingAmount: (v: string) => ccc.fixedPointFrom(v, 8),
      commitmentDelayEpoch: (v: string) => ccc.fixedPointFrom(v, 8),
      commitmentFeeRate: (v: string) => ccc.fixedPointFrom(v, 8),
      fundingFeeRate: (v: string) => BigInt(v),
      tlcExpiryDelta: (v: string) => BigInt(v),
      tlcMinValue: (v: string) => ccc.fixedPointFrom(v, 8),
      tlcFeeProportionalMillionths: (v: string) => ccc.fixedPointFrom(v, 8),
      maxTlcValueInFlight: (v: string) => BigInt(v),
    });
    const res = await this.rpc.callCamel<OpenChannelResult>("open_channel", [
      payload,
    ]);
    return res.temporaryChannelId as Hash256;
  }

  async acceptChannel(params: AcceptChannelParams): Promise<Hash256> {
    const payload: Record<string, unknown> = {
      temporaryChannelId: params.temporaryChannelId,
      fundingAmount: ccc.fixedPointFrom(String(params.fundingAmount), 8),
    };
    if (params.shutdownScript != null)
      payload.shutdownScript = params.shutdownScript;
    if (params.maxTlcValueInFlight != null)
      payload.maxTlcValueInFlight = ccc.fixedPointFrom(
        String(params.maxTlcValueInFlight),
        8,
      );
    if (params.maxTlcNumberInFlight != null)
      payload.maxTlcNumberInFlight = BigInt(
        String(params.maxTlcNumberInFlight),
      );
    if (params.tlcMinValue != null)
      payload.tlcMinValue = ccc.fixedPointFrom(String(params.tlcMinValue), 8);
    if (params.tlcFeeProportionalMillionths != null)
      payload.tlcFeeProportionalMillionths = ccc.fixedPointFrom(
        String(params.tlcFeeProportionalMillionths),
        8,
      );
    if (params.tlcExpiryDelta != null)
      payload.tlcExpiryDelta = BigInt(String(params.tlcExpiryDelta));

    const res = await this.rpc.callCamel<AcceptChannelResult>(
      "accept_channel",
      [payload],
    );
    return res.channelId as Hash256;
  }

  async abandonChannel(params: AbandonChannelParams): Promise<void> {
    const channelId = params.channelId as Hash256;
    if (
      !channelId?.startsWith("0x") ||
      channelId.length !== CHANNEL_ID_HEX_LEN
    ) {
      throw new Error("Channel ID must be a 0x-prefixed 64-char hex string");
    }
    const channels = await this.listChannels();
    const exists = channels.some((c) => c.channelId === channelId);
    if (!exists) throw new Error(`Channel not found: ${channelId}`);
    await this.rpc.callCamel("abandon_channel", [params]);
  }

  async listChannels(params?: ListChannelsParams): Promise<Channel[]> {
    const res = await this.rpc.callCamel<ListChannelsResult>("list_channels", [
      params ?? {},
    ]);
    return res.channels;
  }

  async shutdownChannel(params: ShutdownChannelParams): Promise<void> {
    await this.rpc.callCamel("shutdown_channel", [params]);
  }

  async updateChannel(params: UpdateChannelParams): Promise<void> {
    await this.rpc.callCamel("update_channel", [params]);
  }
}
