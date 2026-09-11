import { ccc } from "@ckb-ccc/core";
import type {
  AbortOptions,
  Connection,
  PeerId,
  Stream,
} from "@libp2p/interface";
import type {
  AddressManager,
  ConnectionManager,
  Registrar,
} from "@libp2p/interface-internal";
import { lpStream } from "@libp2p/utils";
import { CODE_P2P, multiaddr, type Multiaddr } from "@multiformats/multiaddr";

const MAX_PAIRING_MESSAGE_LENGTH = 1024;
const UNPAIR_TIMEOUT_MS = 10_000;

export type PairingServiceComponents = {
  addressManager?: Pick<AddressManager, "getAddresses">;
  connectionManager: ConnectionManager;
  registrar: Registrar;
};

export type PairingServiceConfig = {
  /** Optional self-reported label shared with the paired peer. */
  name?: string;
  protocol: string;
  pairedPeerTimeoutMs: number;
};

export type PairingTarget = {
  addresses: Multiaddr[];
  secret: string;
};

export type PairingGuard<
  Components extends PairingServiceComponents = PairingServiceComponents,
> = (this: PairingService<Components>, peerId: PeerId) => boolean;

type PairingRequest =
  | { type: "pair"; secret: string; name?: string; addresses?: string[] }
  | { type: "unpair" };

type PairingResponse =
  { ok: true; name?: string } | { ok: false; error: string };

export abstract class PairingService<
  Components extends PairingServiceComponents = PairingServiceComponents,
