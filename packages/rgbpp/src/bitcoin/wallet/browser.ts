import { ccc } from "@ckb-ccc/core";
import { Psbt } from "bitcoinjs-lib";
import { BtcAssetApiConfig } from "../api/index.js";
import { NetworkConfig } from "../types/index.js";
import { trimHexPrefix } from "../utils/index.js";
import { RgbppBtcWallet } from "./base.js";

// TODO: add default btc asset api URL
export class BrowserRgbppBtcWallet extends RgbppBtcWallet {
  constructor(
    protected signer: ccc.SignerBtc,
    networkConfig: NetworkConfig,
    btcAssetApiConfig: BtcAssetApiConfig,
  ) {
    super(networkConfig, btcAssetApiConfig);
  }

  async getAddress(): Promise<string> {
    return this.signer.getBtcAccount();
  }

  async getPublicKey(): Promise<string> {
    const pubkey = await this.signer.getBtcPublicKey();
    const hexString: string =
      typeof pubkey === "string"
        ? pubkey
        : (pubkey as { toString(): string }).toString();
    return hexString.startsWith("0x") ? hexString.slice(2) : hexString;
  }

  async signAndBroadcast(
    psbt: Psbt,
    options?: ccc.SignPsbtOptionsLike,
  ): Promise<string> {
    return this.signer
      .signAndBroadcastPsbt(psbt.toHex(), options)
      .then((hex) => trimHexPrefix(hex));
  }
}

/**
 * Create a BrowserRgbppBtcWallet from a SignerBtc.
 *
 * TODO: Wallet capability validation (e.g. whether the signer fully implements
 * signAndBroadcastPsbt) should be enforced at the ccc.SignerBtc.
 */
export function createBrowserRgbppBtcWallet(
  signer: ccc.SignerBtc,
  networkConfig: NetworkConfig,
  btcAssetApiConfig: BtcAssetApiConfig,
): BrowserRgbppBtcWallet {
  return new BrowserRgbppBtcWallet(signer, networkConfig, btcAssetApiConfig);
}
