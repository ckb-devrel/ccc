import { decimalToU128, decimalToU64 } from "../numeric.js";
import { FiberClient } from "../rpc/client.js";
import type { Channel, Hash256, Script } from "../types.js";

/** RPC response for open_channel. */
interface OpenChannelResult {
  temporaryChannelId: Hash256;
}

/** RPC response for accept_channel. */
interface AcceptChannelResult {
  channelId: Hash256;
}

/** RPC response for list_channels: array of Channel. */
interface ListChannelsResult {
  channels: Channel[];
}

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

  async openChannel(params: {
    peerId: string;
    fundingAmount: string;
    public?: boolean;
    fundingUdtTypeScript?: Script;
    shutdownScript?: Script;
    commitmentDelayEpoch?: string;
    commitmentFeeRate?: string;
    fundingFeeRate?: string;
    tlcExpiryDelta?: string;
    tlcMinValue?: string;
    tlcFeeProportionalMillionths?: string;
    maxTlcValueInFlight?: string;
    maxTlcNumberInFlight?: string;
  }): Promise<Hash256> {
    const payload = toU128Payload(params, {
      fundingAmount: decimalToU128,
      commitmentDelayEpoch: decimalToU128,
      commitmentFeeRate: decimalToU128,
      fundingFeeRate: decimalToU64,
      tlcExpiryDelta: decimalToU64,
      tlcMinValue: decimalToU128,
      tlcFeeProportionalMillionths: decimalToU128,
      maxTlcValueInFlight: decimalToU64,
    });
    const res = await this.rpc.callCamel<OpenChannelResult>("open_channel", [
      payload,
    ]);
    return res.temporaryChannelId;
  }

  async acceptChannel(params: {
    temporaryChannelId: string;
    fundingAmount: string;
    shutdownScript?: Script;
    maxTlcValueInFlight?: string;
    maxTlcNumberInFlight?: string;
    tlcMinValue?: string;
    tlcFeeProportionalMillionths?: string;
    tlcExpiryDelta?: string;
  }): Promise<Hash256> {
    const payload: Record<string, unknown> = {
      temporaryChannelId: params.temporaryChannelId,
      fundingAmount: decimalToU128(params.fundingAmount),
    };
    if (params.shutdownScript != null)
      payload.shutdownScript = params.shutdownScript;
    if (params.maxTlcValueInFlight != null)
      payload.maxTlcValueInFlight = decimalToU128(params.maxTlcValueInFlight);
    if (params.maxTlcNumberInFlight != null)
      payload.maxTlcNumberInFlight = decimalToU64(params.maxTlcNumberInFlight);
    if (params.tlcMinValue != null)
      payload.tlcMinValue = decimalToU128(params.tlcMinValue);
    if (params.tlcFeeProportionalMillionths != null)
      payload.tlcFeeProportionalMillionths = decimalToU128(
        params.tlcFeeProportionalMillionths,
      );
    if (params.tlcExpiryDelta != null)
      payload.tlcExpiryDelta = decimalToU64(params.tlcExpiryDelta);

    const res = await this.rpc.callCamel<AcceptChannelResult>(
      "accept_channel",
      [payload],
    );
    return res.channelId;
  }

  async abandonChannel(channelId: Hash256): Promise<void> {
    if (
      !channelId?.startsWith("0x") ||
      channelId.length !== CHANNEL_ID_HEX_LEN
    ) {
      throw new Error("Channel ID must be a 0x-prefixed 64-char hex string");
    }
    const channels = await this.listChannels();
    const exists = channels.some((c) => c.channelId === channelId);
    if (!exists) throw new Error(`Channel not found: ${channelId}`);
    await this.rpc.callCamel("abandon_channel", [{ channelId }]);
  }

  async listChannels(params?: {
    peerId?: string;
    includeClosed?: boolean;
  }): Promise<Channel[]> {
    const res = await this.rpc.callCamel<ListChannelsResult>("list_channels", [
      params ?? {},
    ]);
    return res.channels;
  }

  async shutdownChannel(params: {
    channelId: Hash256;
    closeScript?: Script;
    feeRate?: string | number;
    force?: boolean;
  }): Promise<void> {
    await this.rpc.callCamel("shutdown_channel", [params]);
  }

  async updateChannel(params: {
    channelId: Hash256;
    enabled?: boolean;
    tlcExpiryDelta?: bigint;
    tlcMinimumValue?: bigint;
    tlcFeeProportionalMillionths?: bigint;
  }): Promise<void> {
    await this.rpc.callCamel("update_channel", [params]);
  }
}
