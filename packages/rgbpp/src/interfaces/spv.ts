import { SpvProof } from "../types/spv.js";

export interface SpvProofProvider {
  getRgbppSpvProof(
    btcTxId: string,
    confirmations: number,
  ): Promise<SpvProof | null>;
}
