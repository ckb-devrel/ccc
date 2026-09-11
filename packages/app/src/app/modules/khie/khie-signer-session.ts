import { ccc } from "@ckb-ccc/connector-react";
import { Libp2p } from "@ckb-ccc/libp2p";
import type { Identify } from "@libp2p/identify";
import type {
  Connection,
  IdentifyResult,
  Peer,
  PeerId,
} from "@libp2p/interface";
import { multiaddr } from "@multiformats/multiaddr";

type BrowserJsonRpcComponents = Libp2p.JsonRpcServiceComponents & {
  pairing: Libp2p.PairingService;
};
type KhieSignerServices = {
  identify: Identify;
  jsonRpc: Libp2p.JsonRpcService<BrowserJsonRpcComponents>;
  pairing: Libp2p.PairingService;
};
type KhieSignerNode = Awaited<ReturnType<typeof createKhieSignerNode>>;
type KhieSignerJsonRpcHandler = (payload: ccc.JsonRpcPayload) => unknown;

class KhieConnectionAuthorizer {
  private readonly connections = new Map<
    string,
    { status: "connected" } | { status: "connecting" }
  >();

  async handle(
    peerId: PeerId,
    payload: ccc.JsonRpcPayload,
    handler: KhieSignerJsonRpcHandler,
  ) {
    const peer = peerId.toString();
    // SignerJsonRpc reads metadata before it sends the connect request.
    if (payload.method === "get_info") {
      return handler(payload);
    }

    if (payload.method !== "connect") {
      if (this.connections.get(peer)?.status !== "connected") {
        throw new ccc.JsonRpcError({
          code: -32001,
          message: "Connect must be approved before this request",
        });
      }
      return handler(payload);
    }

    const connecting = { status: "connecting" } as const;
    this.connections.set(peer, connecting);
    try {
      const result = await handler(payload);
      // A later connect attempt or unpair invalidates this completion.
      if (this.connections.get(peer) === connecting) {
        this.connections.set(peer, { status: "connected" });
      }
      return result;
    } finally {
      if (this.connections.get(peer) === connecting) {
        this.connections.delete(peer);
      }
    }
  }

  unpair(peerId: PeerId) {
    this.connections.delete(peerId.toString());
  }
}

type KhieSignerSessionResources = {
  abortController: AbortController;
  lastRequest?: { at: number; peerId: PeerId };
  node?: KhieSignerNode;
  nodeSubscriptions: Array<() => void>;
  pairingController?: AbortController;
  pairedPeer?: PeerId;
  pairedPeerName?: string;
  relayConnection?: Connection;
};

export type KhieSignerSessionConfig = {
  endpointUrl: string;
  handler: KhieSignerJsonRpcHandler;
  onEndpointChange?: (endpoint: string) => void;
  onError?: (error: Error) => void;
  onPaired?: () => void;
  onRemotePeerChange?: (peer: KhieRemotePeer) => void;
  onReady?: (session: KhieSignerSession) => void;
  onUnpaired?: () => void;
  pairedPeerTimeoutMs?: number;
};

export type KhieRemotePeer = {
  agentVersion?: string;
  connectedAt?: number;
  direct?: boolean;
  id: string;
  lastRequestAt?: number;
  name?: string;
};

export const DEFAULT_KHIE_RELAY_ADDRESS = "/dns4/relay.ckbccc.com/tcp/443/wss";

const KHIE_PAIRING_PROTOCOL = "/nervos-ckb/khie/pairing/0.0.1";
const KHIE_JSON_RPC_PROTOCOL = "/nervos-ckb/khie/json-rpc/0.0.1";
const DEFAULT_PAIRED_PEER_TIMEOUT_MS = 30 * 60 * 1000;

export class KhieSignerSession {
  private readonly resources: KhieSignerSessionResources = {
    abortController: new AbortController(),
    nodeSubscriptions: [],
  };
  private events?: KhieSignerSessionConfig;
  private endpointUpdateId = 0;

  private constructor(private readonly config: KhieSignerSessionConfig) {
    this.events = config;
  }

  static open(config: KhieSignerSessionConfig) {
    const session = new KhieSignerSession(config);
    void session.start();
    return new ccc.OwnerUnique(session, (session) => session.close());
  }

  async connectRelay(relayAddress: string) {
    const address = relayAddress.trim();
    const node = this.resources.node;
    if (!node || !address) {
      return false;
    }

    const previous = this.resources.relayConnection;
    this.resources.relayConnection = undefined;

    let connection: Connection | undefined;
    try {
      await previous?.close();
      connection = await node.dial(multiaddr(address), {
        signal: this.resources.abortController.signal,
      });
      this.resources.abortController.signal.throwIfAborted();

      this.resources.relayConnection = connection;
      return true;
    } catch (cause) {
      await connection?.close();
      this.events?.onError?.(asError(cause));
      return false;
    }
  }

