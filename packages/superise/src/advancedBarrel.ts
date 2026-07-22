export interface CkbConnection {
  publicKey: string;
  address: string;
}

export interface Bridge {
  version: string;

  connectCkb: () => Promise<CkbConnection>;

  signCkbMessage: (message: string) => Promise<{ signature: string }>;

  signCkbTransaction: (
    transaction: string,
    witnessIndexes: number[],
  ) => Promise<{ signedTransaction: string }>;
}
