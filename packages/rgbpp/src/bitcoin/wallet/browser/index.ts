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

  async signAndBroadcast(
    psbt: Psbt,
    options?: ccc.SignPsbtOptions,
  ): Promise<string> {
    // JoyID uses different signing method
    // Check using duck typing instead of constructor.name
    if ("name" in this.signer && typeof (this.signer as any).name === "string") {
      // TODO: fix options support
      return this.signer.pushPsbt(psbt.toHex());
    }

    // UniSat and OKX use standard method
    const signedPsbt = await this.signer.signPsbt(psbt.toHex(), options);
    return this.signer.pushPsbt(signedPsbt);
  }
}

export function createBrowserRgbppBtcWallet(
  signer: ccc.SignerBtc,
  networkConfig: NetworkConfig,
  btcAssetApiConfig: BtcAssetApiConfig,
): BrowserRgbppBtcWallet | null {
  const isSupported =
    "provider" in signer || // UniSat
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
  return ["UniSat", "OKX", "JoyID"];
}
