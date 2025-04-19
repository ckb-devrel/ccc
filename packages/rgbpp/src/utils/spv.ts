import { SpvProofProvider } from "../interfaces/spv.js";
import { SpvProof } from "../types/spv.js";

export async function pollForSpvProof(
  spvProofProvider: SpvProofProvider,
  btcTxId: string,
  confirmations: number = 0,
  intervalInSeconds?: number,
): Promise<SpvProof> {
  return new Promise((resolve) => {
    const polling = setInterval(
      async () => {
        try {
          console.log(`Waiting for btc tx ${btcTxId} and proof to be ready`);
          const proof = await spvProofProvider.getRgbppSpvProof(
            btcTxId,
            confirmations,
          );

          if (proof) {
            clearInterval(polling);
            resolve(proof);
          }
        } catch (e) {
          // TODO: fix this
          console.log(String(e));
        }
      },
      intervalInSeconds ?? 10 * 1000,
    );
  });
}
