import { FiberClient } from "../client";
import { Channel, Hash256, Script } from "../types";

export class ChannelModule {
  constructor(private client: FiberClient) {}

  /**
   * Open a channel
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
   * Accept a channel
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
   * Abandon a channel
   * @param channelId - Channel ID, must be a valid Hash256 format
   * @throws {Error} Throws error when channel ID is invalid or channel does not exist
   * @returns Promise<void>
   */
  async abandonChannel(channelId: Hash256): Promise<void> {
    console.log(channelId);
    if (!channelId) {
      throw new Error("Channel ID cannot be empty");
    }

    if (!channelId.startsWith("0x")) {
      throw new Error("Channel ID must start with 0x");
    }

    if (channelId.length !== 66) {
      // 0x + 64-bit hash
      throw new Error("Invalid channel ID length");
    }

    try {
      // Check if channel exists
      const channels = await this.listChannels();
      const channelExists = channels.some(
        (channel) => channel.channel_id === channelId,
      );

      if (!channelExists) {
        throw new Error(`Channel with ID ${channelId} not found`);
      }

      return this.client.call("abandon_channel", [{ channel_id: channelId }]);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to abandon channel: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * List channels
   */
  async listChannels(): Promise<Channel[]> {
    const response = await this.client.call<{ channels: Channel[] }>(
      "list_channels",
      [{}],
    );
    return response.channels;
  }

  /**
   * Shutdown channel
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
   * Update channel
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
