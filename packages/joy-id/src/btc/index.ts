import { ccc } from "@ckb-ccc/core";
import { DappRequestType, buildJoyIDURL } from "@joyid/common";
import { createPopup } from "../common/index.js";
import {
  Connection,
  ConnectionsRepo,
  ConnectionsRepoLocalStorage,
} from "../connectionsStorage/index.js";

/**
 * Class representing a Bitcoin signer that extends SignerBtc
 * @public
 */
export class BitcoinSigner extends ccc.SignerBtc {
  private connection?: Connection;
  private network = "btcTestnet";

  /**
   * Ensures that the signer is connected and returns the connection.
   * @throws Will throw an error if not connected.
   * @returns The current connection.
   */
  private async assertConnection(): Promise<Connection> {
    if (!(await this.isConnected()) || !this.connection) {
      throw new Error("Not connected");
    }

    return this.connection;
  }

  /**
   * Creates an instance of BitcoinSigner.
   * @param client - The client instance.
   * @param name - The name of the signer.
   * @param icon - The icon URL of the signer.
   * @param addressType - The address type.
   * @param _appUri - The application URI.
   * @param connectionsRepo - The connections repository.
   */
  constructor(
    client: ccc.Client,
    public readonly name: string,
    public readonly icon: string,
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
    public readonly addressType: "auto" | "p2wpkh" | "p2tr" = "auto",
    private readonly _appUri?: string,
    private readonly connectionsRepo: ConnectionsRepo = new ConnectionsRepoLocalStorage(),
  ) {
    super(client);
  }

  /**
   * Gets the configuration for JoyID.
   * @returns The configuration object.
   */
  private getConfig() {
    const { network } = this.matchNetworkPreference(
      this.preferredNetworks,
      this.network,
    ) ?? { network: this.network };
    if (this.network !== network) {
      this.connection = undefined;
    }
    this.network = network;

    const url = {
      btc: "https://app.joy.id",
      btcTestnet: "https://testnet.joyid.dev",
    }[network];
    if (!url) {
      throw new Error(
        `JoyID wallet doesn't support the requested chain ${this.network}`,
      );
    }

    return {
      redirectURL: location.href,
      joyidAppURL: this._appUri ?? url,
      requestNetwork: `btc-${this.addressType}`,
      name: this.name,
      logo: this.icon,
    };
  }

  async disconnect(): Promise<void> {
    await super.disconnect();

    await this.connectionsRepo.set(
      { uri: this.getConfig().joyidAppURL, addressType: "btc" },
      undefined,
    );
  }

  /**
   * Gets the Bitcoin account address.
   * @returns A promise that resolves to the Bitcoin account address.
   */
  async getBtcAccount(): Promise<string> {
    const { address } = await this.assertConnection();
    return address;
  }

  /**
   * Gets the Bitcoin public key.
   * @returns A promise that resolves to the Bitcoin public key.
   */
  async getBtcPublicKey(): Promise<ccc.Hex> {
    const { publicKey } = await this.assertConnection();
    return publicKey;
  }

  /**
   * Connects to the provider by requesting authentication.
   * @returns A promise that resolves when the connection is established.
   */
  async connect(): Promise<void> {
    const config = this.getConfig();
    const res = await createPopup(buildJoyIDURL(config, "popup", "/auth"), {
      ...config,
      type: DappRequestType.Auth,
    });

    const { address, pubkey } = (() => {
      if (this.addressType === "auto") {
        return res.btcAddressType === "p2wpkh" ? res.nativeSegwit : res.taproot;
      }
      return this.addressType === "p2wpkh" ? res.nativeSegwit : res.taproot;
    })();

    this.connection = {
      address,
      publicKey: ccc.hexFrom(pubkey),
      keyType: res.keyType,
    };
    await Promise.all([
      this.connectionsRepo.set(
        { uri: config.joyidAppURL, addressType: `btc-${res.btcAddressType}` },
        this.connection,
      ),
      this.connectionsRepo.set(
        { uri: config.joyidAppURL, addressType: "btc-auto" },
        this.connection,
      ),
    ]);
  }

  /**
   * Checks if the signer is connected.
   * @returns A promise that resolves to true if connected, false otherwise.
   */
  async isConnected(): Promise<boolean> {
    if (this.connection) {
      return true;
    }

    this.connection = await this.connectionsRepo.get({
      uri: this.getConfig().joyidAppURL,
      addressType: `btc-${this.addressType}`,
    });
    return this.connection !== undefined;
  }

  /**
   * Signs a raw message with the Bitcoin account.
   * @param message - The message to sign.
   * @returns A promise that resolves to the signed message.
   */
  async signMessageRaw(message: string | ccc.BytesLike): Promise<string> {
    const { address } = await this.assertConnection();

    const challenge =
      typeof message === "string" ? message : ccc.hexFrom(message).slice(2);

    const config = this.getConfig();
    const { signature } = await createPopup(
      buildJoyIDURL(
        {
          ...config,
          challenge,
          address,
          signMessageType: "ecdsa",
        },
        "popup",
        "/sign-message",
      ),
      { ...config, type: DappRequestType.SignMessage },
    );
    return signature;
  }

  async signPsbt(_: string): Promise<string> {
    throw new Error("Not implemented");
  }

  async pushPsbt(_: string): Promise<string> {
    throw new Error("Not implemented");
  }
}
