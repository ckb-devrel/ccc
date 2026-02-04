import { FiberClient } from "../client.js";
import { Hash256, HashAlgorithm, RemoveTlcReason } from "../types.js";

/** Reason for removing a TLC: either preimage (fulfill) or error code (fail). */
export type RemoveTlcReasonParam =
  | { RemoveTlcFulfill: Hash256 }
  | { RemoveTlcFail: number };

export class DevModule {
  constructor(private client: FiberClient) {}

  /**
   * Send a commitment_signed message to the peer (dev only).
   */
  async commitmentSigned(params: { channel_id: Hash256 }): Promise<void> {
    return this.client.call("commitment_signed", [params]);
  }

  /**
   * Add a TLC to a channel (dev only).
   * @returns The ID of the added TLC.
   */
  async addTlc(params: {
    channel_id: Hash256;
    amount: string | number;
    payment_hash: Hash256;
    expiry: string | number;
    hash_algorithm?: HashAlgorithm;
  }): Promise<{ tlc_id: number }> {
    return this.client.call<{ tlc_id: number }>("add_tlc", [params]);
  }

  /**
   * Remove a TLC from a channel (dev only).
   * Reason: RemoveTlcFulfill with 32-byte preimage hash, or RemoveTlcFail with u32 error code.
   */
  async removeTlc(params: {
    channel_id: Hash256;
    tlc_id: number;
    reason: RemoveTlcReasonParam;
  }): Promise<void> {
    return this.client.call("remove_tlc", [params]);
  }

  /**
   * Submit a commitment transaction to the chain (dev only).
   * @returns The submitted commitment transaction hash.
   */
  async submitCommitmentTransaction(params: {
    channel_id: Hash256;
    commitment_number: string | number;
  }): Promise<{ tx_hash: Hash256 }> {
    return this.client.call<{ tx_hash: Hash256 }>(
      "submit_commitment_transaction",
      [params],
    );
  }

  /**
   * Remove a watched channel from the watchtower store (dev only).
   */
  async removeWatchChannel(channel_id: Hash256): Promise<void> {
    return this.client.call("remove_watch_channel", [{ channel_id }]);
  }
}
