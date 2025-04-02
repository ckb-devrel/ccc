import { FiberClient } from "../client";
import { Channel, Hash256, Script } from "../types";

export class ChannelModule {
  constructor(private client: FiberClient) {}

  /**
   * 打开通道
   */
  async openChannel(params: {
    peer_id: string;
    funding_amount: bigint;
    public?: boolean;
    funding_udt_type_script?: Script;
    shutdown_script?: Script;
    commitment_delay_epoch?: bigint;
    commitment_fee_rate?: bigint;
    funding_fee_rate?: bigint;
    tlc_expiry_delta?: bigint;
    tlc_min_value?: bigint;
    tlc_fee_proportional_millionths?: bigint;
    max_tlc_value_in_flight?: bigint;
    max_tlc_number_in_flight?: bigint;
  }): Promise<Hash256> {
    return this.client.call("open_channel", [params]);
  }

  /**
   * 接受通道
   */
  async acceptChannel(params: {
    temporary_channel_id: string;
    funding_amount: bigint;
    max_tlc_value_in_flight: bigint;
    max_tlc_number_in_flight: bigint;
    tlc_min_value: bigint;
    tlc_fee_proportional_millionths: bigint;
    tlc_expiry_delta: bigint;
  }): Promise<void> {
    return this.client.call("accept_channel", [params]);
  }

  /**
   * 放弃通道
   */
  async abandonChannel(channelId: Hash256): Promise<void> {
    return this.client.call("abandon_channel", [channelId]);
  }

  /**
   * 列出通道
   */
  async listChannels(): Promise<Channel[]> {
    return this.client.call("list_channels", []);
  }

  /**
   * 关闭通道
   */
  async shutdownChannel(params: {
    channel_id: Hash256;
    close_script: Script;
    force?: boolean;
    fee_rate: bigint;
  }): Promise<void> {
    return this.client.call("shutdown_channel", [params]);
  }

  /**
   * 更新通道
   */
  async updateChannel(params: {
    channel_id: Hash256;
    enabled?: boolean;
    tlc_expiry_delta?: bigint;
    tlc_minimum_value?: bigint;
    tlc_fee_proportional_millionths?: bigint;
  }): Promise<void> {
    return this.client.call("update_channel", [params]);
  }
}
