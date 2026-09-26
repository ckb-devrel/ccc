import { ccc } from "@ckb-ccc/ccc";
import { Libp2p } from "@ckb-ccc/libp2p";
import type { PeerId } from "@libp2p/interface";
import type { ConnectorConnection } from "../../events/external.js";
import { ConnectorError } from "../error.js";
import { KhieConnectionController } from "./connection.js";
import {
  CONNECTOR_ENDPOINT_URL,
  createKhieNode,
  JSON_RPC_PROTOCOL,
  KHIE_APP_CONNECT_URL,
  type KhieNode,
} from "./node.js";
import { khieWalletFrom } from "./wallet.js";

export type KhiePairingPhase = "connecting" | "idle" | "pairing";
export type KhieRelayState = "connected" | "connecting" | "failed" | "idle";

export type KhiePairingSessionState = Readonly<{
  appEndpoint: string;
  canPair: boolean;
  /** Raw cause; the UI formats it with `displayError` so it follows the locale. */
  error?: unknown;
  errorKind?: "incompatible-peer";
  ownEndpoint: string;
  phase: KhiePairingPhase;
  relayState: KhieRelayState;
  signer?: ccc.SignerJsonRpc;
}>;

export const KHIE_PAIRING_SESSION_INITIAL_STATE: KhiePairingSessionState = {
  appEndpoint: "",
  canPair: false,
  ownEndpoint: "",
  phase: "idle",
  relayState: "idle",
};

export type KhiePairingSessionConfig = {
  client: ccc.Client;
  name?: string;
  onConnected: (connectionOwner: ccc.Owner<ConnectorConnection>) => void;
  onStateChange: () => void;
};

type KhiePairingSessionResources = {
  abortController: AbortController;
  connectionController?: KhieConnectionController;
  nodeOwner?: ccc.Owner<KhieNode>;
  relayController?: Libp2p.RelayConnectionController;
  nodeSubscriptions: Array<() => void>;
  selectedPeer?: PeerId;
  pendingSigner?: {
    cleanup: () => Promise<void>;
    signer: ccc.SignerJsonRpc;
  };
};

function removeNodeSubscriptions(resources: KhiePairingSessionResources) {
  for (const unsubscribe of resources.nodeSubscriptions.splice(0)) {
    unsubscribe();
  }
}

async function releaseResources(resources: KhiePairingSessionResources) {
  removeNodeSubscriptions(resources);
  resources.connectionController?.stop();

  try {
    if (resources.pendingSigner) {
      await resources.pendingSigner.cleanup();
    }
  } finally {
    try {
      await resources.relayController?.stop();
    } finally {
      await resources.nodeOwner?.dispose();
    }
  }
}

export class KhiePairingSession {
  private readonly client: ccc.Client;
  private readonly name?: string;
  private readonly onConnected: KhiePairingSessionConfig["onConnected"];
  private readonly onStateChange: KhiePairingSessionConfig["onStateChange"];

  private resources?: KhiePairingSessionResources;

  private currentState = KHIE_PAIRING_SESSION_INITIAL_STATE;
  private hasStarted = false;
  private closing?: Promise<void>;

  constructor(config: KhiePairingSessionConfig) {
    this.client = config.client;
    this.name = config.name;
    this.onConnected = config.onConnected;
    this.onStateChange = config.onStateChange;
  }

  get state(): KhiePairingSessionState {
    return this.currentState;
  }

  private update(patch: Partial<KhiePairingSessionState>) {
    if (this.closing) {
      return;
    }

    this.currentState = { ...this.currentState, ...patch };
    this.onStateChange();
  }

  private beginOperation(
    patch: Omit<Partial<KhiePairingSessionState>, "error" | "errorKind"> = {},
  ) {
    this.update({ ...patch, error: undefined, errorKind: undefined });
  }

  private updateError(
    cause: unknown,
    patch: Omit<Partial<KhiePairingSessionState>, "error" | "errorKind"> = {},
  ) {
    this.update({
      ...patch,
      error: cause,
      errorKind: isIncompatiblePeerError(cause)
        ? "incompatible-peer"
        : undefined,
    });
  }

