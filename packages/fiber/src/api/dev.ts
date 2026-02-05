import { FiberClient } from "../rpc/client.js";
import type { Hash256, HashAlgorithm } from "../types.js";

export type RemoveTlcReasonParam =
  | { RemoveTlcFulfill: Hash256 }
  | { RemoveTlcFail: number };

/** RPC response for add_tlc. */
interface AddTlcResult {
  tlcId: number;
}

/** RPC response for submit_commitment_transaction. */
interface SubmitCommitmentTransactionResult {
  txHash: Hash256;
}

export class DevApi {
  constructor(private readonly rpc: FiberClient) {}

  async commitmentSigned(params: { channelId: Hash256 }): Promise<void> {
    await this.rpc.callCamel("commitment_signed", [params]);
  }

  async addTlc(params: {
    channelId: Hash256;
    amount: string | number;
    paymentHash: Hash256;
    expiry: string | number;
    hashAlgorithm?: HashAlgorithm;
  }): Promise<AddTlcResult> {
    return this.rpc.callCamel<AddTlcResult>("add_tlc", [params]);
  }

  async removeTlc(params: {
    channelId: Hash256;
    tlcId: number;
    reason: RemoveTlcReasonParam;
  }): Promise<void> {
    await this.rpc.callCamel("remove_tlc", [params]);
  }

  async submitCommitmentTransaction(params: {
    channelId: Hash256;
    commitmentNumber: string | number;
  }): Promise<SubmitCommitmentTransactionResult> {
    return this.rpc.callCamel<SubmitCommitmentTransactionResult>(
      "submit_commitment_transaction",
      [params],
    );
  }

  async removeWatchChannel(channelId: Hash256): Promise<void> {
    await this.rpc.callCamel("remove_watch_channel", [{ channelId }]);
  }
}
