import { ccc } from "@ckb-ccc/core";

/**
 * Persisted NIP-07 connection information.
 * @public
 */
export interface Connection {
  publicKey: ccc.Hex;
}

/**
 * Repository used to restore a NIP-07 connection without contacting the wallet.
 * @public
 */
export interface ConnectionsRepo {
  get(): Promise<Connection | undefined>;
  set(connection: Connection | undefined): Promise<void>;
}

/**
 * Local storage based NIP-07 connection repository.
 * @public
 */
export class ConnectionsRepoLocalStorage implements ConnectionsRepo {
  constructor(private readonly storageKey = "ccc-nip07-signer") {}

  async get(): Promise<Connection | undefined> {
    let stored: string | null;
    try {
      stored = window.localStorage.getItem(this.storageKey);
    } catch {
      return;
    }
    if (!stored) {
      return;
    }

    try {
      const connection = JSON.parse(stored) as Partial<Connection>;
      if (typeof connection.publicKey !== "string") {
        throw new Error("Invalid persisted NIP-07 connection");
      }

      return {
        publicKey: ccc.hexFrom(connection.publicKey),
      };
    } catch {
      try {
        window.localStorage.removeItem(this.storageKey);
      } catch {
        // Ignore storage cleanup failures.
      }
      return;
    }
  }

  async set(connection: Connection | undefined): Promise<void> {
    try {
      if (!connection) {
        window.localStorage.removeItem(this.storageKey);
        return;
      }

      window.localStorage.setItem(
        this.storageKey,
        JSON.stringify({
          publicKey: connection.publicKey,
        }),
      );
    } catch {
      // Persistence is best-effort; keep the signer's in-memory connection.
    }
  }
}
