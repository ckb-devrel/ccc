import { ccc } from "@ckb-ccc/core";
import type { FiberClient } from "../rpc.js";
import * as fiber from "../types/index.js";
import type { Constructor } from "../utils.js";

export function ChannelMixin<
  TBase extends Constructor<{ readonly rpc: FiberClient }>,
>(Base: TBase) {
  return class ChannelMixin extends Base {
    declare readonly rpc: FiberClient;

    async openChannel(params: fiber.OpenChannelParamsLike): Promise<ccc.Hex> {
      const normalized = fiber.OpenChannelParams.from(params);
      const res = await this.rpc.call<fiber.OpenChannelResult>("open_channel", [
        { ...normalized },
      ]);
      return res.temporaryChannelId;
    }

    async acceptChannel(
      params: fiber.AcceptChannelParamsLike,
    ): Promise<ccc.Hex> {
      const normalized = fiber.AcceptChannelParams.from(params);
      const res = await this.rpc.call<fiber.AcceptChannelResult>(
        "accept_channel",
        [{ ...normalized }],
      );
      return res.channelId;
    }

    async abandonChannel(
      params: fiber.AbandonChannelParamsLike,
    ): Promise<void> {
      const normalized = fiber.AbandonChannelParams.from(params);
      await this.rpc.call("abandon_channel", [{ ...normalized }]);
    }

    async listChannels(
      params?: fiber.ListChannelsParamsLike,
    ): Promise<fiber.Channel[]> {
      const normalized = fiber.ListChannelsParams.from(params ?? {});
      const res = await this.rpc.call<fiber.ListChannelsResult>(
        "list_channels",
        [{ ...normalized }],
      );
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

    async openChannelWithExternalFunding(
      params: fiber.OpenChannelWithExternalFundingParamsLike,
    ): Promise<fiber.OpenChannelWithExternalFundingResult> {
      const normalized =
        fiber.OpenChannelWithExternalFundingParams.from(params);
      return this.rpc.call<fiber.OpenChannelWithExternalFundingResult>(
        "open_channel_with_external_funding",
        [{ ...normalized }],
      );
    }

    async submitSignedFundingTx(
      params: fiber.SubmitSignedFundingTxParamsLike,
    ): Promise<fiber.SubmitSignedFundingTxResult> {
      const normalized = fiber.SubmitSignedFundingTxParams.from(params);
      return this.rpc.call<fiber.SubmitSignedFundingTxResult>(
        "submit_signed_funding_tx",
        [{ ...normalized }],
      );
    }
  };
}

class FiberClientBase {
  constructor(public readonly rpc: FiberClient) {}
}

export class ChannelApi extends ChannelMixin(FiberClientBase) {}
