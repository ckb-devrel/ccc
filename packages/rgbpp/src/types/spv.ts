import { ccc } from "@ckb-ccc/shell";

export interface SpvProof {
  proof: ccc.Hex;
  spvClientOutpoint: ccc.OutPoint;
}

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
