import { ccc } from "@ckb-ccc/ccc";
import { Libp2p } from "@ckb-ccc/libp2p";
import type { PeerId } from "@libp2p/interface";
import type { KhieNode } from "./node.js";

const DIAL_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [5_000, 10_000, 20_000] as const;
const RETRY_REPEAT_MS = 30_000;
const DIRECT_CONNECTION_ATTEMPTS = 4;

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
    try {
      await ccc.retry<void>(
        RETRY_DELAYS_MS,
        async ({ index, resolve }) => {
          await ccc.waitForAvailability(controller.signal);
          if (this.hasRequiredConnection(index)) {
            return resolve(undefined);
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
          } catch (cause) {
            if (this.hasRequiredConnection(index)) {
              return resolve(undefined);
            }
            throw cause;
          }
          if (this.hasRequiredConnection(index)) {
            return resolve(undefined);
          }

          throw new Error("Dial did not establish a connection");
        },
        { repeat: RETRY_REPEAT_MS, signal: controller.signal },
      );
    } catch {
      // Exhausting retries and cancellation both end this reconciliation.
    }
  }

  private hasRequiredConnection(index: number) {
    return this.node
      .getConnections(this.peerId)
      .some(
        ({ direct, status }) =>
          status === "open" && (index >= DIRECT_CONNECTION_ATTEMPTS || direct),
      );
  }
}
