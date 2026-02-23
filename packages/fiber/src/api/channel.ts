import { ccc } from "@ckb-ccc/core";
import { FiberClient } from "../rpc.js";
import type * as fiber from "../types.js";

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
        kind === "fixed8" ? ccc.fixedPointFrom(String(v), 8) : ccc.numFrom(v);
    }
  }
  return out;
}

export class ChannelApi {
  constructor(private readonly rpc: FiberClient) {}

  async openChannel(params: fiber.OpenChannelParams): Promise<ccc.Hex> {
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
    const res = await this.rpc.callCamel<fiber.OpenChannelResult>(
      "open_channel",
      [payload],
    );
    return res.temporaryChannelId as ccc.Hex;
  }

  async acceptChannel(params: fiber.AcceptChannelParams): Promise<ccc.Hex> {
    const payload = withAmounts(params as Record<string, unknown>, {
      fundingAmount: "fixed8",
      maxTlcValueInFlight: "fixed8",
      maxTlcNumberInFlight: "bigint",
      tlcMinValue: "fixed8",
      tlcFeeProportionalMillionths: "fixed8",
      tlcExpiryDelta: "bigint",
    });
    const res = await this.rpc.callCamel<fiber.AcceptChannelResult>(
      "accept_channel",
      [payload],
    );
    return res.channelId as ccc.Hex;
  }

  async abandonChannel(params: fiber.AbandonChannelParams): Promise<void> {
    await this.rpc.callCamel("abandon_channel", [params]);
  }

  async listChannels(
    params?: fiber.ListChannelsParams,
  ): Promise<fiber.Channel[]> {
    const res = await this.rpc.callCamel<fiber.ListChannelsResult>(
      "list_channels",
      [params ?? {}],
    );
    return res.channels;
  }

  async shutdownChannel(params: fiber.ShutdownChannelParams): Promise<void> {
    await this.rpc.callCamel("shutdown_channel", [params]);
  }

  async updateChannel(params: fiber.UpdateChannelParams): Promise<void> {
    await this.rpc.callCamel("update_channel", [params]);
  }
}
