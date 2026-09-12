import { ccc } from "@ckb-ccc/ccc";
import { Libp2p } from "@ckb-ccc/libp2p";
import type { PeerId } from "@libp2p/interface";
import type { KhieNode } from "./node.js";

const DIAL_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [0, 5_000, 10_000, 20_000] as const;

export class KhieConnectionController {
  private readonly listenersController = new AbortController();
  private reconnectController?: AbortController;
  private stopped = false;

  constructor(
    private readonly node: KhieNode,
    private readonly peerId: PeerId,
  ) {
    const options = { signal: this.listenersController.signal };
    node.addEventListener(
      "peer:disconnect",
      this.handlePeerDisconnect.bind(this),
      options,
    );
    if (typeof document !== "undefined") {
      document.addEventListener(
        "visibilitychange",
        this.handleVisibilityChange.bind(this),
        options,
      );
    }
    this.handlePeerDisconnect();
  }

  stop() {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    this.cancelReconnect();
    this.listenersController.abort();
  }

  private handleVisibilityChange() {
    if (document.visibilityState !== "visible") {
      return;
    }

    // Background timers may have been suspended or exhausted. Start a fresh
    // reconciliation when the page becomes active again.
    this.restartReconnect();
  }

  private handlePeerDisconnect(event?: CustomEvent<PeerId>) {
    if (event !== undefined && !event.detail.equals(this.peerId)) {
      return;
    }

    this.node.services.pairing.refresh(this.peerId);
    this.restartReconnect();
  }

  private restartReconnect() {
    this.cancelReconnect();
    this.startReconnect();
  }

  private startReconnect() {
    if (this.stopped || this.reconnectController) {
      return;
    }

    const controller = new AbortController();
    this.reconnectController = controller;
    void this.reconnect(controller).finally(() => {
      if (this.reconnectController === controller) {
        this.reconnectController = undefined;
      }
    });
  }

  private cancelReconnect() {
    this.reconnectController?.abort();
    this.reconnectController = undefined;
  }

  private async reconnect(controller: AbortController) {
    for (const delay of RETRY_DELAYS_MS) {
      try {
        await ccc.sleep(delay, controller.signal);
      } catch {
        return;
      }

      if (this.hasDirectConnection()) {
        return;
      }

      try {
        await Libp2p.dialKnownAddresses(
          this.node,
          this.peerId,
          ccc.abortSignalAny([
            controller.signal,
            AbortSignal.timeout(DIAL_TIMEOUT_MS),
          ]),
        );
        if (this.hasDirectConnection()) {
          return;
        }
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        if (this.hasDirectConnection()) {
          return;
        }
      }
    }
  }

  private hasDirectConnection() {
    return this.node
      .getConnections(this.peerId)
      .some(({ direct, status }) => direct && status === "open");
  }
}