> {
  private currentSecret = createSecret();
  private readonly errorListeners = new Set<(error: Error) => void>();
  private readonly pairedListeners = new Set<
    (peerId: PeerId, name?: string) => void
  >();
  private readonly unpairedListeners = new Set<(peerId: PeerId) => void>();
  private readonly secretChangedListeners = new Set<(secret: string) => void>();
  private readonly pairingTimeouts = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor(
    readonly components: Components,
    readonly config: PairingServiceConfig,
  ) {
    if (config.pairedPeerTimeoutMs <= 0) {
      throw new Error("Paired peer timeout must be greater than zero");
    }
  }

  protected abstract canPair(peerId: PeerId): boolean;

  /** The credential to include in the currently issued pairing endpoint. */
  get secret() {
    return this.currentSecret;
  }

  onError(listener: (error: Error) => void) {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  onPaired(listener: (peerId: PeerId, name?: string) => void) {
    this.pairedListeners.add(listener);
    return () => this.pairedListeners.delete(listener);
  }

  onUnpaired(listener: (peerId: PeerId) => void) {
    this.unpairedListeners.add(listener);
    return () => this.unpairedListeners.delete(listener);
  }

  onSecretChanged(listener: (secret: string) => void) {
    this.secretChangedListeners.add(listener);
    return () => this.secretChangedListeners.delete(listener);
  }

  async start() {
    await this.components.registrar.handle(
      this.config.protocol,
      this.handleProtocol.bind(this),
      { runOnLimitedConnection: true },
    );
  }

  async stop() {
    await this.components.registrar.unhandle(this.config.protocol);

    this.pairingTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.pairingTimeouts.clear();
  }

  isPaired(peerId: PeerId) {
    return this.pairingTimeouts.has(peerId.toString());
  }

  refresh(peerId: PeerId) {
    const key = peerId.toString();
    const timeout = this.pairingTimeouts.get(key);
    if (timeout === undefined) {
      return;
    }

    clearTimeout(timeout);
    this.pairingTimeouts.set(key, this.createPeerTimeout(peerId));
  }

  async pair(
    target: PairingTarget,
    options: AbortOptions = {},
  ): Promise<PeerId> {
    let stream: Stream | undefined;
    let addedPeer: PeerId | undefined;

    try {
      const opened = await this.openStream(target.addresses, options);
      stream = opened.stream;

      if (!opened.connection) {
        throw new Error("Could not determine remote peer");
      }

      if (this.addPairedPeer(opened.connection.remotePeer)) {
        addedPeer = opened.connection.remotePeer;
      }

      const response = await exchange(
        stream,
        createPairRequest(target.secret, this.config.name, this.addresses()),
        options,
      );
      options.signal?.throwIfAborted();
      stream = undefined;

      if (!response.ok) {
        throw new Error(response.error);
      }

      if (addedPeer) {
        this.rotateSecret();
        this.notifyPairedPeer(addedPeer, response.name);
      }
      return opened.connection.remotePeer;
    } catch (cause) {
      if (addedPeer) {
        this.removePairedPeer(addedPeer, false);
      }
      throw this.handleError(cause, stream);
    }
  }

  async unpair(peerId: PeerId) {
    if (!this.removePairedPeer(peerId)) {
      return;
    }

    const options = { signal: AbortSignal.timeout(UNPAIR_TIMEOUT_MS) };

    let stream: Stream | undefined;
    try {
      const opened = await this.openStream(peerId, options);
      stream = opened.stream;
      const response = await exchange(
        opened.stream,
        { type: "unpair" },
        options,
      );
      stream = undefined;
      if (!response.ok) {
        throw new Error(response.error);
      }
    } catch (cause) {
      this.handleError(cause, stream);
    }
  }

  private async handleProtocol(stream: Stream, connection: Connection) {
    let addedPeer: PeerId | undefined;

    try {
      const pairingStream = lpStream(stream, {
        maxDataLength: MAX_PAIRING_MESSAGE_LENGTH,
      });
      const request = parsePairingRequest(
        (await pairingStream.read()).subarray(),
      );

      if (request.type === "unpair") {
        this.removePairedPeer(connection.remotePeer);
        await writeResponse(pairingStream, stream, { ok: true });
        return;
      }

      if (
        request.secret !== this.secret ||
        !this.canPair(connection.remotePeer)
      ) {
        await writeResponse(pairingStream, stream, {
          ok: false,
          error: "Pairing rejected",
        });
        return;
      }

      const addresses = parseAddresses(
        request.addresses,
        connection.remotePeer,
      );

      // Consume the credential before the next asynchronous boundary so two
      // concurrent requests cannot both pair with the same endpoint.
      this.rotateSecret();

      if (this.addPairedPeer(connection.remotePeer)) {
        addedPeer = connection.remotePeer;
      }
      await writeResponse(pairingStream, stream, {
        ok: true,
        name: this.config.name,
      });
      if (addedPeer) {
        this.notifyPairedPeer(addedPeer, request.name);
        void this.openFallbackConnection(addresses);
      }
    } catch (cause) {
      if (addedPeer) {
        this.removePairedPeer(addedPeer, false);
      }
      this.handleError(cause, stream);
    }
  }

  private addPairedPeer(peerId: PeerId) {
    const key = peerId.toString();
    const timeout = this.pairingTimeouts.get(key);
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }

    this.pairingTimeouts.set(key, this.createPeerTimeout(peerId));
    return timeout === undefined;
  }

  private notifyPairedPeer(peerId: PeerId, name?: string) {
    this.pairedListeners.forEach((listener) => listener(peerId, name));
  }

  private addresses() {
    return this.components.addressManager?.getAddresses() ?? [];
  }

  private async openFallbackConnection(addresses: Multiaddr[]) {
    if (addresses.length === 0) {
      return;
    }

    try {
      await this.components.connectionManager.openConnection(addresses);
    } catch {
      // The original pairing connection remains usable when the fallback fails.
    }
  }

  private rotateSecret() {
    this.currentSecret = createSecret();
    this.secretChangedListeners.forEach((listener) =>
      listener(this.currentSecret),
    );
  }

  private removePairedPeer(peerId: PeerId, notify = true) {
    const key = peerId.toString();
    const timeout = this.pairingTimeouts.get(key);
    if (timeout === undefined) {
      return false;
    }

    clearTimeout(timeout);
    this.pairingTimeouts.delete(key);

    if (notify) {
      this.unpairedListeners.forEach((listener) => listener(peerId));
    }
    return true;
  }

  private createPeerTimeout(peerId: PeerId) {
    return setTimeout(() => {
      this.removePairedPeer(peerId);
    }, this.config.pairedPeerTimeoutMs);
  }

  private async openStream(
    target: PeerId | Multiaddr | Multiaddr[],
    options: AbortOptions,
  ) {
    let connection: Connection | undefined;
    const stream = await this.components.connectionManager.openStream(
      target,
      this.config.protocol,
      {
        runOnLimitedConnection: true,
        signal: options.signal,
        onProgress(event) {
          if (event.type === "connection:opened-stream") {
            connection = event.detail.connection;
          }
        },
      },
    );

    return { stream, connection };
  }

  private handleError(cause: unknown, stream?: Stream) {
    const error = asError(cause, "Pairing operation failed");

    stream?.abort(error);
    this.errorListeners.forEach((listener) => listener(error));
    return error;
  }
}