  async pair(endpoint: string) {
    const address = endpoint.trim();
    const resources = this.resources;
    const node = resources.node;
    if (
      !node ||
      !address ||
      resources.pairedPeer ||
      resources.pairingController
    ) {
      return false;
    }

    const pairingController = new AbortController();
    resources.pairingController = pairingController;
    const signal = ccc.abortSignalAny([
      resources.abortController.signal,
      pairingController.signal,
    ]);

    try {
      let target: Libp2p.PairingTarget;
      try {
        target = await Libp2p.decodePairingEndpoint(address, "connector");
      } catch (cause) {
        this.events?.onError?.(asError(cause));
        return false;
      }

      try {
        await node.services.pairing.pair(target, { signal });
        return true;
      } catch {
        // PairingService reports its own errors through onError.
        return false;
      }
    } finally {
      if (resources.pairingController === pairingController) {
        resources.pairingController = undefined;
      }
    }
  }

  cancelPairing() {
    const controller = this.resources.pairingController;
    if (!controller) {
      return;
    }

    const error = new Error("Pairing canceled");
    error.name = "AbortError";
    controller.abort(error);
  }

  async unpair() {
    const node = this.resources.node;
    const peerId = this.resources.pairedPeer;
    if (!node || !peerId) {
      return;
    }

    await node.services.pairing.unpair(peerId);
  }

  private async start() {
    const { abortController } = this.resources;
    try {
      const node = await createKhieSignerNode(
        () => !abortController.signal.aborted && !this.resources.pairedPeer,
        (peerId) => this.resources.pairedPeer?.equals(peerId) === true,
        this.config.handler,
        (peerId) => this.recordRequest(peerId),
        this.config.pairedPeerTimeoutMs ?? DEFAULT_PAIRED_PEER_TIMEOUT_MS,
        abortController.signal,
      );
      this.resources.node = node;
      this.observeNode(node);
      this.events?.onReady?.(this);
    } catch (cause) {
      this.events?.onError?.(asError(cause));
    }
  }

  private observeNode(node: KhieSignerNode) {
    const syncEndpoint = () => {
      void this.syncEndpoint(node).catch((cause: unknown) => {
        this.events?.onError?.(asError(cause));
      });
    };
    const syncIdentifiedPeer = (event: CustomEvent<IdentifyResult>) => {
      const peerId = this.resources.pairedPeer;
      if (!peerId?.equals(event.detail.peerId)) {
        return;
      }

      void this.syncRemotePeer(node, peerId, event.detail);
    };

    node.addEventListener("self:peer:update", syncEndpoint);
    node.addEventListener("peer:identify", syncIdentifiedPeer);
    this.resources.nodeSubscriptions.push(
      () => node.removeEventListener("self:peer:update", syncEndpoint),
      () => node.removeEventListener("peer:identify", syncIdentifiedPeer),
      node.services.pairing.onSecretChanged(syncEndpoint),
      node.services.pairing.onError((error) => {
        const signal = this.resources.pairingController?.signal;
        if (signal?.aborted && error === signal.reason) {
          return;
        }

        this.events?.onError?.(error);
      }),
      node.services.jsonRpc.onError((error) => {
        this.events?.onError?.(error);
      }),
      node.services.pairing.onPaired((peerId, name) => {
        if (this.resources.pairedPeer) {
          return;
        }

        this.resources.pairedPeer = peerId;
        this.resources.pairedPeerName = name;
        this.events?.onPaired?.();
        void this.syncRemotePeer(node, peerId);
      }),
      node.services.pairing.onUnpaired((peerId) => {
        if (!this.resources.pairedPeer?.equals(peerId)) {
          return;
        }

        this.resources.pairedPeer = undefined;
        this.resources.pairedPeerName = undefined;
        this.events?.onUnpaired?.();
      }),
    );
    syncEndpoint();
  }

  private recordRequest(peerId: PeerId) {
    const pairedPeer = this.resources.pairedPeer;
    if (pairedPeer && !pairedPeer.equals(peerId)) {
      return;
    }

    this.resources.lastRequest = { at: Date.now(), peerId };
    const node = this.resources.node;
    if (node && pairedPeer) {
      void this.syncRemotePeer(node, peerId);
    }
  }

