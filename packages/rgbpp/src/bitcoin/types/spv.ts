import { SpvProof } from "../../interfaces/spv.js";

export { SpvProof };

export interface RgbppApiSpvProof {
  proof: string;
  spv_client: {
    tx_hash: string;
    index: string;
  };
}

export interface RgbppUnlockParams {
  spvProof: SpvProof;
  rawTxHex: string;
}
