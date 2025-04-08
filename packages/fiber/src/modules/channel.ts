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
   * @param channelId - 通道ID，必须是有效的 Hash256 格式
   * @throws {Error} 当通道ID无效或通道不存在时抛出错误
   * @returns Promise<void>
   */
  async abandonChannel(channelId: Hash256): Promise<void> {
    if (!channelId) {
      throw new Error("通道ID不能为空");
    }

    if (!channelId.startsWith("0x")) {
      throw new Error("通道ID必须以0x开头");
    }

    if (channelId.length !== 66) {
      // 0x + 64位哈希
      throw new Error("通道ID长度无效");
    }

    try {
      // 先检查通道是否存在
      const channels = await this.listChannels();
      const channelExists = channels.some(
        (channel) => channel.channel_id === channelId,
      );

      if (!channelExists) {
        throw new Error(`找不到ID为 ${channelId} 的通道`);
      }

      return this.client.call("abandon_channel", [channelId]);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`放弃通道失败: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 列出通道
   */
  async listChannels(): Promise<Channel[]> {
    const response = await this.client.call<{ channels: Channel[] }>(
      "list_channels",
      [{}],
    );
    return response.channels;
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