  private async syncRemotePeer(
    node: KhieSignerNode,
    peerId: PeerId,
    identified?: IdentifyResult,
  ) {
    let peer: Peer | undefined;
    try {
      peer = await node.peerStore.get(peerId);
    } catch {
      // A connection is still useful before identify has populated the peer store.
    }

    if (!this.resources.pairedPeer?.equals(peerId)) {
      return;
    }

    const connection =
      identified?.connection ??
      node.getConnections(peerId).find(({ status }) => status === "open") ??
      node.getConnections(peerId)[0];
    const lastRequest = this.resources.lastRequest;

    const metadataText = (key: string) => {
      const value = peer?.metadata.get(key);
      return value ? ccc.bytesTo(value, "utf8") : undefined;
    };

    this.events?.onRemotePeerChange?.({
      agentVersion: identified?.agentVersion ?? metadataText("AgentVersion"),
      connectedAt: connection?.timeline.open,
      direct: connection?.direct,
      id: peerId.toString(),
      lastRequestAt:
        lastRequest?.peerId.equals(peerId) === true
          ? lastRequest.at
          : undefined,
      name: this.resources.pairedPeerName,
    });
  }

  private async syncEndpoint(node: KhieSignerNode) {
    const updateId = ++this.endpointUpdateId;
    const addresses = node.getMultiaddrs();
    const endpoint =
      addresses.length === 0
        ? ""
        : await Libp2p.encodePairingEndpoint(
            this.config.endpointUrl,
            addresses,
            node.services.pairing.secret,
            "provider",
          );
    if (updateId !== this.endpointUpdateId) {
      return;
    }
    this.events?.onEndpointChange?.(endpoint);
  }

  private close() {
    this.events = undefined;
    return this.releaseResources();
  }

  private async releaseResources() {
    const { abortController, node, nodeSubscriptions, relayConnection } =
      this.resources;
    abortController.abort();
    nodeSubscriptions.splice(0).forEach((unsubscribe) => unsubscribe());

    try {
      if (node && this.resources.pairedPeer) {
        await node.services.pairing.unpair(this.resources.pairedPeer);
      }
    } finally {
      try {
        await relayConnection?.close();
      } finally {
        await node?.stop();
      }
    }
  }
}

async function createKhieSignerNode(
  canPair: Libp2p.PairingGuard,
  isSelectedPeer: (peerId: PeerId) => boolean,
  handler: KhieSignerJsonRpcHandler,
  onRequest: (peerId: PeerId) => void,
  pairedPeerTimeoutMs: number,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const connectionAuthorizer = new KhieConnectionAuthorizer();

  const [
    { noise },
    { yamux },
    { circuitRelayTransport },
    { identify },
    { webRTC },
    { webSockets },
    { createLibp2p },
  ] = await Promise.all([
    import("@chainsafe/libp2p-noise"),
    import("@chainsafe/libp2p-yamux"),
    import("@libp2p/circuit-relay-v2"),
    import("@libp2p/identify"),
    import("@libp2p/webrtc"),
    import("@libp2p/websockets"),
    import("libp2p"),
  ]);
  signal.throwIfAborted();

  let node:
    Awaited<ReturnType<typeof createLibp2p<KhieSignerServices>>> | undefined;
  try {
    node = await createLibp2p<KhieSignerServices>({
      addresses: { listen: ["/p2p-circuit", "/webrtc"] },
      transports: [webSockets(), webRTC(), circuitRelayTransport()],
      connectionEncrypters: [noise()],
      streamMuxers: [yamux()],
      services: {
        identify: identify(),
        pairing: Libp2p.pairingService(
          { protocol: KHIE_PAIRING_PROTOCOL, pairedPeerTimeoutMs },
          canPair,
        ),
        jsonRpc: Libp2p.jsonRpcService<BrowserJsonRpcComponents>(
          { protocol: KHIE_JSON_RPC_PROTOCOL },
          function (request) {
            const { pairing } = this.components;
            if (
              !pairing.isPaired(request.peerId) ||
              !isSelectedPeer(request.peerId)
            ) {
              throw new ccc.JsonRpcError({
                code: -32000,
                message: "Peer is not paired for Khie access",
              });
            }

            pairing.refresh(request.peerId);
            onRequest(request.peerId);
            return connectionAuthorizer.handle(
              request.peerId,
              request.payload,
              handler,
            );
          },
        ),
      },
    });
    node.services.pairing.onUnpaired((peerId) => {
      connectionAuthorizer.unpair(peerId);
    });
    signal.throwIfAborted();
    return node;
  } catch (cause) {
    await node?.stop();
    throw cause;
  }
}

function asError(cause: unknown) {
  return cause instanceof Error
    ? cause
    : new Error("Khie signer session failed");
}
