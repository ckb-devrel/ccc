import { FiberClient } from "../client.js";
import { Channel, Hash256, Script } from "../types.js";
import {
  decimalToU128,
  decimalToU64,
  u128ToDecimal,
  u64ToDecimal,
} from "../utils/number.js";

export class ChannelModule {
  constructor(private client: FiberClient) {}

  /**
   * Open a channel
   */
  async openChannel(params: {
    peer_id: string;
    funding_amount: string;
    public?: boolean;
    funding_udt_type_script?: Script;
    shutdown_script?: Script;
    commitment_delay_epoch?: string;
    commitment_fee_rate?: string;
    funding_fee_rate?: string;
    tlc_expiry_delta?: string;
    tlc_min_value?: string;
    tlc_fee_proportional_millionths?: string;
    max_tlc_value_in_flight?: string;
    max_tlc_number_in_flight?: string;
  }): Promise<Hash256> {
    const u128Params = {
      ...params,
      funding_amount: decimalToU128(params.funding_amount),
      commitment_delay_epoch: params.commitment_delay_epoch
        ? decimalToU128(params.commitment_delay_epoch)
        : undefined,
      commitment_fee_rate: params.commitment_fee_rate
        ? decimalToU128(params.commitment_fee_rate)
        : undefined,
      funding_fee_rate: params.funding_fee_rate
        ? decimalToU64(params.funding_fee_rate)
        : undefined,
      tlc_expiry_delta: params.tlc_expiry_delta
        ? decimalToU64(params.tlc_expiry_delta)
        : undefined,
      tlc_min_value: params.tlc_min_value
        ? decimalToU128(params.tlc_min_value)
        : undefined,
      tlc_fee_proportional_millionths: params.tlc_fee_proportional_millionths
        ? decimalToU128(params.tlc_fee_proportional_millionths)
        : undefined,
      max_tlc_value_in_flight: params.max_tlc_value_in_flight
        ? decimalToU64(params.max_tlc_value_in_flight)
        : undefined,
    };
    return this.client.call("open_channel", [u128Params]);
  }

  /**
   * Accept a channel
   */
  async acceptChannel(params: {
    temporary_channel_id: string;
    funding_amount: string;
    max_tlc_value_in_flight: string;
    max_tlc_number_in_flight: string;
    tlc_min_value: string;
    tlc_fee_proportional_millionths: string;
    tlc_expiry_delta: string;
  }): Promise<void> {
    const u128Params = {
      ...params,
      funding_amount: decimalToU128(params.funding_amount),
      max_tlc_value_in_flight: decimalToU128(params.max_tlc_value_in_flight),
      max_tlc_number_in_flight: decimalToU128(params.max_tlc_number_in_flight),
      tlc_min_value: decimalToU128(params.tlc_min_value),
      tlc_fee_proportional_millionths: decimalToU128(
        params.tlc_fee_proportional_millionths,
      ),
      tlc_expiry_delta: decimalToU128(params.tlc_expiry_delta),
    };
    return this.client.call("accept_channel", [u128Params]);
  }

  /**
   * Abandon a channel
   * @param channelId - Channel ID, must be a valid Hash256 format
   * @throws {Error} Throws error when channel ID is invalid or channel does not exist
   * @returns Promise<void>
   */
  async abandonChannel(channelId: Hash256): Promise<void> {
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
    return response.channels.map((channel) => ({
      ...channel,
      local_balance: u128ToDecimal(channel.local_balance),
      remote_balance: u128ToDecimal(channel.remote_balance),
      offered_tlc_balance: u128ToDecimal(channel.offered_tlc_balance),
      received_tlc_balance: u128ToDecimal(channel.received_tlc_balance),
      tlc_expiry_delta: u128ToDecimal(channel.tlc_expiry_delta),
      tlc_fee_proportional_millionths: u128ToDecimal(
        channel.tlc_fee_proportional_millionths,
      ),
      created_at: u64ToDecimal(channel.created_at, true),
      last_updated_at: channel.last_updated_at
        ? u64ToDecimal(channel.last_updated_at, true)
        : "",
    }));
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
