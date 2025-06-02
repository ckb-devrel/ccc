import { ccc } from "@ckb-ccc/core";
import { Provider } from "../advancedBarrel.js";

/**
 * @public
 */
export class SignerBtc extends ccc.SignerBtc {
  private accountCache: string | undefined;

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

  async getBtcAccount() {
    const accounts = await this.provider.getAccount();
    this.accountCache = accounts[0];
    return this.accountCache;
  }

  async getBtcPublicKey(): Promise<ccc.Hex> {
    const pubKeys = await this.provider.getPublicKey();
    const account = await this.getBtcAccount();
    const pubKey = pubKeys.find((p) => p.address === account);

    if (!pubKey) {
      throw new Error("pubKey not found");
    }

    return ccc.hexFrom(pubKey.publicKey);
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
      btc: "btc",
      btcTestnet: "btc_testnet",
      btcTestnet4: "btc_testnet_4",
      btcSignet: "btc_signet",
    }[network];

    if (chain) {
      await this.provider.switchNetwork(chain);
      return;
    }

    throw new Error(
      `UTXO Global wallet doesn't support the requested chain ${network}`,
    );
  }

  async _getNetworkToChange(): Promise<string | undefined> {
    const currentNetwork = {
      btc: "btc",
      btc_testnet: "btcTestnet",
      btc_testnet_4: "btcTestnet4",
      btc_signet: "btcSignet",
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
      this.accountCache ?? (await this.getBtcAccount()),
    );
  }

  async signPsbt(_: string): Promise<string> {
    throw new Error("Not implemented");
  }

  async pushPsbt(_: string): Promise<string> {
    throw new Error("Not implemented");
  }
}