  async start(relayAddress: string) {
    if (this.hasStarted || this.closing) {
      return;
    }
    this.hasStarted = true;

    const resources: KhiePairingSessionResources = {
      abortController: new AbortController(),
      nodeSubscriptions: [],
    };
    this.resources = resources;
    const signal = resources.abortController.signal;

    try {
      resources.nodeOwner = await createKhieNode(
        () => !signal.aborted && !resources.selectedPeer,
        signal,
        this.name,
      );
      signal.throwIfAborted();
      const node = resources.nodeOwner.value;
      this.update({ canPair: true });
      this.observeNode(resources, node);
      await this.connectRelay(relayAddress);
    } catch (cause) {
      this.updateError(cause);
      await this.close();
    }
  }

  close(): Promise<void> {
    if (this.closing) {
      return this.closing;
    }

    const resources = this.resources;
    this.resources = undefined;

    resources?.abortController.abort();
    this.closing = resources ? releaseResources(resources) : Promise.resolve();
    return this.closing;
  }

  private observeNode(resources: KhiePairingSessionResources, node: KhieNode) {
    let endpointUpdateId = 0;
    const syncEndpoint = () => {
      const updateId = ++endpointUpdateId;
      const addresses = node.getMultiaddrs();
      if (addresses.length === 0) {
        this.update({ appEndpoint: "", ownEndpoint: "" });
        return;
      }

      const secret = node.services.pairing.secret;
      void Promise.all([
        Libp2p.encodePairingEndpoint(
          CONNECTOR_ENDPOINT_URL,
          addresses,
          secret,
          "connector",
        ),
        Libp2p.encodePairingEndpoint(
          KHIE_APP_CONNECT_URL,
          addresses,
          secret,
          "connector",
        ),
      ])
        .then(([ownEndpoint, appEndpoint]) => {
          if (updateId !== endpointUpdateId) {
            return;
          }
          this.update({ appEndpoint, ownEndpoint });
        })
        .catch((cause: unknown) => {
          if (updateId !== endpointUpdateId) {
            return;
          }
          this.updateError(cause);
        });
    };

    node.addEventListener("self:peer:update", syncEndpoint);
    resources.nodeSubscriptions.push(
      () => node.removeEventListener("self:peer:update", syncEndpoint),
      node.services.pairing.onSecretChanged(syncEndpoint),
      node.services.pairing.onError((error) => {
        this.updateError(error);
      }),
      node.services.pairing.onPaired((peerId) => {
        void this.acceptPeer(peerId);
      }),
    );
    syncEndpoint();
  }

  async connectRelay(relayAddress: string) {
    const resources = this.resources;
    const node = resources?.nodeOwner?.value;
    if (!node || !relayAddress || resources.selectedPeer) {
      return;
    }

    const address = relayAddress.trim();
    const signal = resources.abortController.signal;
    const previous = resources.relayController;
    this.beginOperation({ relayState: "connecting" });
    let controller: Libp2p.RelayConnectionController | undefined;

    try {
      controller = new Libp2p.RelayConnectionController(node, [address], {
        onConnectionChange: (connection) => {
          if (resources.relayController !== controller) {
            return;
          }
          this.update({
            relayState: connection ? "connected" : "connecting",
          });
        },
      });
      resources.relayController = controller;
      await previous?.stop();
      await controller.connect();
    } catch (cause) {
      if (
        (controller && resources.relayController !== controller) ||
        signal.aborted
      ) {
        return;
      }
      this.updateError(cause, { relayState: "failed" });
    }
  }

  async pair(endpoint: string) {
    const resources = this.resources;
    const node = resources?.nodeOwner?.value;
    if (!node || !endpoint || this.currentState.phase !== "idle") {
      return false;
    }

    this.beginOperation({ phase: "pairing" });
    const signal = resources.abortController.signal;

    try {
      const target = await Libp2p.decodePairingEndpoint(endpoint, "provider");
      await node.services.pairing.pair(target, { signal });
      return true;
    } catch (cause) {
      this.updateError(cause);
      return false;
    } finally {
      if (!resources.selectedPeer) {
        this.update({ phase: "idle" });
      }
    }
  }

