import { ccc } from "@ckb-ccc/core";
import { Provider } from "./advancedBarrel.js";

/**
 * Class representing a Bitcoin signer that extends SignerBtc
 * @public
 */
export class Signer extends ccc.SignerBtc {
  /**
   * Creates an instance of Signer.
   * @param client - The client instance.
   * @param provider - The provider instance.
   */
  constructor(
    client: ccc.Client,
    public readonly provider: Provider,
    private readonly preferredNetworks: ccc.NetworkPreference[] = [
      {
        addressPrefix: "ckb",
        signerType: ccc.SignerType.BTC,
        network: "btc",
      },
      {
        addressPrefix: "ckt",
        signerType: ccc.SignerType.BTC,
        network: "btcTestnet",
      },
    ],
  ) {
    super(client);
  }

  async _getNetworkToChange(): Promise<string | undefined> {
    const currentNetwork = await (async () => {
      if (this.provider.getChain) {
        return (
          {
            BITCOIN_MAINNET: "btc",
            BITCOIN_TESTNET: "btcTestnet",
            FRACTAL_BITCOIN_MAINNET: "fractalBtc",
          }[(await this.provider.getChain()).enum] ?? ""
        );
      }
      return (await this.provider.getNetwork()) === "livenet"
        ? "btc"
        : "btcTestnet";
    })();
    const { network } = this.matchNetworkPreference(
      this.preferredNetworks,
      currentNetwork,
    ) ?? { network: currentNetwork };
    if (network === currentNetwork) {
      return;
    }

    return network;
  }

  /**
   * Ensure the BTC network is the same as CKB network.
   */
  async ensureNetwork(): Promise<void> {
    const network = await this._getNetworkToChange();
    if (!network) {
      return;
    }
    if (this.provider.switchChain) {
      const chain = {
        btc: "BITCOIN_MAINNET",
        btcTestnet: "BITCOIN_TESTNET",
        fractalBtc: "FRACTAL_BITCOIN_MAINNET",
      }[network];
      if (chain) {
        await this.provider.switchChain(chain);
        return;
      }
    } else if (network === "btc" || network === "btcTestnet") {
      await this.provider.switchNetwork(
        network === "btc" ? "livenet" : "testnet",
      );
      return;
    }

    throw new Error(
      `UniSat wallet doesn't support the requested chain ${network}`,
    );
  }

  /**
   * Gets the Bitcoin account address.
   * @returns A promise that resolves to the Bitcoin account address.
   */
  async getBtcAccount(): Promise<string> {
    return (await this.provider.getAccounts())[0];
  }

  /**
   * Gets the Bitcoin public key.
   * @returns A promise that resolves to the Bitcoin public key.
   */
  async getBtcPublicKey(): Promise<ccc.Hex> {
    return ccc.hexFrom(await this.provider.getPublicKey());
  }

  /**
   * Connects to the provider by requesting accounts.
   * @returns A promise that resolves when the connection is established.
   */
  async connect(): Promise<void> {
    const accounts = await this.provider.requestAccounts();
    console.log("connected accounts", accounts);
    if (accounts.length === 0) {
      throw new Error("No accounts found");
    }
    await this.ensureNetwork();
  }

  onReplaced(listener: () => void): () => void {
    const stop: (() => void)[] = [];
    const replacer = async () => {
      listener();
      stop[0]?.();
    };
    stop.push(() => {
      this.provider.removeListener("accountsChanged", replacer);
      this.provider.removeListener("networkChanged", replacer);
    });

    this.provider.on("accountsChanged", replacer);
    this.provider.on("networkChanged", replacer);

    return stop[0];
  }

  /**
   * Checks if the signer is connected.
   * @returns A promise that resolves to true if connected, false otherwise.
   */
  async isConnected(): Promise<boolean> {
    if (await this._getNetworkToChange()) {
      return false;
    }
    return (await this.provider.getAccounts()).length !== 0;
  }

  /**
   * Signs a raw message with the Bitcoin account.
   * @param message - The message to sign.
   * @returns A promise that resolves to the signed message.
   */
  async signMessageRaw(message: string | ccc.BytesLike): Promise<string> {
    const challenge =
      typeof message === "string" ? message : ccc.hexFrom(message).slice(2);

    return this.provider.signMessage(challenge, "ecdsa");
  }

  async signPsbt(psbtHex: string): Promise<string> {
    return this.provider.signPsbt(psbtHex);
  }

  async pushPsbt(psbtHex: string): Promise<string> {
    return this.provider.pushPsbt(psbtHex);
  }

  async pushTx(txHex: string): Promise<string> {
    return this.provider.pushTx({
      rawtx: txHex,
    });
  }
}