export function pairingService<
  Components extends PairingServiceComponents = PairingServiceComponents,
>(
  config: PairingServiceConfig,
  canPair: PairingGuard<Components>,
): (components: Components) => PairingService<Components> {
  return (components: Components) =>
    new (class extends PairingService<Components> {
      protected canPair(peerId: PeerId) {
        return canPair.call(this, peerId);
      }
    })(components, config);
}

async function exchange(
  stream: Stream,
  request: PairingRequest,
  options: AbortOptions,
) {
  const pairingStream = lpStream(stream, {
    maxDataLength: MAX_PAIRING_MESSAGE_LENGTH,
  });

  await pairingStream.write(ccc.bytesFrom(JSON.stringify(request), "utf8"), {
    signal: options.signal,
  });
  await stream.close(options);

  const response = parsePairingResponse(
    (await pairingStream.read(options)).subarray(),
  );
  await stream.closeRead(options);
  return response;
}

function createPairRequest(
  secret: string,
  name: string | undefined,
  addresses: Multiaddr[],
): PairingRequest {
  const addressStrings = addresses.map((address) => address.toString());
  const request: PairingRequest = {
    type: "pair",
    secret,
    name,
    addresses: addressStrings,
  };
  while (addressStrings.length > 0 && !pairingRequestFits(request)) {
    addressStrings.pop();
  }

  if (!pairingRequestFits(request)) {
    delete request.addresses;
  }
  if (!pairingRequestFits(request)) {
    delete request.name;
  }
  if (!pairingRequestFits(request)) {
    throw new Error("Pairing request is too large");
  }
  return request;
}

function pairingRequestFits(request: PairingRequest) {
  return (
    ccc.bytesFrom(JSON.stringify(request), "utf8").byteLength <=
    MAX_PAIRING_MESSAGE_LENGTH
  );
}

async function writeResponse(
  pairingStream: ReturnType<typeof lpStream>,
  stream: Stream,
  response: PairingResponse,
) {
  await pairingStream.write(ccc.bytesFrom(JSON.stringify(response), "utf8"));
  await stream.close();
}

function parsePairingRequest(data: Uint8Array): PairingRequest {
  const request = JSON.parse(
    ccc.bytesTo(data, "utf8"),
  ) as Partial<PairingRequest>;
  if (
    request.type === "pair" &&
    typeof request.secret === "string" &&
    request.secret
  ) {
    return {
      type: "pair",
      secret: request.secret,
      name: typeof request.name === "string" ? request.name : undefined,
      addresses: parseAddressStrings(request.addresses),
    };
  }

  if (request.type === "unpair") {
    return { type: "unpair" };
  }

  throw new Error("Invalid pairing request");
}

function parseAddressStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter(
    (address): address is string =>
      typeof address === "string" && address.length > 0,
  );
}

function parseAddresses(values: string[] | undefined, peerId: PeerId) {
  return (values ?? []).flatMap((value) => {
    try {
      const address = multiaddr(value);
      const peer = address
        .getComponents()
        .filter(({ code }) => code === CODE_P2P)
        .at(-1)?.value;
      return peer === peerId.toString() ? [address] : [];
    } catch {
      return [];
    }
  });
}

function parsePairingResponse(data: Uint8Array): PairingResponse {
  const response = JSON.parse(
    ccc.bytesTo(data, "utf8"),
  ) as Partial<PairingResponse>;
  if (response.ok === true) {
    return {
      ok: true,
      name: typeof response.name === "string" ? response.name : undefined,
    };
  }
  if (response.ok === false && typeof response.error === "string") {
    return { ok: false, error: response.error };
  }

  throw new Error("Invalid pairing response");
}

function createSecret() {
  return ccc.bytesTo(crypto.getRandomValues(new Uint8Array(16)), "base64url");
}

function asError(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause : new Error(fallback);
}
