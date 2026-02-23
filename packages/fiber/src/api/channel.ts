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

/** Convert amount-like params to bigint for RPC (fixed 8 decimals or raw bigint). */
function withAmounts(
  params: Record<string, unknown>,
  keys: Record<string, "fixed8" | "bigint">,
): Record<string, unknown> {
  const out = { ...params };
  for (const [key, kind] of Object.entries(keys)) {
    const v = out[key];
    if (typeof v === "string" || typeof v === "number") {
      out[key] =
        kind === "fixed8" ? ccc.fixedPointFrom(String(v), 8) : BigInt(v);
    }
  }
  return out;
}

export class ChannelApi {
  constructor(private readonly rpc: FiberClient) {}

  async openChannel(params: OpenChannelParams): Promise<Hash256> {
    const payload = withAmounts(params as Record<string, unknown>, {
      fundingAmount: "fixed8",
      commitmentDelayEpoch: "fixed8",
      commitmentFeeRate: "fixed8",
      fundingFeeRate: "bigint",
      tlcExpiryDelta: "bigint",
      tlcMinValue: "fixed8",
      tlcFeeProportionalMillionths: "fixed8",
      maxTlcValueInFlight: "bigint",
    });
    const res = await this.rpc.callCamel<OpenChannelResult>("open_channel", [
      payload,
    ]);
    return res.temporaryChannelId as Hash256;
  }

  async acceptChannel(params: AcceptChannelParams): Promise<Hash256> {
    const payload = withAmounts(params as Record<string, unknown>, {
      fundingAmount: "fixed8",
      maxTlcValueInFlight: "fixed8",
      maxTlcNumberInFlight: "bigint",
      tlcMinValue: "fixed8",
      tlcFeeProportionalMillionths: "fixed8",
      tlcExpiryDelta: "bigint",
    });
    const res = await this.rpc.callCamel<AcceptChannelResult>(
      "accept_channel",
      [payload],
    );
    return res.channelId as Hash256;
  }

  async abandonChannel(params: AbandonChannelParams): Promise<void> {
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
