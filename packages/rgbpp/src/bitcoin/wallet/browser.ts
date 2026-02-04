import { ccc } from "@ckb-ccc/core";
import { Psbt } from "bitcoinjs-lib";
import { NetworkConfig } from "../../types/network.js";
import { trimHexPrefix } from "../../utils/index.js";
import { BtcAssetApiConfig } from "../api/config.js";
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
      .then(trimHexPrefix);
  }
}

export function createBrowserRgbppBtcWallet(
  signer: ccc.SignerBtc,
  networkConfig: NetworkConfig,
  btcAssetApiConfig: BtcAssetApiConfig,
): BrowserRgbppBtcWallet | null {
  // Check if wallet is supported using duck typing instead of constructor.name
  // to avoid issues with minified code in production builds
  const isSupported =
    "provider" in signer || // UniSat, Xverse
    "providers" in signer || // OKX
    ("name" in signer &&
      typeof (signer as { name?: string }).name === "string"); // JoyID

  if (isSupported) {
    return new BrowserRgbppBtcWallet(signer, networkConfig, btcAssetApiConfig);
  }

  return null;
}

/**
 * Get supported wallet names
 */
export function getSupportedWallets(): string[] {
  return ["UniSat", "OKX", "JoyID", "Xverse"];
}
