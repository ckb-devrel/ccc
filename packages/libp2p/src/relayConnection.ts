import { ccc } from "@ckb-ccc/core";
import type { Connection, Libp2p } from "@libp2p/interface";
import { multiaddr, type Multiaddr } from "@multiformats/multiaddr";

const DIAL_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [5_000, 10_000, 20_000] as const;
const RETRY_REPEAT_MS = 30_000;

export type RelayConnectionControllerOptions = {
  onConnectionChange?: (connection?: Connection) => void;
};

/** Maintains a connection to a relay until stopped. */
export class RelayConnectionController {
  private readonly controller = new AbortController();
  private readonly addresses: readonly Multiaddr[];
  private selectedAddress?: Multiaddr;
  private connection?: Connection;
  private connecting?: Promise<Connection>;

  constructor(
    private readonly node: Libp2p,
    addresses: readonly string[],
    private readonly options: RelayConnectionControllerOptions = {},
  ) {
    if (addresses.length === 0) {
      throw new Error("At least one relay address is required");
    }
    this.addresses = addresses.map((address) => multiaddr(address.trim()));
    node.addEventListener("connection:close", this.handleConnectionClose, {
      signal: this.controller.signal,
    });
  }

  connect(): Promise<Connection> {
    this.controller.signal.throwIfAborted();
    if (this.connection?.status === "open") {
      return Promise.resolve(this.connection);
    }
    if (this.connecting) {
      return this.connecting;
    }

    this.connection = undefined;
    const connecting = ccc
      .retry<Connection>(
        RETRY_DELAYS_MS,
        async ({ resolve }) => {
          return resolve(await this.dialRelay());
        },
        { repeat: RETRY_REPEAT_MS, signal: this.controller.signal },
      )
      .finally(() => {
        if (this.connecting === connecting) {
          this.connecting = undefined;
        }
        if (!this.controller.signal.aborted && !this.connection) {
          void this.connect().catch(() => {});
        }
      });
    this.connecting = connecting;
    return connecting;
  }

  async stop() {
    if (this.controller.signal.aborted) {
      return;
    }

    this.controller.abort();
    const connection = this.connection;
    this.connection = undefined;
    this.options.onConnectionChange?.();
    await connection?.close();
  }

  private async dialRelay() {
    const addresses = this.selectedAddress
      ? [this.selectedAddress]
      : this.addresses;
    let lastError: unknown;

    for (const address of addresses) {
      await ccc.waitForAvailability(this.controller.signal);
      let connection: Connection | undefined;
      try {
        connection = await this.node.dial(address, {
          signal: ccc.abortSignalAny([
            this.controller.signal,
            AbortSignal.timeout(DIAL_TIMEOUT_MS),
          ]),
        });
        this.controller.signal.throwIfAborted();
        this.connection = connection;
        if (connection.status !== "open") {
          this.connection = undefined;
          throw new Error("Relay connection closed while dialing");
        }
        this.selectedAddress = address;
        this.options.onConnectionChange?.(connection);
        return connection;
      } catch (cause) {
        lastError = cause;
        await connection?.close();
      }
    }

    throw lastError;
  }

  private readonly handleConnectionClose = (event: CustomEvent<Connection>) => {
    if (event.detail.id !== this.connection?.id) {
      return;
    }

    this.connection = undefined;
    this.options.onConnectionChange?.();
    void this.connect().catch(() => {});
  };
}
