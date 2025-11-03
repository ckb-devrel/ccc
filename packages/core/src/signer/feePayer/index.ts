import { Transaction } from "../../ckb/index.js";
import { Client } from "../../client/client.js";

export abstract class FeePayer {
  constructor() {}

  abstract completeTxFee(tx: Transaction, client: Client): Promise<void>;
}

export class FeePayerManager {
  constructor(private payers: FeePayer[]) {}

  push(...payers: FeePayer[]): FeePayerManager {
    this.payers.push(...payers);
    return this;
  }

  pop(): FeePayer | undefined {
    return this.payers.pop();
  }

  async completeTxFee(tx: Transaction, client: Client): Promise<void> {
    for (const payer of this.payers) {
      await payer.completeTxFee(tx, client);
    }
  }
}
