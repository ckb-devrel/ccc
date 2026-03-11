import { ccc } from "@ckb-ccc/core";

import { DEFAULT_SPV_POLL_INTERVAL } from "../bitcoin/constants.js";
import { SpvProof, SpvProofProvider } from "../interfaces/index.js";

/**
 * Poll for an SPV proof until it becomes available.
 *
 * @param provider - The SPV proof provider to query
 * @param btcTxId - The Bitcoin transaction ID to get the proof for
 * @param confirmations - The number of confirmations required
 * @param pollInterval - The polling interval in milliseconds
 * @returns The SPV proof once available
 */
export async function pollForSpvProof(
  spvProofProvider: SpvProofProvider,
  btcTxId: string,
  confirmations: number = 0,
  intervalMs?: number,
): Promise<SpvProof> {
  const interval = intervalMs ?? DEFAULT_SPV_POLL_INTERVAL;

  while (true) {
    try {
      console.log(`[SPV] Polling for BTC tx ${btcTxId}`);
      const proof = await spvProofProvider.getRgbppSpvProof(
        btcTxId,
        confirmations,
      );

      if (proof) {
        return proof;
      }
    } catch (e) {
      console.info(
        `[SPV] Error polling for BTC tx ${btcTxId}:`,
        e instanceof Error ? e.message : String(e),
      );
      // Continue polling on error
    }

    await ccc.sleep(interval);
  }
}
