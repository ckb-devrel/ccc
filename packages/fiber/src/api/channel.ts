import { ccc } from "@ckb-ccc/core";
import { FiberClient } from "../rpc.js";
import * as fiber from "../types/index.js";

export class ChannelApi {
  constructor(private readonly rpc: FiberClient) {}

  async openChannel(params: fiber.OpenChannelParamsLike): Promise<ccc.Hex> {
    const normalized = fiber.OpenChannelParams.from(params);
    const res = await this.rpc.call<fiber.OpenChannelResult>("open_channel", [
      { ...normalized },
    ]);
    return res.temporaryChannelId;
  }

  async acceptChannel(params: fiber.AcceptChannelParamsLike): Promise<ccc.Hex> {
    const normalized = fiber.AcceptChannelParams.from(params);
    const res = await this.rpc.call<fiber.AcceptChannelResult>(
      "accept_channel",
      [{ ...normalized }],
    );
    return res.channelId;
  }

  async abandonChannel(params: fiber.AbandonChannelParamsLike): Promise<void> {
    const normalized = fiber.AbandonChannelParams.from(params);
    await this.rpc.call("abandon_channel", [{ ...normalized }]);
  }

  async listChannels(
    params?: fiber.ListChannelsParamsLike,
  ): Promise<fiber.Channel[]> {
    const normalized = fiber.ListChannelsParams.from(params ?? {});
    const res = await this.rpc.call<fiber.ListChannelsResult>("list_channels", [
      { ...normalized },
    ]);
    return res.channels;
  }

  async shutdownChannel(
    params: fiber.ShutdownChannelParamsLike,
  ): Promise<void> {
    const normalized = fiber.ShutdownChannelParams.from(params);
    await this.rpc.call("shutdown_channel", [{ ...normalized }]);
  }

  async updateChannel(params: fiber.UpdateChannelParamsLike): Promise<void> {
    const normalized = fiber.UpdateChannelParams.from(params);
    await this.rpc.call("update_channel", [{ ...normalized }]);
  }
}
