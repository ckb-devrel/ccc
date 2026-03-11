import { ccc } from "@ckb-ccc/core";

export interface SpvProofProvider {
  getRgbppSpvProof(
    btcTxId: string,
    confirmations: number,
  ): Promise<SpvProof | null>;
}

export interface SpvProof {
  proof: ccc.Hex;
  spvClientOutpoint: ccc.OutPoint;
}
