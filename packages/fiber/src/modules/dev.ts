import { FiberClient } from "../client";
import { Hash256, RemoveTlcReason } from "../types";

export class DevModule {
  constructor(private client: FiberClient) {}

  /**
   * 提交承诺交易
   */
  async commitmentSigned(params: {
    channel_id: Hash256;
    commitment_transaction: string;
  }): Promise<void> {
    return this.client.call("commitment_signed", [params]);
  }

  /**
   * 添加时间锁定合约
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
   * 移除时间锁定合约
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
   * 提交承诺交易
   */
  async submitCommitmentTransaction(params: {
    channel_id: Hash256;
    commitment_transaction: string;
  }): Promise<void> {
    return this.client.call("submit_commitment_transaction", [params]);
  }

  /**
   * 移除监视通道
   */
  async removeWatchChannel(channel_id: Hash256): Promise<void> {
    return this.client.call("remove_watch_channel", [channel_id]);
  }
} 