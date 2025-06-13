import { Psbt, Transaction } from "bitcoinjs-lib";

import { BtcAccount, createBtcAccount, signPsbt } from "../../index.js";
import { BtcAssetApiConfig } from "../../types/btc-assets-api.js";
import { AddressType } from "../../types/tx.js";

import { NetworkConfig } from "../../../types/network.js";
import { RgbppBtcWallet } from "../wallet.js";

export class PrivateKeyRgbppBtcWallet extends RgbppBtcWallet {
  private account: BtcAccount;

  constructor(
    privateKey: string,
    addressType: AddressType,
    protected networkConfig: NetworkConfig,
    btcAssetApiConfig: BtcAssetApiConfig,
  ) {
    super(networkConfig, btcAssetApiConfig);
    this.account = createBtcAccount(
      privateKey,
      addressType,
      networkConfig.name,
    );
  }

  async getAddress(): Promise<string> {
    return this.account.from;
  }

  async signTx(psbt: Psbt): Promise<Transaction> {
    signPsbt(psbt, this.account);
    psbt.finalizeAllInputs();
    return psbt.extractTransaction(true);
  }

  async sendTx(tx: Transaction): Promise<string> {
    const txHex = tx.toHex();
    return this.sendTransaction(txHex);
  }
}
