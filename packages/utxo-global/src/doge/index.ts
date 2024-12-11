import { ccc } from "@ckb-ccc/core";
import { Provider } from "../advancedBarrel.js";

/**
 * @public
 */
export class SignerDoge extends ccc.SignerDoge {
  private accountCache: string | undefined;

  constructor(
    client: ccc.Client,
    public readonly provider: Provider,
    private readonly preferredNetworks: ccc.NetworkPreference[] = [
      {
        addressPrefix: "ckb",
        signerType: ccc.SignerType.Doge,
        network: "doge",
      },
      {
        addressPrefix: "ckt",
        signerType: ccc.SignerType.Doge,
        network: "dogeTestnet",
      },
    ],
  ) {
    super(client);
  }

  async getDogeAddress(): Promise<string> {
    const accounts = await this.provider.getAccount();
    this.accountCache = accounts[0];
    return this.accountCache;
  }

  /**
   * Ensure the BTC network is the same as CKB network.
   */
  async ensureNetwork(): Promise<void> {
    const network = await this._getNetworkToChange();
    if (!network) {
      return;
    }

    const chain = {
      doge: "dogecoin",
      dogeTestnet: "dogecoin_testnet",
    }[network];

    if (chain) {
      await this.provider.switchNetwork(chain);
      return;
    }

    throw new Error(
      `UTXO Global Doge wallet doesn't support the requested chain ${network}`,
    );
  }

  async _getNetworkToChange(): Promise<string | undefined> {
    const currentNetwork = {
      dogecoin: "doge",
      dogecoin_testnet: "dogeTestnet",
    }[await this.provider.getNetwork()];

    const { network } = this.matchNetworkPreference(
      this.preferredNetworks,
      currentNetwork,
    ) ?? { network: currentNetwork };
    if (network === currentNetwork) {
      return;
    }

    return network;
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

  async connect(): Promise<void> {
    await this.provider.connect();
    await this.ensureNetwork();
  }

  async isConnected(): Promise<boolean> {
    if ((await this._getNetworkToChange()) !== undefined) {
      return false;
    }

    return await this.provider.isConnected();
  }

  async signMessageRaw(message: string | ccc.BytesLike): Promise<string> {
    const challenge =
      typeof message === "string" ? message : ccc.hexFrom(message).slice(2);
    return this.provider.signMessage(
      challenge,
      this.accountCache ?? (await this.getDogeAddress()),
    );
  }
}
