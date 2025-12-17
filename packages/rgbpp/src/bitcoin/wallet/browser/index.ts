import { ccc } from "@ckb-ccc/core";
import { Psbt } from "bitcoinjs-lib";
import { NetworkConfig } from "../../../types/network.js";
import { BtcAssetApiConfig } from "../../types/btc-assets-api.js";
import { RgbppBtcWallet } from "../wallet.js";

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
    const hexString = typeof pubkey === "string" ? pubkey : pubkey.toString();
    return hexString.startsWith("0x") ? hexString.slice(2) : hexString;
  }

  async signAndBroadcast(
    psbt: Psbt,
    options?: ccc.SignPsbtOptions,
  ): Promise<string> {
    return this.signer.signAndPushPsbt(psbt.toHex(), options);
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
    ("name" in signer && typeof (signer as any).name === "string"); // JoyID

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
