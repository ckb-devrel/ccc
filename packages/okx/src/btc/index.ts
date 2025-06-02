import { ccc } from "@ckb-ccc/core";
import { BitcoinProvider } from "../advancedBarrel.js";

/**
 * Class representing a Bitcoin signer that extends SignerBtc
 * @public
 */
export class BitcoinSigner extends ccc.SignerBtc {
  private network = "btcTestnet";

  /**
   * Creates an instance of Signer.
   * @param client - The client instance.
   * @param providers - The providers instance.
   * @param preferredNetworks - All preferred networks
   */
  constructor(
    client: ccc.Client,
    public readonly providers: Record<string, BitcoinProvider>,
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

  get provider(): BitcoinProvider {
    const { network } = this.matchNetworkPreference(
      this.preferredNetworks,
      this.network,
    ) ?? { network: this.network };
    this.network = network;

    const chain = {
      btc: "bitcoin",
      btcTestnet: "bitcoinTestnet",
      btcSignet: "bitcoinSignet",
    }[network];
    if (!chain) {
      throw new Error(
        `OKX wallet doesn't support the requested chain ${this.network}`,
      );
    }
    const provider = this.providers[chain];
    if (!provider) {
      throw new Error(
        `OKX wallet doesn't support the requested chain ${this.network}`,
      );
    }
    return provider;
  }

  /**
   * Gets the Bitcoin account address.
   * @returns A promise that resolves to the Bitcoin account address.
   */
  async getBtcAccount(): Promise<string> {
    if (this.provider.getAccounts) {
      const address = (await this.provider.getAccounts())[0];
      if (!address) {
        throw Error("Not connected");
      }
      return address;
    }

    if (this.provider.getSelectedAccount) {
      const account = await this.provider.getSelectedAccount();
      if (!account) {
        throw Error("Not connected");
      }
      return account.address;
    }

    throw Error("Unsupported OKX provider");
  }

  /**
   * Gets the Bitcoin public key.
   * @returns A promise that resolves to the Bitcoin public key.
   */
  async getBtcPublicKey(): Promise<ccc.Hex> {
    if (this.provider.getPublicKey) {
      const publicKey = await this.provider.getPublicKey();
      if (publicKey === "") {
        throw Error("The OKX Wallet returned wrong public key");
      }
      return ccc.hexFrom(publicKey);
    }

    if (this.provider.getSelectedAccount) {
      const account = await this.provider.getSelectedAccount();
      if (!account) {
        throw Error("Not connected");
      }
      return ccc.hexFrom(account.compressedPublicKey);
    }

    throw Error("Unsupported OKX provider");
  }

  /**
   * Connects to the provider by requesting accounts.
   * @returns A promise that resolves when the connection is established.
   */
  async connect(): Promise<void> {
    if (this.provider.requestAccounts) {
      await this.provider.requestAccounts();
      return;
    }

    if (this.provider.connect) {
      await this.provider.connect();
      return;
    }

    throw Error("Unsupported OKX provider");
  }

  onReplaced(listener: () => void): () => void {
    const stop: (() => void)[] = [];
    const replacer = async () => {
      listener();
      stop[0]?.();
    };
    stop.push(() => {
      this.provider.removeListener("accountChanged", replacer);
    });

    this.provider.on("accountChanged", replacer);

    return stop[0];
  }

  /**
   * Checks if the signer is connected.
   * @returns A promise that resolves to true if connected, false otherwise.
   */
  async isConnected(): Promise<boolean> {
    try {
      this.provider;
    } catch (_) {
      return false;
    }

    if (this.provider.getAccounts) {
      if ((await this.provider.getAccounts()).length === 0) {
        return false;
      }
    } else if (this.provider.getSelectedAccount) {
      if ((await this.provider.getSelectedAccount()) === null) {
        return false;
      }
    }

    await this.connect();
    return true;
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

  async signPsbt(_: string): Promise<string> {
    throw new Error("Not implemented");
  }

  async pushPsbt(_: string): Promise<string> {
    throw new Error("Not implemented");
  }
}
