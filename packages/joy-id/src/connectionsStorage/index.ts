import { ccc } from "@ckb-ccc/core";

/**
 * Type representing an account selector with a URI and address type.
 */
export type AccountSelector = {
  /**
   * The URI of the account.
   */
  uri: string;
  /**
   * The address type of the account.
   */
  addressType: string;
};

/**
 * Checks if a AccountSelector matches the filter
 * @param a - The first account selector.
 * @param filter - The account selector filter.
 * @returns True if the selector matches the filter
 */
export function isSelectorMatch(
  a: AccountSelector,
  filter: AccountSelector,
): boolean {
  return a.uri === filter.uri && a.addressType.startsWith(filter.addressType);
}

/**
 * Type representing a connection with an address, public key, and key type.
 */
export type Connection = {
  /**
   * The address of the connection.
   */
  readonly address: string;
  /**
   * The public key of the connection.
   */
  readonly publicKey: ccc.Hex;
  /**
   * The key type of the connection.
   */
  readonly keyType: string;
};

/**
 * Interface representing a repository for managing connections.
 */
export interface ConnectionsRepo {
  /**
   * Gets a connection for the given selector.
   * @param selector - The account selector.
   * @returns A promise that resolves to the connection, if found.
   */
  get(selector: AccountSelector): Promise<Connection | undefined>;

  /**
   * Sets a connection for the given selector.
   * @param selector - The account selector.
   * @param connection - The connection to set.
   * @returns A promise that resolves when the connection is set.
   */
  set(
    selector: AccountSelector,
    connection: Connection | undefined,
  ): Promise<void>;
}

/**
 * Class representing a local storage-based repository for managing connections.
 */
export class ConnectionsRepoLocalStorage implements ConnectionsRepo {
  private operationLock: Promise<void> = Promise.resolve();

  /**
   * Creates an instance of ConnectionsRepoLocalStorage.
   * @param [storageKey="ccc-joy-id-signer"] - The local storage key.
   */
  constructor(private readonly storageKey = "ccc-joy-id-signer") {}

  /**
   * Reads all connections from local storage.
   * @returns A promise that resolves to an array of selectors and connections.
   */
  async readConnections(): Promise<[AccountSelector, Connection][]> {
    return JSON.parse(window.localStorage.getItem(this.storageKey) ?? "[]") as [
      AccountSelector,
      Connection,
    ][];
  }

  /**
   * Gets a connection for the given selector.
   * @param selector - The account selector.
   * @returns A promise that resolves to the connection, if found.
   */
  async get(selector: AccountSelector): Promise<Connection | undefined> {
    return (await this.readConnections()).find(([s]) =>
      isSelectorMatch(selector, s),
    )?.[1];
  }

  /**
   * Sets a connection for the given selector.
   * @param selector - The account selector.
   * @param connection - The connection to set.
   * @returns
   */
  async set(
    selector: AccountSelector,
    connection: Connection | undefined,
  ): Promise<void> {
    const operation = this.operationLock
      .catch(() => undefined)
      .then(async () => {
        const connections = await this.readConnections();

        if (connection) {
          const existed = connections.find(([s]) =>
            isSelectorMatch(s, selector),
          );
          if (existed) {
            existed[1] = connection;
          } else {
            connections.push([selector, connection]);
          }
          window.localStorage.setItem(
            this.storageKey,
            JSON.stringify(connections),
          );
        } else {
          window.localStorage.setItem(
            this.storageKey,
            JSON.stringify(
              connections.filter(([s]) => !isSelectorMatch(s, selector)),
            ),
          );
        }
      });

    this.operationLock = operation;
    await operation;
  }
}
