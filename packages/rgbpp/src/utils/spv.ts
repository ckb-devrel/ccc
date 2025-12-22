import { ccc } from "@ckb-ccc/core";
import { DEFAULT_SPV_POLL_INTERVAL } from "../constants/index.js";
import { SpvProofProvider } from "../interfaces/spv.js";
import { SpvProof } from "../types/spv.js";

export async function pollForSpvProof(
  spvProofProvider: SpvProofProvider,
  btcTxId: string,
  confirmations: number = 0,
  intervalMs?: number,
): Promise<SpvProof> {
  const interval = intervalMs ?? DEFAULT_SPV_POLL_INTERVAL;
  // eslint-disable-next-line no-constant-condition
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