  private async acceptPeer(peerId: PeerId) {
    const resources = this.resources;
    const node = resources?.nodeOwner?.value;
    if (!resources || !node || resources.selectedPeer) {
      return;
    }

    const signal = resources.abortController.signal;

    resources.selectedPeer = peerId;
    this.beginOperation({ phase: "pairing" });

    const transport = new Libp2p.JsonRpcTransportLibp2p(node, peerId, {
      protocol: JSON_RPC_PROTOCOL,
      signal,
      onResponse: () => node.services.pairing.refresh(peerId),
    });

    let signer: ccc.SignerJsonRpc;
    try {
      resources.connectionController = new KhieConnectionController(
        node,
        peerId,
      );
      signer = await ccc.SignerJsonRpc.new(this.client, { transport });
      signal.throwIfAborted();
    } catch (cause) {
      resources.connectionController?.stop();
      resources.connectionController = undefined;
      resources.selectedPeer = undefined;
      this.updateError(cause, { phase: "idle" });
      await node.services.pairing.unpair(peerId);
      return;
    }

    const cleanup = this.createPairingCleanup(node, peerId, signer);
    resources.pendingSigner = { cleanup, signer };
    await this.connectSigner();
  }

  private createPairingCleanup(
    node: KhieNode,
    peerId: PeerId,
    signer: ccc.SignerJsonRpc,
  ) {
    let unsubscribeUnpaired = () => {};

    const cleanup = async () => {
      unsubscribeUnpaired();

      await node.services.pairing.unpair(peerId);
    };

    unsubscribeUnpaired = node.services.pairing.onUnpaired((unpairedPeer) => {
      if (!unpairedPeer.equals(peerId)) {
        return;
      }

      if (this.resources?.pendingSigner?.signer === signer) {
        this.updateError(
          new ConnectorError(
            "peer-unpaired",
            "The wallet unpaired. Go back and pair again.",
          ),
          { signer: undefined },
        );
      }
      signer.replace();
      void this.close();
    });
    return cleanup;
  }

  retrySigner() {
    return this.connectSigner();
  }

  private async connectSigner() {
    const resources = this.resources;
    const pendingSigner = resources?.pendingSigner;
    const nodeOwner = resources?.nodeOwner;
    const peerId = resources?.selectedPeer;
    if (!resources || !pendingSigner || !nodeOwner || !peerId) {
      return;
    }

    const { cleanup, signer } = pendingSigner;
    this.beginOperation({ phase: "connecting", signer });
    const signal = resources.abortController.signal;

    try {
      await signer.connect();
      if (!(await signer.isConnected())) {
        throw new ConnectorError(
          "signer-not-connected",
          "Khie signer did not connect",
        );
      }
      signal.throwIfAborted();

      removeNodeSubscriptions(resources);
      const abortController = resources.abortController;
      const relayController = resources.relayController;
      const nodeOwnership = nodeOwner.map((node) => node);
      const connectionController = resources.connectionController;
      const connectedOwner = new ccc.OwnerUnique(
        nodeOwnership.value,
        async () => {
          abortController.abort();
          connectionController?.stop();
          try {
            await cleanup();
          } finally {
            try {
              await relayController?.stop();
            } finally {
              await nodeOwnership.dispose();
            }
          }
        },
      );

      const connectionOwner = new ccc.OwnerUnique(signer, (signer) =>
        signer.disconnect(),
      ).map((signer) => {
        const wallet = khieWalletFrom(signer);
        return {
          wallet,
          signerInfo: new ccc.SignerInfo(wallet.name, signer),
        };
      });
      signer.onReplaced(() => {
        void connectionOwner.dispose().catch(() => {});
        void connectedOwner.dispose().catch(() => {});
      });
      resources.pendingSigner = undefined;
      this.resources = undefined;
      try {
        this.onConnected(connectionOwner);
      } catch (cause) {
        await connectionOwner.dispose();
        throw cause;
      }
    } catch (cause) {
      this.updateError(cause);
    }
  }
}

function isIncompatiblePeerError(cause: unknown): cause is Error {
  return (
    cause instanceof Libp2p.PairingEndpointError ||
    (cause instanceof Error && cause.name === "UnsupportedProtocolError")
  );
}
