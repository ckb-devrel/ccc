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
    // Check wallet type using duck typing instead of constructor.name
    const isJoyID = "name" in this.signer && typeof (this.signer as any).name === "string";
    const isXverse = "provider" in this.signer && 
                     this.signer.provider && 
                     typeof (this.signer.provider as any).request === "function";
    
    // JoyID uses pushPsbt directly (sign + broadcast in one call)
    if (isJoyID) {
      return this.signer.pushPsbt(psbt.toHex());
    }
    
    // Xverse uses a custom pushPsbt with options support
    if (isXverse) {
      // Type cast to access Xverse-specific pushPsbt signature
      return (this.signer as any).pushPsbt(psbt.toHex(), options);
    }

    // UniSat and OKX use standard method (sign first, then broadcast)
    const signedPsbt = await this.signer.signPsbt(psbt.toHex(), options);
    return this.signer.pushPsbt(signedPsbt);
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
