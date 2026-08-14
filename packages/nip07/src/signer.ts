import { ccc } from "@ckb-ccc/core";
import {
  Connection,
  ConnectionsRepo,
  ConnectionsRepoLocalStorage,
} from "./connectionsStorage/index.js";
import { Provider } from "./nip07.advanced.js";

/**
 * Error thrown when the wallet signs with a different account than the restored
 * NIP-07 connection.
 * @public
 */
export class NostrAccountChangedError extends Error {
  constructor() {
    super("The active Nostr account has changed. Please reconnect the wallet.");
    this.name = "NostrAccountChangedError";
  }
}

/**
 * @public
 */
export class Signer extends ccc.SignerNostr {
  private connection?: Connection;

  constructor(
    client: ccc.Client,
    public readonly provider: Provider,
    private readonly connectionsRepo: ConnectionsRepo = new ConnectionsRepoLocalStorage(),
  ) {
    super(client);
  }

  private async assertConnection(): Promise<Connection> {
    if (!(await this.isConnected()) || !this.connection) {
      throw new Error("Not connected");
    }

    return this.connection;
  }

  private async saveConnection(): Promise<void> {
    await this.connectionsRepo.set(this.connection);
  }

  private async restoreConnection(): Promise<void> {
    this.connection = await this.connectionsRepo.get();
  }

  async getNostrPublicKey(): Promise<ccc.Hex> {
    return (await this.assertConnection()).publicKey;
  }

  async signNostrEvent(
    event: ccc.NostrEvent,
  ): Promise<Required<ccc.NostrEvent>> {
    const expectedPublicKey = await this.getNostrPublicKey();
    const signedEvent = await this.provider.signEvent({
      ...event,
      pubkey: expectedPublicKey.slice(2),
    });

    try {
      if (ccc.hexFrom(signedEvent.pubkey) !== expectedPublicKey) {
        throw new Error("Public key mismatch");
      }
    } catch {
      this.connection = undefined;
      await this.saveConnection();
      throw new NostrAccountChangedError();
    }

    return signedEvent;
  }

  async connect(): Promise<void> {
    try {
      this.connection = {
        publicKey: ccc.hexFrom(await this.provider.getPublicKey()),
      };
      await this.saveConnection();
    } catch (error) {
      this.connection = undefined;
      await this.saveConnection();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await super.disconnect();

    this.connection = undefined;
    await this.saveConnection();
  }

  async isConnected(): Promise<boolean> {
    if (this.connection) {
      return true;
    }

    await this.restoreConnection();
    return this.connection !== undefined;
  }
}
