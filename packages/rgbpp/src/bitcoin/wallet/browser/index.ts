import { ccc } from "@ckb-ccc/shell";
import { Psbt } from "bitcoinjs-lib";
import { NetworkConfig } from "../../../types/network.js";
import { BtcAssetApiConfig } from "../../types/btc-assets-api.js";
import { RgbppBtcWallet } from "../wallet.js";

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

  async signAndBroadcast(psbt: Psbt): Promise<string> {
    // JoyID uses different signing method
    if (
      this.signer.constructor.name === "BitcoinSigner" &&
      "name" in this.signer
    ) {
      return this.signer.pushPsbt(psbt.toHex());
    }

    // UniSat and OKX use standard method
    const signedPsbt = await this.signer.signPsbt(psbt.toHex());
    return this.signer.pushPsbt(signedPsbt);
  }
}

export function createBrowserRgbppBtcWallet(
  signer: ccc.SignerBtc,
  networkConfig: NetworkConfig,
  btcAssetApiConfig: BtcAssetApiConfig,
): BrowserRgbppBtcWallet | null {
  const signerName = signer.constructor.name;

  // Check if wallet is supported
  const isSupported =
    (signerName === "Signer" && "provider" in signer) || // UniSat
    (signerName === "BitcoinSigner" && "providers" in signer) || // OKX
    (signerName === "BitcoinSigner" && "name" in signer); // JoyID

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
