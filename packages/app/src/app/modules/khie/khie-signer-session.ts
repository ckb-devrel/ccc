import { ccc } from "@ckb-ccc/connector-react";
import { Libp2p } from "@ckb-ccc/libp2p";
import type { Identify, IdentifyPush } from "@libp2p/identify";
import type {
  Connection,
  IdentifyResult,
  Peer,
  PeerId,
} from "@libp2p/interface";

type BrowserJsonRpcComponents = Libp2p.JsonRpcServiceComponents & {
  pairing: Libp2p.PairingService;
};
type KhieSignerServices = {
  identify: Identify;
  identifyPush: IdentifyPush;
  jsonRpc: Libp2p.JsonRpcService<BrowserJsonRpcComponents>;
  pairing: Libp2p.PairingService;
};
type KhieSignerNode = Awaited<ReturnType<typeof createKhieSignerNode>>;
type KhieSignerJsonRpcHandler = (payload: ccc.JsonRpcPayload) => unknown;

type KhieSignerSessionResources = {
  abortController: AbortController;
  disconnectedAt?: number;
  node?: KhieSignerNode;
  nodeSubscriptions: Array<() => void>;
  pairingController?: AbortController;
  pairedPeer?: PeerId;
  pairedPeerName?: string;
  relayController?: Libp2p.RelayConnectionController;
};

export type KhieSignerSessionConfig = {
  endpointUrl: string;
  handler: KhieSignerJsonRpcHandler;
  onEndpointChange?: (endpoint: string) => void;
  onError?: (error: Error) => void;
  onPaired?: () => void;
  onRemotePeerChange?: (peer: KhieRemotePeer) => void;
  onReady?: (session: KhieSignerSession) => void;
  onRelayConnectionChange?: (connected: boolean) => void;
  onUnpaired?: () => void;
  pairedPeerTimeoutMs?: number;
};

export type KhieRemotePeer = {
  active: boolean;
  agentVersion?: string;
  direct?: boolean;
  id: string;
  lastSeenAt?: number;
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
  private remotePeerUpdateId = 0;

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
    if (!node || !address || this.resources.abortController.signal.aborted) {
      return false;
    }

    const previous = this.resources.relayController;
    let controller: Libp2p.RelayConnectionController | undefined;
    try {
      controller = new Libp2p.RelayConnectionController(node, [address], {
        onConnectionChange: (connection) => {
          if (this.resources.relayController !== controller) {
            return;
          }
          this.events?.onRelayConnectionChange?.(connection !== undefined);
        },
      });
      this.resources.relayController = controller;
      await previous?.stop();
      await controller.connect();
      return true;
    } catch (cause) {
      if (
        (controller && this.resources.relayController !== controller) ||
        this.resources.abortController.signal.aborted
      ) {
        return false;
      }
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
    const refreshPairedPeer = (event: CustomEvent<PeerId>) => {
      if (!this.resources.pairedPeer?.equals(event.detail)) {
        return;
      }

      node.services.pairing.refresh(event.detail);
      if (event.type === "peer:connect") {
        this.resources.disconnectedAt = undefined;
      } else {
        this.resources.disconnectedAt = Date.now();
      }
      void this.syncRemotePeer(node, event.detail);
    };
    const syncPeerConnections = (event: CustomEvent<Connection>) => {
      const peerId = this.resources.pairedPeer;
      if (!peerId?.equals(event.detail.remotePeer)) {
        return;
      }

      void this.syncRemotePeer(node, peerId);
    };

    node.addEventListener("self:peer:update", syncEndpoint);
    node.addEventListener("peer:identify", syncIdentifiedPeer);
    node.addEventListener("peer:connect", refreshPairedPeer);
    node.addEventListener("peer:disconnect", refreshPairedPeer);
    node.addEventListener("connection:open", syncPeerConnections);
    node.addEventListener("connection:close", syncPeerConnections);
    this.resources.nodeSubscriptions.push(
      () => node.removeEventListener("self:peer:update", syncEndpoint),
      () => node.removeEventListener("peer:identify", syncIdentifiedPeer),
      () => node.removeEventListener("peer:connect", refreshPairedPeer),
      () => node.removeEventListener("peer:disconnect", refreshPairedPeer),
      () => node.removeEventListener("connection:open", syncPeerConnections),
      () => node.removeEventListener("connection:close", syncPeerConnections),
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
        this.resources.disconnectedAt = undefined;
        this.events?.onPaired?.();
        void this.syncRemotePeer(node, peerId);
      }),
      node.services.pairing.onUnpaired((peerId) => {
        if (!this.resources.pairedPeer?.equals(peerId)) {
          return;
        }

        this.resources.pairedPeer = undefined;
        this.resources.pairedPeerName = undefined;
        this.resources.disconnectedAt = undefined;
        this.remotePeerUpdateId += 1;
        this.events?.onUnpaired?.();
      }),
    );
    syncEndpoint();
  }

  private async syncRemotePeer(
    node: KhieSignerNode,
    peerId: PeerId,
    identified?: IdentifyResult,
  ) {
    const updateId = ++this.remotePeerUpdateId;
    let peer: Peer | undefined;
    try {
      peer = await node.peerStore.get(peerId);
    } catch {
      // A connection is still useful before identify has populated the peer store.
    }

    if (
      updateId !== this.remotePeerUpdateId ||
      !this.resources.pairedPeer?.equals(peerId)
    ) {
      return;
    }

    const connections = node
      .getConnections(peerId)
      .filter(({ status }) => status === "open");
    const active = connections.length > 0;
    if (active) {
      this.resources.disconnectedAt = undefined;
    } else {
      this.resources.disconnectedAt ??= Date.now();
    }

    const metadataText = (key: string) => {
      const value = peer?.metadata.get(key);
      return value ? ccc.bytesTo(value, "utf8") : undefined;
    };

    this.events?.onRemotePeerChange?.({
      active,
      agentVersion: identified?.agentVersion ?? metadataText("AgentVersion"),
      direct: active ? connections.some(({ direct }) => direct) : undefined,
      id: peerId.toString(),
      lastSeenAt: active ? undefined : this.resources.disconnectedAt,
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
    const { abortController, node, nodeSubscriptions, relayController } =
      this.resources;
    abortController.abort();
    nodeSubscriptions.splice(0).forEach((unsubscribe) => unsubscribe());

    try {
      if (node && this.resources.pairedPeer) {
        await node.services.pairing.unpair(this.resources.pairedPeer);
      }
    } finally {
      try {
        await relayController?.stop();
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
  pairedPeerTimeoutMs: number,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const [
    { noise },
    { yamux },
    { circuitRelayTransport },
    { identify, identifyPush },
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
        identifyPush: identifyPush(),
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
                code: ccc.SignerJsonRpcErrorCode.ServerError,
                message: "Peer is not paired for Khie access",
              });
            }

            pairing.refresh(request.peerId);
            return handler(request.payload);
          },
        ),
      },
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
