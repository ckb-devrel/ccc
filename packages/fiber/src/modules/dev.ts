import { FiberClient } from "../client.js";
import { Hash256, RemoveTlcReason } from "../types.js";

export class DevModule {
  constructor(private client: FiberClient) {}

  /**
   * Submit commitment transaction
   */
  async commitmentSigned(params: {
    channel_id: Hash256;
    commitment_transaction: string;
  }): Promise<void> {
    return this.client.call("commitment_signed", [params]);
  }

  /**
   * Add time-locked contract
   */
  async addTlc(params: {
    channel_id: Hash256;
    amount: bigint;
    payment_hash: string;
    expiry: bigint;
  }): Promise<void> {
    return this.client.call("add_tlc", [params]);
  }

  /**
   * Remove time-locked contract
   */
  async removeTlc(params: {
    channel_id: Hash256;
    tlc_id: bigint;
    reason: RemoveTlcReason;
    payment_preimage?: string;
    failure_message?: string;
  }): Promise<void> {
    return this.client.call("remove_tlc", [params]);
  }

  /**
   * Submit commitment transaction
   */
  async submitCommitmentTransaction(params: {
    channel_id: Hash256;
    commitment_transaction: string;
  }): Promise<void> {
    return this.client.call("submit_commitment_transaction", [params]);
  }

  /**
   * Remove watch channel
   */
  async removeWatchChannel(channel_id: Hash256): Promise<void> {
    return this.client.call("remove_watch_channel", [channel_id]);
  }
}
